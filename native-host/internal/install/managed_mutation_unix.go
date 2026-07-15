//go:build darwin || linux

package install

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"
)

const managedTemporaryNamePrefix = ".kode-injector-"

func securePrepareManagedFile(userRoot string, path string) error {
	parent, leaf, err := openManagedParent(userRoot, path, true)
	if err != nil {
		return err
	}
	defer unix.Close(parent)
	return validateManagedLeafAt(parent, leaf)
}

func secureWriteManagedFile(
	userRoot string,
	path string,
	data []byte,
	mode os.FileMode,
) error {
	parent, leaf, err := openManagedParent(userRoot, path, false)
	if err != nil {
		return err
	}
	defer unix.Close(parent)
	if err := validateManagedLeafAt(parent, leaf); err != nil {
		return err
	}

	temporaryName, temporary, err := createManagedTemporaryFile(parent, mode)
	if err != nil {
		return err
	}
	removeTemporary := true
	defer func() {
		if removeTemporary {
			_ = unix.Unlinkat(parent, temporaryName, 0)
		}
	}()
	file := os.NewFile(uintptr(temporary), temporaryName)
	if file == nil {
		_ = unix.Close(temporary)
		return errors.New("open managed temporary file")
	}
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := unix.Renameat(parent, temporaryName, parent, leaf); err != nil {
		return err
	}
	removeTemporary = false
	return unix.Fsync(parent)
}

func secureRemoveManagedFile(userRoot string, path string) error {
	parent, leaf, err := openManagedParent(userRoot, path, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer unix.Close(parent)
	if err := validateManagedLeafAt(parent, leaf); err != nil {
		return err
	}
	if err := unix.Unlinkat(parent, leaf, 0); err != nil &&
		!errors.Is(err, os.ErrNotExist) {
		return err
	}
	return unix.Fsync(parent)
}

func secureRemoveManagedDirectoryIfEmpty(userRoot string, path string) error {
	parent, leaf, err := openManagedParent(userRoot, path, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer unix.Close(parent)
	var stat unix.Stat_t
	if err := unix.Fstatat(parent, leaf, &stat, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	if stat.Mode&unix.S_IFMT != unix.S_IFDIR {
		return fmt.Errorf("managed directory is not a regular directory: %s", path)
	}
	if err := unix.Unlinkat(parent, leaf, unix.AT_REMOVEDIR); err != nil {
		if errors.Is(err, unix.ENOTEMPTY) || errors.Is(err, unix.EEXIST) {
			return nil
		}
		return err
	}
	return unix.Fsync(parent)
}

func openManagedParent(
	userRoot string,
	path string,
	create bool,
) (int, string, error) {
	if !filepath.IsAbs(path) || !isWithin(userRoot, path) {
		return -1, "", fmt.Errorf("managed path must stay within the user root: %s", path)
	}
	parentPath := filepath.Dir(filepath.Clean(path))
	relativeParent, err := filepath.Rel(userRoot, parentPath)
	if err != nil {
		return -1, "", err
	}
	current, err := unix.Open(
		filepath.Clean(userRoot),
		unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW,
		0,
	)
	if err != nil {
		return -1, "", err
	}
	if relativeParent != "." {
		for _, component := range splitManagedRelativePath(relativeParent) {
			next, openErr := unix.Openat(
				current,
				component,
				unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW,
				0,
			)
			if errors.Is(openErr, os.ErrNotExist) && create {
				if mkdirErr := unix.Mkdirat(current, component, 0o700); mkdirErr != nil &&
					!errors.Is(mkdirErr, os.ErrExist) {
					_ = unix.Close(current)
					return -1, "", mkdirErr
				}
				next, openErr = unix.Openat(
					current,
					component,
					unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW,
					0,
				)
			}
			if openErr != nil {
				_ = unix.Close(current)
				return -1, "", openErr
			}
			_ = unix.Close(current)
			current = next
		}
	}
	return current, filepath.Base(path), nil
}

func validateManagedLeafAt(parent int, leaf string) error {
	var stat unix.Stat_t
	err := unix.Fstatat(parent, leaf, &stat, unix.AT_SYMLINK_NOFOLLOW)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if stat.Mode&unix.S_IFMT != unix.S_IFREG {
		return fmt.Errorf("managed path must be a regular non-symlink file: %s", leaf)
	}
	return nil
}

func createManagedTemporaryFile(parent int, mode os.FileMode) (string, int, error) {
	for range 16 {
		randomBytes := make([]byte, 12)
		if _, err := rand.Read(randomBytes); err != nil {
			return "", -1, err
		}
		name := managedTemporaryNamePrefix + hex.EncodeToString(randomBytes)
		file, err := unix.Openat(
			parent,
			name,
			unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_CLOEXEC|unix.O_NOFOLLOW,
			uint32(mode.Perm()),
		)
		if errors.Is(err, os.ErrExist) {
			continue
		}
		if err != nil {
			return "", -1, err
		}
		if err := unix.Fchmod(file, uint32(mode.Perm())); err != nil {
			_ = unix.Close(file)
			_ = unix.Unlinkat(parent, name, 0)
			return "", -1, err
		}
		return name, file, nil
	}
	return "", -1, errors.New("allocate managed temporary file")
}

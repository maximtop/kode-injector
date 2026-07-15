//go:build windows

package install

import (
	"errors"
	"os"
	"path/filepath"
)

func securePrepareManagedFile(userRoot string, path string) error {
	if err := validateManagedPath(userRoot, path); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return validateManagedPath(userRoot, path)
}

func secureWriteManagedFile(
	userRoot string,
	path string,
	data []byte,
	mode os.FileMode,
) error {
	if err := validateManagedPath(userRoot, path); err != nil {
		return err
	}
	return writeAtomic(path, data, mode)
}

func secureRemoveManagedFile(userRoot string, path string) error {
	if err := validateManagedPath(userRoot, path); err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func secureRemoveManagedDirectoryIfEmpty(userRoot string, path string) error {
	if err := validateManagedParentPath(userRoot, path); err != nil {
		return err
	}
	entries, err := os.ReadDir(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if len(entries) == 0 {
		return os.Remove(path)
	}
	return nil
}

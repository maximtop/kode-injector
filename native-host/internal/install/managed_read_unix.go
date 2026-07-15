//go:build darwin || linux

package install

import (
	"errors"
	"io"
	"os"

	"golang.org/x/sys/unix"
)

func secureReadManagedFile(
	userRoot string,
	path string,
	maximumSize int64,
) ([]byte, bool, error) {
	parent, leaf, err := openManagedParent(userRoot, path, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil, true, nil
	}
	if err != nil {
		return nil, false, err
	}
	defer unix.Close(parent)
	fileDescriptor, err := unix.Openat(
		parent,
		leaf,
		unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW,
		0,
	)
	if errors.Is(err, os.ErrNotExist) {
		return nil, true, nil
	}
	if err != nil {
		return nil, false, err
	}
	file := os.NewFile(uintptr(fileDescriptor), leaf)
	if file == nil {
		_ = unix.Close(fileDescriptor)
		return nil, false, errors.New("open managed manifest")
	}
	defer file.Close()
	var stat unix.Stat_t
	if err := unix.Fstat(fileDescriptor, &stat); err != nil {
		return nil, false, err
	}
	if stat.Mode&unix.S_IFMT != unix.S_IFREG || stat.Size > maximumSize {
		return nil, false, errors.New("managed manifest must be a bounded regular file")
	}
	data, err := io.ReadAll(io.LimitReader(file, maximumSize+1))
	if err != nil {
		return nil, false, err
	}
	if int64(len(data)) > maximumSize {
		return nil, false, errors.New("managed manifest exceeds the size limit")
	}
	return data, false, nil
}

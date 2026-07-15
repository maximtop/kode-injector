//go:build windows

package install

import (
	"errors"
	"io"
	"os"

	"golang.org/x/sys/windows"
)

func secureReadManagedFile(
	userRoot string,
	path string,
	maximumSize int64,
) ([]byte, bool, error) {
	if err := validateManagedParentPath(userRoot, path); err != nil {
		return nil, false, err
	}
	pathPointer, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return nil, false, err
	}
	handle, err := windows.CreateFile(
		pathPointer,
		windows.GENERIC_READ,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_ATTRIBUTE_NORMAL|windows.FILE_FLAG_OPEN_REPARSE_POINT,
		0,
	)
	if errors.Is(err, os.ErrNotExist) {
		return nil, true, nil
	}
	if err != nil {
		return nil, false, err
	}
	file := os.NewFile(uintptr(handle), path)
	if file == nil {
		_ = windows.CloseHandle(handle)
		return nil, false, errors.New("open managed manifest")
	}
	defer file.Close()
	var information windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(handle, &information); err != nil {
		return nil, false, err
	}
	const unsafeAttributes = windows.FILE_ATTRIBUTE_DIRECTORY |
		windows.FILE_ATTRIBUTE_REPARSE_POINT
	if information.FileAttributes&unsafeAttributes != 0 {
		return nil, false, errors.New("managed manifest must be a non-reparse regular file")
	}
	size := int64(information.FileSizeHigh)<<32 | int64(information.FileSizeLow)
	if size > maximumSize {
		return nil, false, errors.New("managed manifest exceeds the size limit")
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

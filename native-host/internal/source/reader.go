package source

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"unicode/utf8"

	"gitlab.com/maximtop/kode-injector/native-host/internal/protocol"
)

type Reader struct{}

func NewReader() Reader {
	return Reader{}
}

func (Reader) Read(rawURL string) ([]byte, protocol.ErrorCode) {
	path, code := fileURLToPath(rawURL)
	if code != "" {
		return nil, code
	}
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		return nil, mapPathError(err)
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return nil, mapPathError(err)
	}
	if !info.Mode().IsRegular() {
		return nil, protocol.ErrorNotRegularFile
	}
	file, err := os.Open(resolved)
	if err != nil {
		return nil, mapPathError(err)
	}
	defer file.Close()
	openedInfo, err := file.Stat()
	if err != nil {
		return nil, protocol.ErrorReadFailed
	}
	if !openedInfo.Mode().IsRegular() {
		return nil, protocol.ErrorNotRegularFile
	}
	data, err := io.ReadAll(io.LimitReader(file, protocol.MaxFileBytes+1))
	if err != nil {
		return nil, protocol.ErrorReadFailed
	}
	if len(data) > protocol.MaxFileBytes {
		return nil, protocol.ErrorFileTooLarge
	}
	if !utf8.Valid(data) {
		return nil, protocol.ErrorInvalidUTF8
	}
	return data, ""
}

func mapPathError(err error) protocol.ErrorCode {
	if errors.Is(err, os.ErrNotExist) {
		return protocol.ErrorFileNotFound
	}
	return protocol.ErrorReadFailed
}

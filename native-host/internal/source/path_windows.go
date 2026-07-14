//go:build windows

package source

import (
	"net/url"
	"path/filepath"
	"strings"

	"gitlab.com/maximtop/kode-injector/native-host/internal/protocol"
)

func fileURLToPath(rawURL string) (string, protocol.ErrorCode) {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "file" || parsed.Opaque != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", protocol.ErrorInvalidFileURL
	}
	if parsed.Host != "" {
		return "", protocol.ErrorRemoteFileURL
	}
	path, err := url.PathUnescape(parsed.EscapedPath())
	if err != nil || strings.ContainsRune(path, 0) || strings.HasPrefix(path, "//") {
		return "", protocol.ErrorInvalidFileURL
	}
	if len(path) < 4 || path[0] != '/' || path[2] != ':' || path[3] != '/' || !isDriveLetter(path[1]) {
		return "", protocol.ErrorInvalidFileURL
	}
	nativePath := filepath.FromSlash(path[1:])
	if !filepath.IsAbs(nativePath) {
		return "", protocol.ErrorInvalidFileURL
	}
	return nativePath, ""
}

func isDriveLetter(value byte) bool {
	return value >= 'A' && value <= 'Z' || value >= 'a' && value <= 'z'
}

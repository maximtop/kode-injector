//go:build darwin || linux

package source

import (
	"net/url"
	"path/filepath"
	"strings"

	"github.com/maximtop/kode-injector/native-host/internal/protocol"
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
	if err != nil || !filepath.IsAbs(path) || strings.ContainsRune(path, 0) {
		return "", protocol.ErrorInvalidFileURL
	}
	return path, ""
}

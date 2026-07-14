package source

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/maximtop/kode-injector/native-host/internal/protocol"
)

func TestReaderRejectsUnsafeSources(t *testing.T) {
	cases := []struct {
		name   string
		rawURL string
		code   protocol.ErrorCode
	}{
		{"http", "https://example.test/a.js", protocol.ErrorInvalidFileURL},
		{"remote authority", "file://server/share/a.js", protocol.ErrorRemoteFileURL},
		{"relative", "file:index.js", protocol.ErrorInvalidFileURL},
		{"null", "file:///tmp/a%00.js", protocol.ErrorInvalidFileURL},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, code := NewReader().Read(tc.rawURL)
			if code != tc.code {
				t.Fatalf("got %s, want %s", code, tc.code)
			}
		})
	}
}

func TestReaderBoundariesAndEncoding(t *testing.T) {
	directory := t.TempDir()
	reader := NewReader()
	cases := []struct {
		name    string
		content []byte
		code    protocol.ErrorCode
	}{
		{"empty", nil, ""},
		{"unicode", []byte("console.log('✓')"), ""},
		{"maximum", bytes.Repeat([]byte{'a'}, protocol.MaxFileBytes), ""},
		{"oversized", bytes.Repeat([]byte{'a'}, protocol.MaxFileBytes+1), protocol.ErrorFileTooLarge},
		{"invalid utf8", []byte{0xff, 0xfe}, protocol.ErrorInvalidUTF8},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(directory, tc.name+"-файл.js")
			if err := os.WriteFile(path, tc.content, 0o600); err != nil {
				t.Fatalf("write fixture: %v", err)
			}
			data, code := reader.Read(fileURL(path))
			if code != tc.code {
				t.Fatalf("got %s, want %s", code, tc.code)
			}
			if code == "" && !bytes.Equal(data, tc.content) {
				t.Fatal("content changed")
			}
		})
	}
}

func TestReaderRejectsMissingDirectoryAndBrokenSymlink(t *testing.T) {
	directory := t.TempDir()
	reader := NewReader()
	if _, code := reader.Read(fileURL(filepath.Join(directory, "missing.js"))); code != protocol.ErrorFileNotFound {
		t.Fatalf("missing file code: %s", code)
	}
	if _, code := reader.Read(fileURL(directory)); code != protocol.ErrorNotRegularFile {
		t.Fatalf("directory code: %s", code)
	}
	if runtime.GOOS != "windows" {
		link := filepath.Join(directory, "broken.js")
		if err := os.Symlink(filepath.Join(directory, "absent.js"), link); err != nil {
			t.Fatalf("create symlink: %v", err)
		}
		if _, code := reader.Read(fileURL(link)); code != protocol.ErrorFileNotFound {
			t.Fatalf("broken symlink code: %s", code)
		}
	}
}

func TestReaderFollowsValidSymlink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink setup requires privileges on Windows")
	}
	directory := t.TempDir()
	target := filepath.Join(directory, "target.js")
	link := filepath.Join(directory, "link.js")
	if err := os.WriteFile(target, []byte("ok"), 0o600); err != nil {
		t.Fatalf("write target: %v", err)
	}
	if err := os.Symlink(target, link); err != nil {
		t.Fatalf("create symlink: %v", err)
	}
	data, code := NewReader().Read(fileURL(link))
	if code != "" || string(data) != "ok" {
		t.Fatalf("unexpected result: %q %s", data, code)
	}
}

func fileURL(path string) string {
	return "file://" + filepath.ToSlash(path)
}

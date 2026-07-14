package install

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestBuildManifests(t *testing.T) {
	path := "/absolute/per-user/path/kode-injector-native"
	firefox, chromium, err := BuildManifests(path, ProductionIDs{
		Chrome: "cikgoagbggecambahlmphhdgmahgeepl",
		Edge:   "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	}, DevelopmentIDs{})
	if err != nil {
		t.Fatalf("build manifests: %v", err)
	}
	var firefoxJSON map[string]any
	if err := json.Unmarshal(firefox, &firefoxJSON); err != nil {
		t.Fatalf("decode Firefox manifest: %v", err)
	}
	allowedExtensions := firefoxJSON["allowed_extensions"].([]any)
	if allowedExtensions[0] != FirefoxExtensionID {
		t.Fatalf("unexpected Firefox allowlist: %v", allowedExtensions)
	}
	var chromiumJSON map[string]any
	if err := json.Unmarshal(chromium, &chromiumJSON); err != nil {
		t.Fatalf("decode Chromium manifest: %v", err)
	}
	allowedOrigins := chromiumJSON["allowed_origins"].([]any)
	if len(allowedOrigins) != 2 {
		t.Fatalf("unexpected Chromium allowlist: %v", allowedOrigins)
	}
}

func TestLoadDevelopmentIDsStrictlyValidates(t *testing.T) {
	path := filepath.Join(t.TempDir(), "ids.json")
	if err := os.WriteFile(path, []byte(`{"chrome":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],"edge":["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]}`), 0o600); err != nil {
		t.Fatalf("write IDs: %v", err)
	}
	ids, err := LoadDevelopmentIDs(path)
	if err != nil {
		t.Fatalf("load IDs: %v", err)
	}
	if len(ids.Chrome) != 1 || len(ids.Edge) != 1 {
		t.Fatalf("unexpected IDs: %+v", ids)
	}

	if err := os.WriteFile(path, []byte(`{"chrome":["chrome-extension://bad/"],"edge":[],"extra":true}`), 0o600); err != nil {
		t.Fatalf("write invalid IDs: %v", err)
	}
	if _, err := LoadDevelopmentIDs(path); err == nil {
		t.Fatal("invalid development IDs were accepted")
	}
}

func TestInstallAndUninstallLifecycle(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "source-host")
	if err := os.WriteFile(source, []byte("host"), 0o700); err != nil {
		t.Fatalf("write host: %v", err)
	}
	paths := Paths{
		ProductRoot:     filepath.Join(root, "product"),
		HostExecutable:  filepath.Join(root, "product", "kode-injector-native"),
		FirefoxManifest: filepath.Join(root, "firefox", ManifestFileName),
		ChromeManifest:  filepath.Join(root, "chrome", ManifestFileName),
		EdgeManifest:    filepath.Join(root, "edge", ManifestFileName),
	}
	config := Config{
		Paths:      paths,
		HostSource: source,
		ProductionIDs: ProductionIDs{
			Chrome: "cikgoagbggecambahlmphhdgmahgeepl",
			Edge:   "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		},
	}
	if err := Install(config); err != nil {
		t.Fatalf("install: %v", err)
	}
	for _, path := range []string{
		paths.HostExecutable,
		paths.FirefoxManifest,
		paths.ChromeManifest,
		paths.EdgeManifest,
	} {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("missing installed file %s: %v", path, err)
		}
	}
	if err := Install(config); err != nil {
		t.Fatalf("idempotent upgrade: %v", err)
	}
	if err := Uninstall(paths); err != nil {
		t.Fatalf("uninstall: %v", err)
	}
	if _, err := os.Stat(paths.HostExecutable); !os.IsNotExist(err) {
		t.Fatalf("host remains after uninstall: %v", err)
	}
}

func TestUninstallRejectsHostOutsideProductRoot(t *testing.T) {
	root := t.TempDir()
	err := Uninstall(Paths{
		ProductRoot:    filepath.Join(root, "product"),
		HostExecutable: filepath.Join(root, "outside", "host"),
	})
	if err == nil {
		t.Fatal("unsafe uninstall path was accepted")
	}
}

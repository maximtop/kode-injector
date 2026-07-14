//go:build linux

package install

import (
	"os"
	"path/filepath"
)

func DefaultPaths() (Paths, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return Paths{}, err
	}
	productRoot := filepath.Join(home, ".local", "share", "kode-injector-native-host")
	return Paths{
		ProductRoot:     productRoot,
		HostExecutable:  filepath.Join(productRoot, "kode-injector-native"),
		FirefoxManifest: filepath.Join(home, ".mozilla", "native-messaging-hosts", ManifestFileName),
		ChromeManifest:  filepath.Join(home, ".config", "google-chrome", "NativeMessagingHosts", ManifestFileName),
		EdgeManifest:    filepath.Join(home, ".config", "microsoft-edge", "NativeMessagingHosts", ManifestFileName),
	}, nil
}

func register(Paths) error { return nil }
func unregister() error    { return nil }

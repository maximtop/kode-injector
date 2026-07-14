//go:build darwin

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
	productRoot := filepath.Join(home, "Library", "Application Support", "Kode Injector Native Host")
	return Paths{
		ProductRoot:     productRoot,
		HostExecutable:  filepath.Join(productRoot, "kode-injector-native"),
		FirefoxManifest: filepath.Join(home, "Library", "Application Support", "Mozilla", "NativeMessagingHosts", ManifestFileName),
		ChromeManifest:  filepath.Join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts", ManifestFileName),
		EdgeManifest:    filepath.Join(home, "Library", "Application Support", "Microsoft Edge", "NativeMessagingHosts", ManifestFileName),
	}, nil
}

func register(Paths) error { return nil }
func unregister() error    { return nil }

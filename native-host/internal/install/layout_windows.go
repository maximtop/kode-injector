//go:build windows

package install

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

var registryKeys = []string{
	`SOFTWARE\Mozilla\NativeMessagingHosts\` + HostName,
	`SOFTWARE\Google\Chrome\NativeMessagingHosts\` + HostName,
	`SOFTWARE\Microsoft\Edge\NativeMessagingHosts\` + HostName,
}

func DefaultPaths() (Paths, error) {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return Paths{}, os.ErrNotExist
	}
	productRoot := filepath.Join(localAppData, "Kode Injector Native Host")
	return Paths{
		ProductRoot:     productRoot,
		HostExecutable:  filepath.Join(productRoot, "kode-injector-native.exe"),
		FirefoxManifest: filepath.Join(productRoot, "firefox-"+ManifestFileName),
		ChromeManifest:  filepath.Join(productRoot, "chrome-"+ManifestFileName),
		EdgeManifest:    filepath.Join(productRoot, "edge-"+ManifestFileName),
	}, nil
}

func register(paths Paths) error {
	manifestPaths := []string{paths.FirefoxManifest, paths.ChromeManifest, paths.EdgeManifest}
	for index, keyPath := range registryKeys {
		key, _, err := registry.CreateKey(registry.CURRENT_USER, keyPath, registry.SET_VALUE)
		if err != nil {
			return err
		}
		if err := key.SetStringValue("", manifestPaths[index]); err != nil {
			key.Close()
			return err
		}
		if err := key.Close(); err != nil {
			return err
		}
	}
	return nil
}

func unregister() error {
	for _, keyPath := range registryKeys {
		if err := registry.DeleteKey(registry.CURRENT_USER, keyPath); err != nil &&
			err != registry.ErrNotExist {
			return err
		}
	}
	return nil
}

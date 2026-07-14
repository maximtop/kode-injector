package install

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	HostName            = "dev.maximtop.kode_injector"
	FirefoxExtensionID  = "kode-injector@maximtop.dev"
	ManifestFileName    = HostName + ".json"
	manifestDescription = "Read-only local source helper for Kode Injector"
)

var chromiumIDPattern = regexp.MustCompile(`^[a-p]{32}$`)

type ProductionIDs struct {
	Chrome string
	Edge   string
}

type DevelopmentIDs struct {
	Chrome []string `json:"chrome"`
	Edge   []string `json:"edge"`
}

type Paths struct {
	ProductRoot     string
	HostExecutable  string
	FirefoxManifest string
	ChromeManifest  string
	EdgeManifest    string
}

type Config struct {
	Paths          Paths
	HostSource     string
	ProductionIDs  ProductionIDs
	DevelopmentIDs DevelopmentIDs
}

type firefoxManifest struct {
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	Path              string   `json:"path"`
	Type              string   `json:"type"`
	AllowedExtensions []string `json:"allowed_extensions"`
}

type chromiumManifest struct {
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Path           string   `json:"path"`
	Type           string   `json:"type"`
	AllowedOrigins []string `json:"allowed_origins"`
}

func BuildManifests(
	hostPath string,
	production ProductionIDs,
	development DevelopmentIDs,
) ([]byte, []byte, error) {
	if !filepath.IsAbs(hostPath) {
		return nil, nil, errors.New("host path must be absolute")
	}
	if err := validateID(production.Chrome); err != nil {
		return nil, nil, fmt.Errorf("Chrome production ID: %w", err)
	}
	if production.Edge != "" {
		if err := validateID(production.Edge); err != nil {
			return nil, nil, fmt.Errorf("Edge production ID: %w", err)
		}
	}
	if err := validateDevelopmentIDs(development); err != nil {
		return nil, nil, err
	}
	firefox, err := json.MarshalIndent(firefoxManifest{
		Name:              HostName,
		Description:       manifestDescription,
		Path:              hostPath,
		Type:              "stdio",
		AllowedExtensions: []string{FirefoxExtensionID},
	}, "", "    ")
	if err != nil {
		return nil, nil, err
	}
	ids := []string{production.Chrome}
	if production.Edge != "" {
		ids = append(ids, production.Edge)
	}
	ids = append(ids, development.Chrome...)
	ids = append(ids, development.Edge...)
	origins := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		origins = append(origins, "chrome-extension://"+id+"/")
	}
	chromium, err := json.MarshalIndent(chromiumManifest{
		Name:           HostName,
		Description:    manifestDescription,
		Path:           hostPath,
		Type:           "stdio",
		AllowedOrigins: origins,
	}, "", "    ")
	if err != nil {
		return nil, nil, err
	}
	return append(firefox, '\n'), append(chromium, '\n'), nil
}

func LoadDevelopmentIDs(path string) (DevelopmentIDs, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return DevelopmentIDs{}, err
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var ids DevelopmentIDs
	if err := decoder.Decode(&ids); err != nil {
		return DevelopmentIDs{}, fmt.Errorf("decode development IDs: %w", err)
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return DevelopmentIDs{}, err
	}
	if err := validateDevelopmentIDs(ids); err != nil {
		return DevelopmentIDs{}, err
	}
	return ids, nil
}

func Install(config Config) error {
	if !isWithin(config.Paths.ProductRoot, config.Paths.HostExecutable) {
		return errors.New("host destination is outside product root")
	}
	firefox, chromium, err := BuildManifests(
		config.Paths.HostExecutable,
		config.ProductionIDs,
		config.DevelopmentIDs,
	)
	if err != nil {
		return err
	}
	if err := copyExecutable(config.HostSource, config.Paths.HostExecutable); err != nil {
		return err
	}
	for _, manifest := range []struct {
		path string
		data []byte
	}{
		{config.Paths.FirefoxManifest, firefox},
		{config.Paths.ChromeManifest, chromium},
		{config.Paths.EdgeManifest, chromium},
	} {
		if err := writeAtomic(manifest.path, manifest.data, 0o644); err != nil {
			return err
		}
	}
	return register(config.Paths)
}

func Uninstall(paths Paths) error {
	if !isWithin(paths.ProductRoot, paths.HostExecutable) {
		return errors.New("host destination is outside product root")
	}
	if err := unregister(); err != nil {
		return err
	}
	for _, path := range []string{
		paths.FirefoxManifest,
		paths.ChromeManifest,
		paths.EdgeManifest,
		paths.HostExecutable,
	} {
		if path == "" {
			continue
		}
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	if err := os.Remove(paths.ProductRoot); err != nil &&
		!errors.Is(err, os.ErrNotExist) &&
		!errors.Is(err, os.ErrInvalid) {
		// A non-empty product directory is preserved intentionally.
		return nil
	}
	return nil
}

func DevelopmentOrigins(ids DevelopmentIDs) []string {
	result := make([]string, 0, len(ids.Chrome)+len(ids.Edge))
	for _, id := range append(append([]string{}, ids.Chrome...), ids.Edge...) {
		result = append(result, "chrome-extension://"+id+"/")
	}
	return result
}

func validateDevelopmentIDs(ids DevelopmentIDs) error {
	seen := map[string]struct{}{}
	for _, id := range append(append([]string{}, ids.Chrome...), ids.Edge...) {
		if err := validateID(id); err != nil {
			return fmt.Errorf("development ID: %w", err)
		}
		if _, exists := seen[id]; exists {
			return fmt.Errorf("duplicate development ID %q", id)
		}
		seen[id] = struct{}{}
	}
	return nil
}

func validateID(id string) error {
	if !chromiumIDPattern.MatchString(id) {
		return errors.New("ID must contain exactly 32 lowercase letters from a through p")
	}
	return nil
}

func ensureJSONEnd(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return errors.New("development ID file must contain one JSON object")
	}
	return nil
}

func copyExecutable(source string, destination string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	if err := os.MkdirAll(filepath.Dir(destination), 0o700); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(destination), ".host-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if _, err := io.Copy(temporary, input); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Chmod(0o700); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, destination)
}

func writeAtomic(path string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), ".manifest-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if _, err := temporary.Write(data); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Chmod(mode); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, path)
}

func isWithin(root string, path string) bool {
	relative, err := filepath.Rel(root, path)
	return err == nil && relative != "." && relative != ".." &&
		!filepath.IsAbs(relative) &&
		!strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

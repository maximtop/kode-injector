package install

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
)

type InstallationState string

const (
	InstallationNotInstalled   InstallationState = "notInstalled"
	InstallationReady          InstallationState = "ready"
	InstallationRepairRequired InstallationState = "repairRequired"
)

const (
	ManagedApplicationBundleName = "Kode Injector Helper.app"
	ManagedHelpersDirectoryName  = "Helpers"
	ManagedContentsDirectoryName = "Contents"
	ManagedHostExecutableName    = "kode-injector-native"
	maximumManagedManifestSize   = 64 * 1024
)

type ManagedHostState string

const (
	ManagedHostReady   ManagedHostState = "ready"
	ManagedHostInvalid ManagedHostState = "invalid"
)

type RegistrationState string

const (
	RegistrationMissing    RegistrationState = "missing"
	RegistrationRegistered RegistrationState = "registered"
	RegistrationStale      RegistrationState = "stale"
	RegistrationInvalid    RegistrationState = "invalid"
)

type Browser string

const (
	BrowserFirefox Browser = "firefox"
	BrowserChrome  Browser = "chrome"
	BrowserEdge    Browser = "edge"
)

type ManagedHost struct {
	State ManagedHostState `json:"state"`
	Path  string           `json:"path"`
}

type BrowserRegistration struct {
	Browser            Browser           `json:"browser"`
	State              RegistrationState `json:"state"`
	ManifestPath       string            `json:"manifestPath"`
	RegisteredHostPath string            `json:"registeredHostPath,omitempty"`
}

type InstallationSnapshot struct {
	State                InstallationState     `json:"state"`
	Host                 ManagedHost           `json:"host"`
	LegacySupportPresent bool                  `json:"legacySupportPresent"`
	Registrations        []BrowserRegistration `json:"registrations"`
}

func InspectManaged(
	paths Paths,
	hostPath string,
	production ProductionIDs,
) (InstallationSnapshot, error) {
	if err := validateManagedPaths(paths); err != nil {
		return InstallationSnapshot{}, err
	}
	if !filepath.IsAbs(hostPath) {
		return InstallationSnapshot{}, errors.New("managed host path must be absolute")
	}
	firefoxData, chromiumData, err := BuildManifests(
		hostPath,
		production,
		DevelopmentIDs{},
	)
	if err != nil {
		return InstallationSnapshot{}, err
	}
	host := inspectManagedHost(hostPath)
	legacySupportPresent := managedLegacySupportPresent(paths)
	registrations := []BrowserRegistration{
		inspectFirefoxRegistration(
			paths.UserRoot,
			paths.FirefoxManifest,
			hostPath,
			firefoxData,
		),
		inspectChromiumRegistration(
			paths.UserRoot,
			BrowserChrome,
			paths.ChromeManifest,
			hostPath,
			chromiumData,
		),
		inspectChromiumRegistration(
			paths.UserRoot,
			BrowserEdge,
			paths.EdgeManifest,
			hostPath,
			chromiumData,
		),
	}
	state := InstallationRepairRequired
	allMissing := true
	allRegistered := true
	for _, registration := range registrations {
		allMissing = allMissing && registration.State == RegistrationMissing
		allRegistered = allRegistered && registration.State == RegistrationRegistered
	}
	if allMissing && !legacySupportPresent {
		state = InstallationNotInstalled
	} else if host.State == ManagedHostReady && allRegistered && !legacySupportPresent {
		state = InstallationReady
	}
	return InstallationSnapshot{
		State:                state,
		Host:                 host,
		LegacySupportPresent: legacySupportPresent,
		Registrations:        registrations,
	}, nil
}

func managedLegacySupportPresent(paths Paths) bool {
	rootInfo, rootErr := os.Lstat(paths.ProductRoot)
	if rootErr == nil && (!rootInfo.IsDir() || rootInfo.Mode()&os.ModeSymlink != 0) {
		return true
	}
	if rootErr != nil && !errors.Is(rootErr, os.ErrNotExist) {
		return true
	}
	_, hostErr := os.Lstat(paths.HostExecutable)
	return hostErr == nil || !errors.Is(hostErr, os.ErrNotExist)
}

func RegisterManaged(paths Paths, hostPath string, production ProductionIDs) error {
	snapshot, err := InspectManaged(paths, hostPath, production)
	if err != nil {
		return err
	}
	if snapshot.Host.State != ManagedHostReady {
		return errors.New("managed host must be a regular executable")
	}
	if err := validateManagedHostLocation(paths, hostPath); err != nil {
		return err
	}
	if err := validateManagedLegacySupport(paths); err != nil {
		return err
	}
	for _, manifestPath := range managedManifestPaths(paths) {
		if err := securePrepareManagedFile(paths.UserRoot, manifestPath); err != nil {
			return err
		}
	}
	firefoxData, chromiumData, err := BuildManifests(
		hostPath,
		production,
		DevelopmentIDs{},
	)
	if err != nil {
		return err
	}
	for _, manifest := range []struct {
		path string
		data []byte
	}{
		{paths.FirefoxManifest, firefoxData},
		{paths.ChromeManifest, chromiumData},
		{paths.EdgeManifest, chromiumData},
	} {
		if err := validateManagedPath(paths.UserRoot, manifest.path); err != nil {
			return err
		}
		if err := secureWriteManagedFile(
			paths.UserRoot,
			manifest.path,
			manifest.data,
			0o644,
		); err != nil {
			return err
		}
	}
	if err := removeManagedLegacySupport(paths); err != nil {
		return err
	}
	snapshot, err = InspectManaged(paths, hostPath, production)
	if err != nil {
		return err
	}
	if snapshot.State != InstallationReady {
		return errors.New("managed registration postcondition failed")
	}
	return nil
}

func validateManagedHostLocation(paths Paths, hostPath string) error {
	if len(paths.ManagedApplicationRoots) == 0 {
		return nil
	}
	cleanHostPath := filepath.Clean(hostPath)
	if filepath.Base(cleanHostPath) != ManagedHostExecutableName {
		return errors.New("managed host has an unexpected executable name")
	}
	helpersPath := filepath.Dir(cleanHostPath)
	contentsPath := filepath.Dir(helpersPath)
	applicationPath := filepath.Dir(contentsPath)
	if filepath.Base(helpersPath) != ManagedHelpersDirectoryName ||
		filepath.Base(contentsPath) != ManagedContentsDirectoryName ||
		filepath.Ext(applicationPath) != ".app" {
		return errors.New("managed host is outside the Kode Injector Helper application bundle")
	}

	for _, root := range paths.ManagedApplicationRoots {
		cleanRoot := filepath.Clean(root)
		if !filepath.IsAbs(cleanRoot) || !isWithin(cleanRoot, applicationPath) {
			continue
		}
		if err := validateExistingPathWithoutSymlinks(cleanRoot, cleanHostPath); err != nil {
			return err
		}
		return nil
	}
	return errors.New("Kode Injector Helper must be inside /Applications or ~/Applications")
}

func validateExistingPathWithoutSymlinks(root string, path string) error {
	if !isWithin(root, path) {
		return errors.New("managed host is outside an allowed application root")
	}
	rootInfo, err := os.Lstat(root)
	if err != nil {
		return fmt.Errorf("inspect application root: %w", err)
	}
	if !rootInfo.IsDir() || rootInfo.Mode()&os.ModeSymlink != 0 {
		return errors.New("allowed application root must be a non-symlink directory")
	}
	relativePath, err := filepath.Rel(root, path)
	if err != nil {
		return err
	}
	currentPath := filepath.Clean(root)
	for _, component := range splitManagedRelativePath(relativePath) {
		currentPath = filepath.Join(currentPath, component)
		info, pathErr := os.Lstat(currentPath)
		if pathErr != nil {
			return fmt.Errorf("inspect managed host location: %w", pathErr)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("managed host location contains a symbolic link: %s", currentPath)
		}
	}
	return nil
}

func UnregisterManaged(paths Paths) error {
	if err := validateManagedPaths(paths); err != nil {
		return err
	}
	if err := validateManagedLegacySupport(paths); err != nil {
		return err
	}
	for _, manifestPath := range managedManifestPaths(paths) {
		if err := validateManagedLeaf(manifestPath); err != nil {
			return err
		}
	}
	for _, manifestPath := range managedManifestPaths(paths) {
		if err := validateManagedParentPath(paths.UserRoot, manifestPath); err != nil {
			return err
		}
		if err := secureRemoveManagedFile(paths.UserRoot, manifestPath); err != nil {
			return err
		}
	}
	for _, manifestPath := range managedManifestPaths(paths) {
		if _, err := os.Lstat(manifestPath); err == nil || !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("managed unregistration postcondition failed for %s", manifestPath)
		}
	}
	if err := removeManagedLegacySupport(paths); err != nil {
		return err
	}
	return nil
}

func managedManifestPaths(paths Paths) []string {
	return []string{
		paths.FirefoxManifest,
		paths.ChromeManifest,
		paths.EdgeManifest,
	}
}

func validateManagedPaths(paths Paths) error {
	if !filepath.IsAbs(paths.UserRoot) {
		return errors.New("managed user root must be absolute")
	}
	rootInfo, err := os.Lstat(paths.UserRoot)
	if err != nil {
		return fmt.Errorf("inspect managed user root: %w", err)
	}
	if !rootInfo.IsDir() || rootInfo.Mode()&os.ModeSymlink != 0 {
		return errors.New("managed user root must be a non-symlink directory")
	}
	for _, manifestPath := range managedManifestPaths(paths) {
		if err := validateManagedParentPath(paths.UserRoot, manifestPath); err != nil {
			return err
		}
	}
	return nil
}

func validateManagedParentPath(userRoot string, manifestPath string) error {
	if !filepath.IsAbs(manifestPath) || !isWithin(userRoot, manifestPath) {
		return fmt.Errorf(
			"managed manifest path must stay within the user root: %s",
			manifestPath,
		)
	}
	parentPath := filepath.Dir(filepath.Clean(manifestPath))
	relativeParent, err := filepath.Rel(userRoot, parentPath)
	if err != nil {
		return err
	}
	currentPath := filepath.Clean(userRoot)
	if relativeParent != "." {
		for _, component := range splitManagedRelativePath(relativeParent) {
			currentPath = filepath.Join(currentPath, component)
			info, pathErr := os.Lstat(currentPath)
			if errors.Is(pathErr, os.ErrNotExist) {
				break
			}
			if pathErr != nil {
				return pathErr
			}
			if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
				return fmt.Errorf(
					"managed manifest parent must be a non-symlink directory: %s",
					currentPath,
				)
			}
		}
	}
	return nil
}

func validateManagedPath(userRoot string, manifestPath string) error {
	if err := validateManagedParentPath(userRoot, manifestPath); err != nil {
		return err
	}
	return validateManagedLeaf(manifestPath)
}

func splitManagedRelativePath(relativePath string) []string {
	return strings.Split(relativePath, string(filepath.Separator))
}

func validateManagedLegacySupport(paths Paths) error {
	if !filepath.IsAbs(paths.ProductRoot) ||
		!isWithin(paths.UserRoot, paths.ProductRoot) {
		return errors.New("legacy support root must stay within the user root")
	}
	if !filepath.IsAbs(paths.HostExecutable) ||
		!isWithin(paths.ProductRoot, paths.HostExecutable) {
		return errors.New("legacy host must stay within the legacy support root")
	}
	if err := validateManagedParentPath(paths.UserRoot, paths.ProductRoot); err != nil {
		return err
	}
	rootInfo, err := os.Lstat(paths.ProductRoot)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err == nil && (!rootInfo.IsDir() || rootInfo.Mode()&os.ModeSymlink != 0) {
		return errors.New("legacy support root must be a non-symlink directory")
	}
	if err := validateManagedParentPath(paths.UserRoot, paths.HostExecutable); err != nil {
		return err
	}
	return validateManagedLeaf(paths.HostExecutable)
}

func removeManagedLegacySupport(paths Paths) error {
	if err := validateManagedLegacySupport(paths); err != nil {
		return err
	}
	if err := secureRemoveManagedFile(paths.UserRoot, paths.HostExecutable); err != nil {
		return err
	}
	if err := secureRemoveManagedDirectoryIfEmpty(
		paths.UserRoot,
		paths.ProductRoot,
	); err != nil {
		return err
	}
	if _, err := os.Lstat(paths.HostExecutable); err == nil ||
		!errors.Is(err, os.ErrNotExist) {
		return errors.New("legacy support host removal postcondition failed")
	}
	return nil
}

func inspectManagedHost(hostPath string) ManagedHost {
	state := ManagedHostInvalid
	info, err := os.Lstat(hostPath)
	if err == nil && info.Mode().IsRegular() && info.Mode()&0o100 != 0 {
		state = ManagedHostReady
	}
	return ManagedHost{State: state, Path: hostPath}
}

func inspectFirefoxRegistration(
	userRoot string,
	manifestPath string,
	expectedHostPath string,
	expectedData []byte,
) BrowserRegistration {
	registration := BrowserRegistration{
		Browser:      BrowserFirefox,
		State:        RegistrationMissing,
		ManifestPath: manifestPath,
	}
	data, state := readManagedManifest(userRoot, manifestPath)
	if state != RegistrationRegistered {
		registration.State = state
		return registration
	}
	var actual firefoxManifest
	var expected firefoxManifest
	if decodeExactJSON(data, &actual) != nil || decodeExactJSON(expectedData, &expected) != nil {
		registration.State = RegistrationInvalid
		return registration
	}
	if !filepath.IsAbs(actual.Path) {
		registration.State = RegistrationInvalid
		return registration
	}
	registration.RegisteredHostPath = actual.Path
	if reflect.DeepEqual(actual, expected) {
		registration.State = RegistrationRegistered
		return registration
	}
	actual.Path = expectedHostPath
	if reflect.DeepEqual(actual, expected) {
		registration.State = RegistrationStale
	} else {
		registration.State = RegistrationInvalid
	}
	return registration
}

func inspectChromiumRegistration(
	userRoot string,
	browser Browser,
	manifestPath string,
	expectedHostPath string,
	expectedData []byte,
) BrowserRegistration {
	registration := BrowserRegistration{
		Browser:      browser,
		State:        RegistrationMissing,
		ManifestPath: manifestPath,
	}
	data, state := readManagedManifest(userRoot, manifestPath)
	if state != RegistrationRegistered {
		registration.State = state
		return registration
	}
	var actual chromiumManifest
	var expected chromiumManifest
	if decodeExactJSON(data, &actual) != nil || decodeExactJSON(expectedData, &expected) != nil {
		registration.State = RegistrationInvalid
		return registration
	}
	if !filepath.IsAbs(actual.Path) {
		registration.State = RegistrationInvalid
		return registration
	}
	registration.RegisteredHostPath = actual.Path
	if reflect.DeepEqual(actual, expected) {
		registration.State = RegistrationRegistered
		return registration
	}
	actual.Path = expectedHostPath
	if reflect.DeepEqual(actual, expected) {
		registration.State = RegistrationStale
	} else {
		registration.State = RegistrationInvalid
	}
	return registration
}

func readManagedManifest(userRoot string, path string) ([]byte, RegistrationState) {
	data, missing, err := secureReadManagedFile(
		userRoot,
		path,
		maximumManagedManifestSize,
	)
	if missing {
		return nil, RegistrationMissing
	}
	if err != nil {
		return nil, RegistrationInvalid
	}
	return data, RegistrationRegistered
}

func decodeExactJSON(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	return ensureJSONEnd(decoder)
}

func validateManagedLeaf(path string) error {
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("managed path must be a regular non-symlink file: %s", path)
	}
	return nil
}

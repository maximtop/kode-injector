package install

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func managedTestLayout(t *testing.T) (Paths, string) {
	t.Helper()
	root := t.TempDir()
	host := filepath.Join(root, "Kode Injector Helper.app", "Contents", "Helpers", "kode-injector-native")
	if err := os.MkdirAll(filepath.Dir(host), 0o700); err != nil {
		t.Fatalf("create host directory: %v", err)
	}
	if err := os.WriteFile(host, []byte("host"), 0o700); err != nil {
		t.Fatalf("write host: %v", err)
	}
	return Paths{
		UserRoot:                root,
		ProductRoot:             filepath.Join(root, "legacy-support"),
		HostExecutable:          filepath.Join(root, "legacy-support", "kode-injector-native"),
		ManagedApplicationRoots: []string{root},
		FirefoxManifest:         filepath.Join(root, "firefox", ManifestFileName),
		ChromeManifest:          filepath.Join(root, "chrome", ManifestFileName),
		EdgeManifest:            filepath.Join(root, "edge", ManifestFileName),
	}, host
}

func writeManagedManifests(t *testing.T, paths Paths, host string) {
	t.Helper()
	firefox, chromium, err := BuildManifests(host, ProductionIDs{
		Chrome: testChromeID,
		Edge:   testEdgeID,
	}, DevelopmentIDs{})
	if err != nil {
		t.Fatalf("build manifests: %v", err)
	}
	for _, manifest := range []struct {
		path string
		data []byte
	}{
		{paths.FirefoxManifest, firefox},
		{paths.ChromeManifest, chromium},
		{paths.EdgeManifest, chromium},
	} {
		if err := os.MkdirAll(filepath.Dir(manifest.path), 0o700); err != nil {
			t.Fatalf("create manifest directory: %v", err)
		}
		if err := os.WriteFile(manifest.path, manifest.data, 0o600); err != nil {
			t.Fatalf("write manifest: %v", err)
		}
	}
}

func TestInspectManagedLifecycle(t *testing.T) {
	production := ProductionIDs{Chrome: testChromeID, Edge: testEdgeID}
	tests := []struct {
		name    string
		arrange func(t *testing.T, paths Paths, host string)
		want    InstallationState
	}{
		{
			name:    "not installed",
			arrange: func(*testing.T, Paths, string) {},
			want:    InstallationNotInstalled,
		},
		{
			name: "not installed with invalid bundled host",
			arrange: func(t *testing.T, _ Paths, host string) {
				if err := os.Chmod(host, 0o600); err != nil {
					t.Fatalf("remove host execute permission: %v", err)
				}
			},
			want: InstallationNotInstalled,
		},
		{
			name:    "ready",
			arrange: writeManagedManifests,
			want:    InstallationReady,
		},
		{
			name: "missing registration",
			arrange: func(t *testing.T, paths Paths, host string) {
				writeManagedManifests(t, paths, host)
				if err := os.Remove(paths.ChromeManifest); err != nil {
					t.Fatalf("remove Chrome manifest: %v", err)
				}
			},
			want: InstallationRepairRequired,
		},
		{
			name: "stale host path",
			arrange: func(t *testing.T, paths Paths, host string) {
				writeManagedManifests(t, paths, filepath.Join(filepath.Dir(host), "old-host"))
			},
			want: InstallationRepairRequired,
		},
		{
			name: "invalid manifest",
			arrange: func(t *testing.T, paths Paths, host string) {
				writeManagedManifests(t, paths, host)
				if err := os.WriteFile(paths.EdgeManifest, []byte("not json"), 0o600); err != nil {
					t.Fatalf("replace Edge manifest: %v", err)
				}
			},
			want: InstallationRepairRequired,
		},
		{
			name: "oversized manifest",
			arrange: func(t *testing.T, paths Paths, host string) {
				writeManagedManifests(t, paths, host)
				if err := os.Truncate(
					paths.ChromeManifest,
					maximumManagedManifestSize+1,
				); err != nil {
					t.Fatalf("expand Chrome manifest: %v", err)
				}
			},
			want: InstallationRepairRequired,
		},
		{
			name: "manifest symlink",
			arrange: func(t *testing.T, paths Paths, host string) {
				writeManagedManifests(t, paths, host)
				if err := os.Remove(paths.FirefoxManifest); err != nil {
					t.Fatalf("remove Firefox manifest: %v", err)
				}
				if err := os.Symlink(paths.ChromeManifest, paths.FirefoxManifest); err != nil {
					t.Fatalf("create manifest symlink: %v", err)
				}
			},
			want: InstallationRepairRequired,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			paths, host := managedTestLayout(t)
			test.arrange(t, paths, host)
			snapshot, err := InspectManaged(paths, host, production)
			if err != nil {
				t.Fatalf("inspect managed lifecycle: %v", err)
			}
			if snapshot.State != test.want {
				t.Fatalf("state=%s want=%s", snapshot.State, test.want)
			}
			if len(snapshot.Registrations) != 3 {
				t.Fatalf("registrations=%d want=3", len(snapshot.Registrations))
			}
		})
	}
}

func TestInspectManagedRejectsNonAbsoluteRegisteredHostPath(t *testing.T) {
	paths, host := managedTestLayout(t)
	writeManagedManifests(t, paths, host)
	data, err := os.ReadFile(paths.FirefoxManifest)
	if err != nil {
		t.Fatalf("read Firefox manifest: %v", err)
	}
	data = []byte(strings.Replace(
		string(data),
		host,
		"relative-host",
		1,
	))
	if err := os.WriteFile(paths.FirefoxManifest, data, 0o600); err != nil {
		t.Fatalf("write relative Firefox host path: %v", err)
	}

	snapshot, err := InspectManaged(
		paths,
		host,
		ProductionIDs{Chrome: testChromeID, Edge: testEdgeID},
	)
	if err != nil {
		t.Fatalf("inspect relative host path: %v", err)
	}
	if snapshot.Registrations[0].State != RegistrationInvalid ||
		snapshot.Registrations[0].RegisteredHostPath != "" {
		t.Fatalf("unexpected Firefox registration: %+v", snapshot.Registrations[0])
	}
}

func TestRegisterManagedIsIdempotentAndUnregisters(t *testing.T) {
	paths, host := managedTestLayout(t)
	production := ProductionIDs{Chrome: testChromeID, Edge: testEdgeID}
	for range 2 {
		if err := RegisterManaged(paths, host, production); err != nil {
			t.Fatalf("register managed host: %v", err)
		}
	}
	snapshot, err := InspectManaged(paths, host, production)
	if err != nil {
		t.Fatalf("inspect registered host: %v", err)
	}
	if snapshot.State != InstallationReady {
		t.Fatalf("registered state=%s want=%s", snapshot.State, InstallationReady)
	}
	if err := UnregisterManaged(paths); err != nil {
		t.Fatalf("unregister managed host: %v", err)
	}
	snapshot, err = InspectManaged(paths, host, production)
	if err != nil {
		t.Fatalf("inspect unregistered host: %v", err)
	}
	if snapshot.State != InstallationNotInstalled {
		t.Fatalf("unregistered state=%s want=%s", snapshot.State, InstallationNotInstalled)
	}
}

func TestRegisterManagedRejectsInvalidHost(t *testing.T) {
	paths, host := managedTestLayout(t)
	if err := os.Chmod(host, 0o600); err != nil {
		t.Fatalf("remove host execute permission: %v", err)
	}
	err := RegisterManaged(paths, host, ProductionIDs{Chrome: testChromeID})
	if err == nil {
		t.Fatal("invalid host was registered")
	}
}

func TestRegisterManagedRejectsHostOutsideApplicationRoots(t *testing.T) {
	paths, host := managedTestLayout(t)
	paths.ManagedApplicationRoots = []string{filepath.Join(paths.UserRoot, "Applications")}

	err := RegisterManaged(paths, host, ProductionIDs{Chrome: testChromeID})
	if err == nil {
		t.Fatal("host outside Applications was registered")
	}
}

func TestRegisterManagedRejectsSymlinkedApplicationBundle(t *testing.T) {
	paths, _ := managedTestLayout(t)
	applicationsRoot := filepath.Join(paths.UserRoot, "Applications")
	if err := os.MkdirAll(applicationsRoot, 0o700); err != nil {
		t.Fatalf("create Applications: %v", err)
	}
	externalApplication := filepath.Join(
		t.TempDir(),
		ManagedApplicationBundleName,
	)
	externalHost := filepath.Join(
		externalApplication,
		ManagedContentsDirectoryName,
		ManagedHelpersDirectoryName,
		ManagedHostExecutableName,
	)
	if err := os.MkdirAll(filepath.Dir(externalHost), 0o700); err != nil {
		t.Fatalf("create external helper: %v", err)
	}
	if err := os.WriteFile(externalHost, []byte("host"), 0o700); err != nil {
		t.Fatalf("write external helper: %v", err)
	}
	applicationLink := filepath.Join(applicationsRoot, ManagedApplicationBundleName)
	if err := os.Symlink(externalApplication, applicationLink); err != nil {
		t.Fatalf("create application symlink: %v", err)
	}
	host := filepath.Join(
		applicationLink,
		ManagedContentsDirectoryName,
		ManagedHelpersDirectoryName,
		ManagedHostExecutableName,
	)
	paths.ManagedApplicationRoots = []string{applicationsRoot}

	err := RegisterManaged(paths, host, ProductionIDs{Chrome: testChromeID})
	if err == nil {
		t.Fatal("symlinked application bundle was registered")
	}
}

func TestRegisterManagedAcceptsRenamedApplicationBundle(t *testing.T) {
	paths, host := managedTestLayout(t)
	renamedApplication := filepath.Join(
		filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(host)))),
		"My Renamed Helper.app",
	)
	renamedHost := filepath.Join(
		renamedApplication,
		ManagedContentsDirectoryName,
		ManagedHelpersDirectoryName,
		ManagedHostExecutableName,
	)
	if err := os.MkdirAll(filepath.Dir(renamedHost), 0o700); err != nil {
		t.Fatalf("create renamed application: %v", err)
	}
	if err := os.WriteFile(renamedHost, []byte("host"), 0o700); err != nil {
		t.Fatalf("write renamed application host: %v", err)
	}

	if err := RegisterManaged(
		paths,
		renamedHost,
		ProductionIDs{Chrome: testChromeID},
	); err != nil {
		t.Fatalf("register renamed application: %v", err)
	}
}

func TestManagedMutationRejectsManifestSymlink(t *testing.T) {
	paths, host := managedTestLayout(t)
	if err := os.MkdirAll(filepath.Dir(paths.FirefoxManifest), 0o700); err != nil {
		t.Fatalf("create Firefox manifest directory: %v", err)
	}
	target := filepath.Join(t.TempDir(), "target")
	if err := os.WriteFile(target, []byte("untouched"), 0o600); err != nil {
		t.Fatalf("write symlink target: %v", err)
	}
	if err := os.Symlink(target, paths.FirefoxManifest); err != nil {
		t.Fatalf("create Firefox manifest symlink: %v", err)
	}
	if err := RegisterManaged(paths, host, ProductionIDs{Chrome: testChromeID}); err == nil {
		t.Fatal("registration replaced a manifest symlink")
	}
	if err := UnregisterManaged(paths); err == nil {
		t.Fatal("unregistration removed a manifest symlink")
	}
	data, err := os.ReadFile(target)
	if err != nil || string(data) != "untouched" {
		t.Fatalf("symlink target changed: %q, %v", data, err)
	}
}

func TestManagedMutationRejectsManifestParentSymlink(t *testing.T) {
	paths, host := managedTestLayout(t)
	externalDirectory := t.TempDir()
	externalManifest := filepath.Join(externalDirectory, ManifestFileName)
	if err := os.WriteFile(externalManifest, []byte("untouched"), 0o600); err != nil {
		t.Fatalf("write external manifest: %v", err)
	}
	if err := os.Symlink(externalDirectory, filepath.Dir(paths.FirefoxManifest)); err != nil {
		t.Fatalf("create manifest parent symlink: %v", err)
	}

	production := ProductionIDs{Chrome: testChromeID}
	if err := RegisterManaged(paths, host, production); err == nil {
		t.Fatal("registration followed a manifest parent symlink")
	}
	if err := UnregisterManaged(paths); err == nil {
		t.Fatal("unregistration followed a manifest parent symlink")
	}
	data, err := os.ReadFile(externalManifest)
	if err != nil || string(data) != "untouched" {
		t.Fatalf("external manifest changed: %q, %v", data, err)
	}
}

func TestManagedMutationRejectsPathOutsideUserRoot(t *testing.T) {
	paths, host := managedTestLayout(t)
	paths.EdgeManifest = filepath.Join(
		filepath.Dir(paths.UserRoot),
		"outside",
		ManifestFileName,
	)
	production := ProductionIDs{Chrome: testChromeID}

	if err := RegisterManaged(paths, host, production); err == nil {
		t.Fatal("registration accepted a path outside the user root")
	}
	if err := UnregisterManaged(paths); err == nil {
		t.Fatal("unregistration accepted a path outside the user root")
	}
}

func TestManagedMutationRejectsManifestDirectory(t *testing.T) {
	paths, host := managedTestLayout(t)
	if err := os.MkdirAll(paths.FirefoxManifest, 0o700); err != nil {
		t.Fatalf("create manifest directory: %v", err)
	}
	production := ProductionIDs{Chrome: testChromeID}

	if err := RegisterManaged(paths, host, production); err == nil {
		t.Fatal("registration replaced a manifest directory")
	}
	if err := UnregisterManaged(paths); err == nil {
		t.Fatal("unregistration removed a manifest directory")
	}
	if info, err := os.Lstat(paths.FirefoxManifest); err != nil || !info.IsDir() {
		t.Fatalf("manifest directory changed: %v, %v", info, err)
	}
}

func TestUnregisterManagedRemovesLegacySupportHost(t *testing.T) {
	paths, _ := managedTestLayout(t)
	if err := os.MkdirAll(paths.ProductRoot, 0o700); err != nil {
		t.Fatalf("create legacy support directory: %v", err)
	}
	if err := os.WriteFile(paths.HostExecutable, []byte("legacy host"), 0o700); err != nil {
		t.Fatalf("write legacy support host: %v", err)
	}

	if err := UnregisterManaged(paths); err != nil {
		t.Fatalf("unregister managed helper: %v", err)
	}
	if _, err := os.Lstat(paths.HostExecutable); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("legacy support host still exists: %v", err)
	}
	if _, err := os.Lstat(paths.ProductRoot); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("empty legacy support directory still exists: %v", err)
	}
}

func TestInspectManagedRequiresCleanupForOrphanedLegacySupportHost(t *testing.T) {
	paths, host := managedTestLayout(t)
	if err := os.MkdirAll(paths.ProductRoot, 0o700); err != nil {
		t.Fatalf("create legacy support directory: %v", err)
	}
	if err := os.WriteFile(paths.HostExecutable, []byte("legacy host"), 0o700); err != nil {
		t.Fatalf("write legacy support host: %v", err)
	}

	snapshot, err := InspectManaged(
		paths,
		host,
		ProductionIDs{Chrome: testChromeID},
	)
	if err != nil {
		t.Fatalf("inspect orphaned legacy host: %v", err)
	}
	if snapshot.State != InstallationRepairRequired {
		t.Fatalf("state=%s want=%s", snapshot.State, InstallationRepairRequired)
	}
	if !snapshot.LegacySupportPresent {
		t.Fatal("orphaned legacy host was not represented in the snapshot")
	}
	if err := UnregisterManaged(paths); err != nil {
		t.Fatalf("clean orphaned legacy host: %v", err)
	}
	snapshot, err = InspectManaged(
		paths,
		host,
		ProductionIDs{Chrome: testChromeID},
	)
	if err != nil {
		t.Fatalf("inspect cleaned legacy host: %v", err)
	}
	if snapshot.State != InstallationNotInstalled {
		t.Fatalf("state=%s want=%s", snapshot.State, InstallationNotInstalled)
	}
	if snapshot.LegacySupportPresent {
		t.Fatal("legacy support remains present after cleanup")
	}
}

func TestRegisterManagedMigratesLegacySupportHost(t *testing.T) {
	paths, host := managedTestLayout(t)
	if err := os.MkdirAll(paths.ProductRoot, 0o700); err != nil {
		t.Fatalf("create legacy support directory: %v", err)
	}
	if err := os.WriteFile(paths.HostExecutable, []byte("legacy host"), 0o700); err != nil {
		t.Fatalf("write legacy support host: %v", err)
	}
	writeManagedManifests(t, paths, paths.HostExecutable)
	production := ProductionIDs{Chrome: testChromeID, Edge: testEdgeID}

	if err := RegisterManaged(paths, host, production); err != nil {
		t.Fatalf("migrate legacy registration: %v", err)
	}
	snapshot, err := InspectManaged(paths, host, production)
	if err != nil {
		t.Fatalf("inspect migrated registration: %v", err)
	}
	if snapshot.State != InstallationReady || snapshot.LegacySupportPresent {
		t.Fatalf("unexpected migrated snapshot: %+v", snapshot)
	}
	if _, err := os.Lstat(paths.HostExecutable); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("legacy support host still exists: %v", err)
	}
}

func TestUnregisterManagedRejectsLegacySupportSymlink(t *testing.T) {
	paths, _ := managedTestLayout(t)
	externalDirectory := t.TempDir()
	externalHost := filepath.Join(externalDirectory, filepath.Base(paths.HostExecutable))
	if err := os.WriteFile(externalHost, []byte("untouched"), 0o700); err != nil {
		t.Fatalf("write external legacy host: %v", err)
	}
	if err := os.Symlink(externalDirectory, paths.ProductRoot); err != nil {
		t.Fatalf("create legacy support symlink: %v", err)
	}

	if err := UnregisterManaged(paths); err == nil {
		t.Fatal("unregistration followed a legacy support symlink")
	}
	data, err := os.ReadFile(externalHost)
	if err != nil || string(data) != "untouched" {
		t.Fatalf("external legacy host changed: %q, %v", data, err)
	}
}

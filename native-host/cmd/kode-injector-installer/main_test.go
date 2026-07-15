package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/maximtop/kode-injector/native-host/internal/install"
)

const testProductionChromeID = "abcdefghijklmnopabcdefghijklmnop"

type applicationTestLayout struct {
	dependencies dependencies
	paths        install.Paths
	hostPath     string
	stdout       *bytes.Buffer
	stderr       *bytes.Buffer
}

func newApplicationTestLayout(t *testing.T) applicationTestLayout {
	t.Helper()
	root := t.TempDir()
	hostPath := filepath.Join(
		root,
		"Kode Injector Helper.app",
		"Contents",
		"Helpers",
		"kode-injector-native",
	)
	if err := os.MkdirAll(filepath.Dir(hostPath), 0o700); err != nil {
		t.Fatalf("create host directory: %v", err)
	}
	if err := os.WriteFile(hostPath, []byte("host"), 0o700); err != nil {
		t.Fatalf("write host: %v", err)
	}
	paths := install.Paths{
		UserRoot:                root,
		ProductRoot:             filepath.Join(root, "legacy-support"),
		HostExecutable:          filepath.Join(root, "legacy-support", "kode-injector-native"),
		ManagedApplicationRoots: []string{root},
		FirefoxManifest:         filepath.Join(root, "firefox", install.ManifestFileName),
		ChromeManifest:          filepath.Join(root, "chrome", install.ManifestFileName),
		EdgeManifest:            filepath.Join(root, "edge", install.ManifestFileName),
	}
	stdout := new(bytes.Buffer)
	stderr := new(bytes.Buffer)
	return applicationTestLayout{
		dependencies: dependencies{
			stdout: stdout,
			stderr: stderr,
			resolvePaths: func() (install.Paths, error) {
				return paths, nil
			},
			resolveManagedHostPath: func() (string, error) {
				return hostPath, nil
			},
			inspectManaged:    install.InspectManaged,
			registerManaged:   install.RegisterManaged,
			unregisterManaged: install.UnregisterManaged,
			productionIDs: install.ProductionIDs{
				Chrome: testProductionChromeID,
			},
			packageVersion: "0.8.2",
		},
		paths:    paths,
		hostPath: hostPath,
		stdout:   stdout,
		stderr:   stderr,
	}
}

func decodeLifecycleResponse(t *testing.T, output *bytes.Buffer) LifecycleResponse {
	t.Helper()
	decoder := json.NewDecoder(output)
	decoder.DisallowUnknownFields()
	var response LifecycleResponse
	if err := decoder.Decode(&response); err != nil {
		t.Fatalf("decode lifecycle response: %v", err)
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		t.Fatalf("stdout contained more than one JSON value: %v", err)
	}
	return response
}

func TestApplicationStatusWritesOneJSONResponse(t *testing.T) {
	layout := newApplicationTestLayout(t)
	exit := runCLI(
		[]string{"application", "status", "--json"},
		layout.dependencies,
	)
	if exit != 0 {
		t.Fatalf("exit=%d stderr=%q", exit, layout.stderr.String())
	}
	response := decodeLifecycleResponse(t, layout.stdout)
	if response.ContractVersion != lifecycleContractVersion ||
		response.Action != ActionStatus ||
		!response.Success ||
		response.Installation == nil ||
		response.Installation.State != install.InstallationNotInstalled {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestApplicationInstallAndUninstallEnforcePostconditions(t *testing.T) {
	layout := newApplicationTestLayout(t)
	exit := runCLI(
		[]string{"application", "install", "--json"},
		layout.dependencies,
	)
	if exit != 0 {
		t.Fatalf("install exit=%d stderr=%q", exit, layout.stderr.String())
	}
	response := decodeLifecycleResponse(t, layout.stdout)
	if !response.Success || response.Installation == nil ||
		response.Installation.State != install.InstallationReady {
		t.Fatalf("unexpected install response: %+v", response)
	}

	layout.stdout.Reset()
	exit = runCLI(
		[]string{"application", "uninstall", "--json"},
		layout.dependencies,
	)
	if exit != 0 {
		t.Fatalf("uninstall exit=%d stderr=%q", exit, layout.stderr.String())
	}
	response = decodeLifecycleResponse(t, layout.stdout)
	if !response.Success || response.Installation == nil ||
		response.Installation.State != install.InstallationNotInstalled {
		t.Fatalf("unexpected uninstall response: %+v", response)
	}
}

func TestApplicationUninstallRecoversWhenBundledHostIsInvalid(t *testing.T) {
	layout := newApplicationTestLayout(t)
	if err := install.RegisterManaged(
		layout.paths,
		layout.hostPath,
		layout.dependencies.productionIDs,
	); err != nil {
		t.Fatalf("arrange managed registration: %v", err)
	}
	if err := os.Chmod(layout.hostPath, 0o600); err != nil {
		t.Fatalf("invalidate bundled host: %v", err)
	}

	exit := runCLI(
		[]string{"application", "uninstall", "--json"},
		layout.dependencies,
	)
	if exit != 0 {
		t.Fatalf("uninstall exit=%d stderr=%q", exit, layout.stderr.String())
	}
	response := decodeLifecycleResponse(t, layout.stdout)
	if !response.Success || response.Installation == nil ||
		response.Installation.State != install.InstallationNotInstalled ||
		response.Installation.Host.State != install.ManagedHostInvalid {
		t.Fatalf("unexpected damaged-host uninstall response: %+v", response)
	}
}

func TestApplicationRejectsMalformedArgumentsWithStructuredFailure(t *testing.T) {
	layout := newApplicationTestLayout(t)
	exit := runCLI(
		[]string{"application", "install", "--json", "--host=/tmp/other"},
		layout.dependencies,
	)
	if exit == 0 {
		t.Fatal("malformed application command succeeded")
	}
	response := decodeLifecycleResponse(t, layout.stdout)
	if response.Success || response.Action != ActionInstall || response.Error == nil ||
		response.Error.Code != ErrorInstallFailed {
		t.Fatalf("unexpected failure response: %+v", response)
	}
}

func TestApplicationPathFailureIsStructuredAndBounded(t *testing.T) {
	layout := newApplicationTestLayout(t)
	layout.dependencies.resolvePaths = func() (install.Paths, error) {
		return install.Paths{}, errors.New(strings.Repeat("x", maximumLifecycleErrorLength+100))
	}
	exit := runCLI(
		[]string{"application", "status", "--json"},
		layout.dependencies,
	)
	if exit == 0 {
		t.Fatal("path failure succeeded")
	}
	response := decodeLifecycleResponse(t, layout.stdout)
	if response.Success || response.Error == nil ||
		response.Error.Code != ErrorPathResolutionFailed {
		t.Fatalf("unexpected path failure: %+v", response)
	}
	if len([]rune(response.Error.Message)) > maximumLifecycleErrorLength {
		t.Fatalf("error length=%d", len([]rune(response.Error.Message)))
	}
}

func TestApplicationPostconditionFailureReturnsNonzero(t *testing.T) {
	layout := newApplicationTestLayout(t)
	layout.dependencies.registerManaged = func(
		install.Paths,
		string,
		install.ProductionIDs,
	) error {
		return nil
	}
	exit := runCLI(
		[]string{"application", "install", "--json"},
		layout.dependencies,
	)
	if exit == 0 {
		t.Fatal("failed install postcondition returned success")
	}
	response := decodeLifecycleResponse(t, layout.stdout)
	if response.Success || response.Error == nil ||
		response.Error.Code != ErrorPostconditionFailed {
		t.Fatalf("unexpected postcondition failure: %+v", response)
	}
}

func TestApplicationUnknownActionDoesNotEmitInvalidContract(t *testing.T) {
	layout := newApplicationTestLayout(t)
	exit := runCLI(
		[]string{"application", "remove-everything", "--json"},
		layout.dependencies,
	)
	if exit == 0 {
		t.Fatal("unknown application action succeeded")
	}
	if layout.stdout.Len() != 0 {
		t.Fatalf("unknown action emitted invalid lifecycle JSON: %q", layout.stdout.String())
	}
	if !strings.Contains(layout.stderr.String(), "unknown application action") {
		t.Fatalf("stderr=%q", layout.stderr.String())
	}
}

func TestLegacyDevelopmentStillRequiresExplicitConfirmation(t *testing.T) {
	idsPath := filepath.Join(t.TempDir(), "ids.json")
	if err := os.WriteFile(
		idsPath,
		[]byte(`{"chrome":["abcdefghijklmnopabcdefghijklmnop"],"edge":[]}`),
		0o600,
	); err != nil {
		t.Fatalf("write development IDs: %v", err)
	}
	err := runInstall(
		[]string{"--ids", idsPath},
		install.Paths{},
		true,
	)
	if err == nil || !strings.Contains(err.Error(), "rerun with --confirm") {
		t.Fatalf("unexpected development result: %v", err)
	}
}

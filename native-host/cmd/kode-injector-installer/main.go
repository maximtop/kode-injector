package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/maximtop/kode-injector/native-host/internal/install"
)

var (
	// Production defaults are injected by scripts/native-host/package.ts.
	defaultChromeID       = ""
	defaultEdgeID         = ""
	defaultPackageVersion = "0.0.0-dev"
)

const (
	lifecycleContractVersion    = 1
	maximumLifecycleErrorLength = 4096
	applicationNamespace        = "application"
	jsonOutputFlag              = "--json"
)

type LifecycleAction string

const (
	ActionStatus    LifecycleAction = "status"
	ActionInstall   LifecycleAction = "install"
	ActionUninstall LifecycleAction = "uninstall"
)

type LifecycleErrorCode string

const (
	ErrorPathResolutionFailed LifecycleErrorCode = "pathResolutionFailed"
	ErrorStatusFailed         LifecycleErrorCode = "statusFailed"
	ErrorInstallFailed        LifecycleErrorCode = "installFailed"
	ErrorUninstallFailed      LifecycleErrorCode = "uninstallFailed"
	ErrorPostconditionFailed  LifecycleErrorCode = "postconditionFailed"
)

type LifecycleError struct {
	Code    LifecycleErrorCode `json:"code"`
	Message string             `json:"message"`
}

type LifecycleResponse struct {
	ContractVersion int                           `json:"contractVersion"`
	Action          LifecycleAction               `json:"action"`
	Success         bool                          `json:"success"`
	PackageVersion  string                        `json:"packageVersion"`
	Installation    *install.InstallationSnapshot `json:"installation,omitempty"`
	Error           *LifecycleError               `json:"error,omitempty"`
}

type dependencies struct {
	stdout                 io.Writer
	stderr                 io.Writer
	resolvePaths           func() (install.Paths, error)
	resolveManagedHostPath func() (string, error)
	inspectManaged         func(install.Paths, string, install.ProductionIDs) (install.InstallationSnapshot, error)
	registerManaged        func(install.Paths, string, install.ProductionIDs) error
	unregisterManaged      func(install.Paths) error
	productionIDs          install.ProductionIDs
	packageVersion         string
}

func main() {
	os.Exit(runCLI(os.Args[1:], defaultDependencies()))
}

func defaultDependencies() dependencies {
	return dependencies{
		stdout:                 os.Stdout,
		stderr:                 os.Stderr,
		resolvePaths:           install.DefaultPaths,
		resolveManagedHostPath: managedHostPath,
		inspectManaged:         install.InspectManaged,
		registerManaged:        install.RegisterManaged,
		unregisterManaged:      install.UnregisterManaged,
		productionIDs: install.ProductionIDs{
			Chrome: defaultChromeID,
			Edge:   defaultEdgeID,
		},
		packageVersion: defaultPackageVersion,
	}
}

func runCLI(arguments []string, deps dependencies) int {
	if len(arguments) > 0 && arguments[0] == applicationNamespace {
		return runApplicationCLI(arguments[1:], deps)
	}
	if err := run(arguments); err != nil {
		_, _ = fmt.Fprintln(deps.stderr, err)
		return 1
	}
	return 0
}

func runApplicationCLI(arguments []string, deps dependencies) int {
	if len(arguments) == 0 {
		_, _ = fmt.Fprintln(deps.stderr, "application action is required")
		return 1
	}
	action, valid := parseLifecycleAction(arguments[0])
	if !valid {
		_, _ = fmt.Fprintf(deps.stderr, "unknown application action %q\n", arguments[0])
		return 1
	}
	if len(arguments) != 2 || arguments[1] != jsonOutputFlag {
		return writeLifecycleResponse(deps, failureResponse(
			action,
			deps.packageVersion,
			errorCodeForAction(action),
			"application actions accept only --json",
		))
	}
	return runApplication(action, deps)
}

func parseLifecycleAction(value string) (LifecycleAction, bool) {
	switch LifecycleAction(value) {
	case ActionStatus:
		return ActionStatus, true
	case ActionInstall:
		return ActionInstall, true
	case ActionUninstall:
		return ActionUninstall, true
	default:
		return "", false
	}
}

func runApplication(action LifecycleAction, deps dependencies) int {
	response := executeApplicationAction(action, deps)
	return writeLifecycleResponse(deps, response)
}

func executeApplicationAction(action LifecycleAction, deps dependencies) LifecycleResponse {
	paths, err := deps.resolvePaths()
	if err != nil {
		return failureResponse(
			action,
			deps.packageVersion,
			ErrorPathResolutionFailed,
			err.Error(),
		)
	}
	hostPath, err := deps.resolveManagedHostPath()
	if err != nil {
		return failureResponse(
			action,
			deps.packageVersion,
			ErrorPathResolutionFailed,
			err.Error(),
		)
	}

	switch action {
	case ActionStatus:
		return inspectApplication(action, deps, paths, hostPath, ErrorStatusFailed)
	case ActionInstall:
		if err := deps.registerManaged(paths, hostPath, deps.productionIDs); err != nil {
			return failureResponse(
				action,
				deps.packageVersion,
				ErrorInstallFailed,
				err.Error(),
			)
		}
		return inspectApplicationPostcondition(
			action,
			deps,
			paths,
			hostPath,
			install.InstallationReady,
		)
	case ActionUninstall:
		if err := deps.unregisterManaged(paths); err != nil {
			return failureResponse(
				action,
				deps.packageVersion,
				ErrorUninstallFailed,
				err.Error(),
			)
		}
		return inspectApplicationPostcondition(
			action,
			deps,
			paths,
			hostPath,
			install.InstallationNotInstalled,
		)
	default:
		return failureResponse(
			action,
			deps.packageVersion,
			ErrorStatusFailed,
			"unsupported application action",
		)
	}
}

func inspectApplication(
	action LifecycleAction,
	deps dependencies,
	paths install.Paths,
	hostPath string,
	errorCode LifecycleErrorCode,
) LifecycleResponse {
	snapshot, err := deps.inspectManaged(paths, hostPath, deps.productionIDs)
	if err != nil {
		return failureResponse(
			action,
			deps.packageVersion,
			errorCode,
			err.Error(),
		)
	}
	return successResponse(action, deps.packageVersion, snapshot)
}

func inspectApplicationPostcondition(
	action LifecycleAction,
	deps dependencies,
	paths install.Paths,
	hostPath string,
	expected install.InstallationState,
) LifecycleResponse {
	snapshot, err := deps.inspectManaged(paths, hostPath, deps.productionIDs)
	if err != nil {
		return failureResponse(
			action,
			deps.packageVersion,
			ErrorPostconditionFailed,
			err.Error(),
		)
	}
	if snapshot.State != expected {
		return failureResponse(
			action,
			deps.packageVersion,
			ErrorPostconditionFailed,
			fmt.Sprintf("installation state is %s, expected %s", snapshot.State, expected),
		)
	}
	return successResponse(action, deps.packageVersion, snapshot)
}

func successResponse(
	action LifecycleAction,
	packageVersion string,
	snapshot install.InstallationSnapshot,
) LifecycleResponse {
	return LifecycleResponse{
		ContractVersion: lifecycleContractVersion,
		Action:          action,
		Success:         true,
		PackageVersion:  packageVersion,
		Installation:    &snapshot,
	}
}

func failureResponse(
	action LifecycleAction,
	packageVersion string,
	code LifecycleErrorCode,
	message string,
) LifecycleResponse {
	return LifecycleResponse{
		ContractVersion: lifecycleContractVersion,
		Action:          action,
		Success:         false,
		PackageVersion:  packageVersion,
		Error: &LifecycleError{
			Code:    code,
			Message: boundedLifecycleMessage(message),
		},
	}
}

func boundedLifecycleMessage(message string) string {
	characters := []rune(message)
	if len(characters) <= maximumLifecycleErrorLength {
		return message
	}
	return string(characters[:maximumLifecycleErrorLength])
}

func errorCodeForAction(action LifecycleAction) LifecycleErrorCode {
	switch action {
	case ActionInstall:
		return ErrorInstallFailed
	case ActionUninstall:
		return ErrorUninstallFailed
	default:
		return ErrorStatusFailed
	}
}

func writeLifecycleResponse(deps dependencies, response LifecycleResponse) int {
	if err := json.NewEncoder(deps.stdout).Encode(response); err != nil {
		_, _ = fmt.Fprintln(deps.stderr, boundedLifecycleMessage(err.Error()))
		return 1
	}
	if response.Success {
		return 0
	}
	return 1
}

func run(arguments []string) error {
	if len(arguments) == 0 {
		return errors.New("usage: kode-injector-installer install|development|uninstall")
	}
	paths, err := install.DefaultPaths()
	if err != nil {
		return err
	}
	switch arguments[0] {
	case "install":
		return runInstall(arguments[1:], paths, false)
	case "development":
		return runInstall(arguments[1:], paths, true)
	case "uninstall":
		if len(arguments) != 1 {
			return errors.New("uninstall does not accept arguments")
		}
		return install.Uninstall(paths)
	default:
		return fmt.Errorf("unknown installer action %q", arguments[0])
	}
}

func runInstall(arguments []string, paths install.Paths, development bool) error {
	flags := flag.NewFlagSet("install", flag.ContinueOnError)
	chromeID := flags.String("chrome-id", defaultChromeID, "Chrome Web Store extension ID")
	edgeDefault := defaultEdgeID
	if value := os.Getenv("KODE_INJECTOR_EDGE_ID"); value != "" {
		edgeDefault = value
	}
	edgeID := flags.String("edge-id", edgeDefault, "Edge Add-ons extension ID")
	hostSource := flags.String("host", siblingHostPath(), "path to kode-injector-native")
	idsPath := flags.String("ids", "native-host/dev-extension-ids.json", "development extension ID file")
	confirm := flags.Bool("confirm", false, "confirm development origins")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	config := install.Config{
		Paths:      paths,
		HostSource: *hostSource,
		ProductionIDs: install.ProductionIDs{
			Chrome: *chromeID,
			Edge:   *edgeID,
		},
	}
	if development {
		ids, err := install.LoadDevelopmentIDs(*idsPath)
		if err != nil {
			return err
		}
		_, _ = fmt.Fprintln(os.Stdout, "Development origins to authorize:")
		for _, origin := range install.DevelopmentOrigins(ids) {
			_, _ = fmt.Fprintln(os.Stdout, origin)
		}
		if !*confirm {
			return errors.New("review the origins and rerun with --confirm")
		}
		config.DevelopmentIDs = ids
	}
	return install.Install(config)
}

func siblingHostPath() string {
	hostPath, err := managedHostPath()
	if err != nil {
		return "kode-injector-native"
	}
	return hostPath
}

func managedHostPath() (string, error) {
	executable, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("resolve installer executable: %w", err)
	}
	name := "kode-injector-native"
	if filepath.Ext(executable) == ".exe" {
		name += ".exe"
	}
	return filepath.Join(filepath.Dir(executable), name), nil
}

package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/maximtop/kode-injector/native-host/internal/install"
)

var (
	// Production defaults are injected by scripts/native-host/package.ts.
	defaultChromeID = ""
	defaultEdgeID   = ""
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
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
	executable, err := os.Executable()
	if err != nil {
		return "kode-injector-native"
	}
	name := "kode-injector-native"
	if filepath.Ext(executable) == ".exe" {
		name += ".exe"
	}
	return filepath.Join(filepath.Dir(executable), name)
}

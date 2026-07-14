package main

import (
	"fmt"
	"os"

	"gitlab.com/maximtop/kode-injector/native-host/internal/protocol"
	"gitlab.com/maximtop/kode-injector/native-host/internal/source"
)

var hostVersion = "0.0.0-dev"

func main() {
	server := protocol.NewServer(hostVersion, os.Stdin, os.Stdout, os.Stderr)
	server.SetReader(source.NewReader())
	if err := server.Serve(); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "native host stopped: %v\n", err)
		os.Exit(1)
	}
}

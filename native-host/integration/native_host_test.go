package integration

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/maximtop/kode-injector/native-host/internal/protocol"
)

func TestNativeHostSubprocessPingAndRead(t *testing.T) {
	commandPath := buildHost(t)
	fixture := filepath.Join(t.TempDir(), "source.js")
	content := bytes.Repeat([]byte("const value = '✓';\n"), 40000)
	if err := os.WriteFile(fixture, content, 0o600); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	command := exec.Command(commandPath)
	stdin, err := command.StdinPipe()
	if err != nil {
		t.Fatalf("stdin pipe: %v", err)
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		t.Fatalf("stdout pipe: %v", err)
	}
	stderr := new(bytes.Buffer)
	command.Stderr = stderr
	if err := command.Start(); err != nil {
		t.Fatalf("start host: %v", err)
	}

	writeRequest(t, stdin, protocol.Request{ProtocolVersion: 1, RequestID: "ping_1", Operation: protocol.OperationPing})
	var status protocol.StatusResponse
	readResponse(t, stdout, &status)
	if !status.OK || status.RequestID != "ping_1" {
		t.Fatalf("unexpected status: %+v", status)
	}

	writeRequest(t, stdin, protocol.Request{
		ProtocolVersion: 1,
		RequestID:       "read_1",
		Operation:       protocol.OperationReadFile,
		FileURL:         "file://" + filepath.ToSlash(fixture),
	})
	var start protocol.ReadStartResponse
	readResponse(t, stdout, &start)
	reconstructed := new(bytes.Buffer)
	for range start.ChunkCount {
		var chunk protocol.ReadChunkResponse
		readResponse(t, stdout, &chunk)
		decoded, decodeErr := base64.StdEncoding.DecodeString(chunk.Data)
		if decodeErr != nil {
			t.Fatalf("decode chunk: %v", decodeErr)
		}
		reconstructed.Write(decoded)
	}
	var complete protocol.ReadCompleteResponse
	readResponse(t, stdout, &complete)
	if !bytes.Equal(reconstructed.Bytes(), content) {
		t.Fatal("subprocess changed file content")
	}

	if err := stdin.Close(); err != nil {
		t.Fatalf("close stdin: %v", err)
	}
	if err := command.Wait(); err != nil {
		t.Fatalf("wait for host: %v; stderr=%s", err, stderr)
	}
}

func TestNativeHostRecoversAfterInvalidJSON(t *testing.T) {
	commandPath := buildHost(t)
	command := exec.Command(commandPath)
	stdin, _ := command.StdinPipe()
	stdout, _ := command.StdoutPipe()
	if err := command.Start(); err != nil {
		t.Fatalf("start host: %v", err)
	}
	writeRaw(t, stdin, []byte(`{"bad":`))
	var nativeError protocol.ErrorResponse
	readResponse(t, stdout, &nativeError)
	if nativeError.Error.Code != protocol.ErrorInvalidMessage {
		t.Fatalf("unexpected code: %s", nativeError.Error.Code)
	}
	writeRequest(t, stdin, protocol.Request{ProtocolVersion: 1, RequestID: "ping_2", Operation: protocol.OperationPing})
	var status protocol.StatusResponse
	readResponse(t, stdout, &status)
	if status.RequestID != "ping_2" {
		t.Fatalf("host did not recover: %+v", status)
	}
	_ = stdin.Close()
	if err := command.Wait(); err != nil {
		t.Fatalf("wait for host: %v", err)
	}
}

func buildHost(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "kode-injector-native")
	command := exec.Command("go", "build", "-o", path, "../cmd/kode-injector-native")
	command.Dir = filepath.Join(".")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("build host: %v\n%s", err, output)
	}
	return path
}

func writeRequest(t *testing.T, writer io.Writer, request protocol.Request) {
	t.Helper()
	data, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	writeRaw(t, writer, data)
}

func writeRaw(t *testing.T, writer io.Writer, data []byte) {
	t.Helper()
	if err := binary.Write(writer, binary.LittleEndian, uint32(len(data))); err != nil {
		t.Fatalf("write size: %v", err)
	}
	if _, err := writer.Write(data); err != nil {
		t.Fatalf("write body: %v", err)
	}
}

func readResponse(t *testing.T, reader io.Reader, target any) {
	t.Helper()
	var size uint32
	if err := binary.Read(reader, binary.LittleEndian, &size); err != nil {
		t.Fatalf("read size: %v", err)
	}
	if size >= protocol.MaxResponseBytes {
		t.Fatalf("response too large: %d", size)
	}
	data := make([]byte, size)
	if _, err := io.ReadFull(reader, data); err != nil {
		t.Fatalf("read response: %v", err)
	}
	if err := json.Unmarshal(data, target); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

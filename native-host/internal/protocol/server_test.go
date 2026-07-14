package protocol

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"strconv"
	"testing"
)

func TestServerPing(t *testing.T) {
	input := new(bytes.Buffer)
	if err := WriteFrame(input, Request{
		ProtocolVersion: ProtocolVersion,
		RequestID:       "ping_1",
		Operation:       OperationPing,
	}); err != nil {
		t.Fatalf("prepare request: %v", err)
	}
	output := new(bytes.Buffer)
	server := NewServer("0.8.3", input, output, new(bytes.Buffer))
	if err := server.Serve(); err != nil {
		t.Fatalf("serve: %v", err)
	}
	frame, err := ReadFrame(output)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	var response StatusResponse
	if err := json.Unmarshal(frame, &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.OK || response.Type != ResponseStatus || response.RequestID != "ping_1" || response.HostVersion != "0.8.3" {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestServerRejectsUnknownFields(t *testing.T) {
	response := runRawRequest(t, `{"protocolVersion":1,"requestId":"ping_1","operation":"ping","extra":true}`)
	if response.Error.Code != ErrorInvalidMessage || response.RequestID != nil {
		t.Fatalf("unexpected error response: %+v", response)
	}
}

func TestServerRejectsInvalidRequestID(t *testing.T) {
	response := runRawRequest(t, `{"protocolVersion":1,"requestId":"bad id","operation":"ping"}`)
	if response.Error.Code != ErrorInvalidRequestID {
		t.Fatalf("unexpected code: %s", response.Error.Code)
	}
}

func TestServerRejectsUnsupportedProtocol(t *testing.T) {
	response := runRawRequest(t, `{"protocolVersion":2,"requestId":"ping_1","operation":"ping"}`)
	if response.Error.Code != ErrorUnsupportedProtocol {
		t.Fatalf("unexpected code: %s", response.Error.Code)
	}
}

func TestServerRejectsUnsupportedOperation(t *testing.T) {
	response := runRawRequest(t, `{"protocolVersion":1,"requestId":"ping_1","operation":"other"}`)
	if response.Error.Code != ErrorUnsupportedOperation {
		t.Fatalf("unexpected code: %s", response.Error.Code)
	}
}

func TestServerReadFileSequences(t *testing.T) {
	for _, size := range []int{0, 1, RawChunkBytes, RawChunkBytes + 1, MaxFileBytes} {
		t.Run(strconv.Itoa(size), func(t *testing.T) {
			content := bytes.Repeat([]byte{'a'}, size)
			input := new(bytes.Buffer)
			if err := WriteFrame(input, Request{
				ProtocolVersion: ProtocolVersion,
				RequestID:       "read_1",
				Operation:       OperationReadFile,
				FileURL:         "file:///tmp/source.js",
			}); err != nil {
				t.Fatalf("prepare request: %v", err)
			}
			output := new(bytes.Buffer)
			server := NewServer("0.8.3", input, output, new(bytes.Buffer))
			server.SetReader(fakeReader{content: content})
			if err := server.Serve(); err != nil {
				t.Fatalf("serve: %v", err)
			}

			var start ReadStartResponse
			decodeFrame(t, output, &start)
			expectedChunks := (size + RawChunkBytes - 1) / RawChunkBytes
			if start.ChunkCount != expectedChunks || start.TotalBytes != size {
				t.Fatalf("unexpected start: %+v", start)
			}
			reconstructed := new(bytes.Buffer)
			for index := 0; index < expectedChunks; index++ {
				var chunk ReadChunkResponse
				frame := decodeFrame(t, output, &chunk)
				if len(frame) >= MaxResponseBytes {
					t.Fatal("response exceeded browser limit")
				}
				decoded, err := base64.StdEncoding.DecodeString(chunk.Data)
				if err != nil {
					t.Fatalf("decode chunk: %v", err)
				}
				if chunk.ChunkIndex != index {
					t.Fatalf("chunk index %d", chunk.ChunkIndex)
				}
				reconstructed.Write(decoded)
			}
			var complete ReadCompleteResponse
			decodeFrame(t, output, &complete)
			if complete.TotalBytes != size || complete.ChunkCount != expectedChunks {
				t.Fatal("completion metadata mismatch")
			}
			if !bytes.Equal(reconstructed.Bytes(), content) {
				t.Fatal("reconstructed content changed")
			}
		})
	}
}

type fakeReader struct {
	content []byte
	code    ErrorCode
}

func (r fakeReader) Read(string) ([]byte, ErrorCode) {
	return r.content, r.code
}

func decodeFrame(t *testing.T, input *bytes.Buffer, target any) []byte {
	t.Helper()
	var size uint32
	if err := binary.Read(input, binary.LittleEndian, &size); err != nil {
		t.Fatalf("read frame size: %v", err)
	}
	frame := make([]byte, size)
	if _, err := input.Read(frame); err != nil {
		t.Fatalf("read frame body: %v", err)
	}
	if err := json.Unmarshal(frame, target); err != nil {
		t.Fatalf("decode frame: %v", err)
	}
	return frame
}

func runRawRequest(t *testing.T, raw string) ErrorResponse {
	t.Helper()
	input := new(bytes.Buffer)
	if err := writeRawFrame(input, []byte(raw)); err != nil {
		t.Fatalf("prepare frame: %v", err)
	}
	output := new(bytes.Buffer)
	server := NewServer("0.8.3", input, output, new(bytes.Buffer))
	if err := server.Serve(); err != nil {
		t.Fatalf("serve: %v", err)
	}
	frame, err := ReadFrame(output)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	var response ErrorResponse
	if err := json.Unmarshal(frame, &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return response
}

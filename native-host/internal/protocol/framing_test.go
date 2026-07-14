package protocol

import (
	"bytes"
	"encoding/binary"
	"errors"
	"testing"
)

func TestReadFrameRejectsOversizedRequest(t *testing.T) {
	input := new(bytes.Buffer)
	_ = binary.Write(input, binary.LittleEndian, uint32(MaxRequestBytes+1))
	_, err := ReadFrame(input)
	if !errors.Is(err, ErrFrameTooLarge) {
		t.Fatalf("expected ErrFrameTooLarge, got %v", err)
	}
}

func TestWriteFramePrefixesCompactJSON(t *testing.T) {
	output := new(bytes.Buffer)
	err := WriteFrame(output, StatusResponse{
		ProtocolVersion: 1, RequestID: "ping_1", Type: ResponseStatus, OK: true, HostVersion: "0.8.3",
	})
	if err != nil {
		t.Fatalf("write frame: %v", err)
	}
	length := binary.LittleEndian.Uint32(output.Bytes()[:4])
	if int(length) != output.Len()-4 {
		t.Fatal("invalid frame length")
	}
}

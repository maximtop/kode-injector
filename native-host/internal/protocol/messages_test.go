package protocol

import (
	"encoding/json"
	"testing"
)

func TestRequestJSONUsesProtocolV1(t *testing.T) {
	request := Request{ProtocolVersion: ProtocolVersion, RequestID: "request_1", Operation: OperationPing}
	data, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	if string(data) != `{"protocolVersion":1,"requestId":"request_1","operation":"ping"}` {
		t.Fatalf("unexpected request JSON: %s", data)
	}
}

func TestErrorCodesAreStable(t *testing.T) {
	if ErrorFileTooLarge != "FILE_TOO_LARGE" || ErrorInvalidUTF8 != "INVALID_UTF8" {
		t.Fatal("native error codes changed")
	}
}

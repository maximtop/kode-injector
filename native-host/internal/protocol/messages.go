package protocol

const (
	ProtocolVersion  = 1
	HostName         = "dev.maximtop.kode_injector"
	MaxRequestBytes  = 64 * 1024
	MaxFileBytes     = 5 * 1024 * 1024
	RawChunkBytes    = 512 * 1024
	MaxResponseBytes = 1024 * 1024
)

type Operation string

const (
	OperationPing     Operation = "ping"
	OperationReadFile Operation = "readFile"
)

type ResponseType string

const (
	ResponseStatus       ResponseType = "status"
	ResponseReadStart    ResponseType = "readStart"
	ResponseReadChunk    ResponseType = "readChunk"
	ResponseReadComplete ResponseType = "readComplete"
	ResponseError        ResponseType = "error"
)

type ErrorCode string

const (
	ErrorInvalidFrame         ErrorCode = "INVALID_FRAME"
	ErrorMessageTooLarge      ErrorCode = "MESSAGE_TOO_LARGE"
	ErrorInvalidMessage       ErrorCode = "INVALID_MESSAGE"
	ErrorInvalidRequestID     ErrorCode = "INVALID_REQUEST_ID"
	ErrorUnsupportedProtocol  ErrorCode = "UNSUPPORTED_PROTOCOL"
	ErrorUnsupportedOperation ErrorCode = "UNSUPPORTED_OPERATION"
	ErrorInvalidFileURL       ErrorCode = "INVALID_FILE_URL"
	ErrorRemoteFileURL        ErrorCode = "REMOTE_FILE_URL"
	ErrorFileNotFound         ErrorCode = "FILE_NOT_FOUND"
	ErrorNotRegularFile       ErrorCode = "NOT_REGULAR_FILE"
	ErrorFileTooLarge         ErrorCode = "FILE_TOO_LARGE"
	ErrorInvalidUTF8          ErrorCode = "INVALID_UTF8"
	ErrorReadFailed           ErrorCode = "READ_FAILED"
	ErrorInternal             ErrorCode = "INTERNAL_ERROR"
)

type Request struct {
	ProtocolVersion int       `json:"protocolVersion"`
	RequestID       string    `json:"requestId"`
	Operation       Operation `json:"operation"`
	FileURL         string    `json:"fileUrl,omitempty"`
}

type StatusResponse struct {
	ProtocolVersion int          `json:"protocolVersion"`
	RequestID       string       `json:"requestId"`
	Type            ResponseType `json:"type"`
	OK              bool         `json:"ok"`
	HostVersion     string       `json:"hostVersion"`
}

type ReadStartResponse struct {
	ProtocolVersion int          `json:"protocolVersion"`
	RequestID       string       `json:"requestId"`
	Type            ResponseType `json:"type"`
	OK              bool         `json:"ok"`
	TotalBytes      int          `json:"totalBytes"`
	ChunkCount      int          `json:"chunkCount"`
}

type ReadChunkResponse struct {
	ProtocolVersion int          `json:"protocolVersion"`
	RequestID       string       `json:"requestId"`
	Type            ResponseType `json:"type"`
	OK              bool         `json:"ok"`
	ChunkIndex      int          `json:"chunkIndex"`
	Data            string       `json:"data"`
}

type ReadCompleteResponse struct {
	ProtocolVersion int          `json:"protocolVersion"`
	RequestID       string       `json:"requestId"`
	Type            ResponseType `json:"type"`
	OK              bool         `json:"ok"`
	TotalBytes      int          `json:"totalBytes"`
	ChunkCount      int          `json:"chunkCount"`
}

type ErrorDetail struct {
	Code ErrorCode `json:"code"`
}

type ErrorResponse struct {
	ProtocolVersion int          `json:"protocolVersion"`
	RequestID       *string      `json:"requestId"`
	Type            ResponseType `json:"type"`
	OK              bool         `json:"ok"`
	Error           ErrorDetail  `json:"error"`
}

package protocol

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
)

var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

type Server struct {
	hostVersion string
	input       io.Reader
	output      io.Writer
	diagnostics io.Writer
	reader      FileReader
}

type FileReader interface {
	Read(rawURL string) ([]byte, ErrorCode)
}

func NewServer(hostVersion string, input io.Reader, output io.Writer, diagnostics io.Writer) *Server {
	return &Server{
		hostVersion: hostVersion,
		input:       input,
		output:      output,
		diagnostics: diagnostics,
	}
}

func (s *Server) SetReader(reader FileReader) {
	s.reader = reader
}

func (s *Server) Serve() error {
	for {
		frame, err := ReadFrame(s.input)
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			s.log("invalid native frame: %v", err)
			code := ErrorInvalidFrame
			if errors.Is(err, ErrFrameTooLarge) {
				code = ErrorMessageTooLarge
			}
			if writeErr := s.writeError(nil, code); writeErr != nil {
				return writeErr
			}
			var oversized FrameTooLargeError
			if errors.As(err, &oversized) {
				if _, discardErr := io.CopyN(io.Discard, s.input, int64(oversized.Size)); discardErr != nil {
					return nil
				}
				continue
			}
			return nil
		}
		if err := s.handle(frame); err != nil {
			return err
		}
	}
}

func (s *Server) handle(frame []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(frame))
	decoder.DisallowUnknownFields()
	var request Request
	if err := decoder.Decode(&request); err != nil {
		s.log("invalid native request")
		return s.writeError(nil, ErrorInvalidMessage)
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return s.writeError(nil, ErrorInvalidMessage)
	}
	if !requestIDPattern.MatchString(request.RequestID) {
		return s.writeError(nil, ErrorInvalidRequestID)
	}
	requestID := request.RequestID
	if request.ProtocolVersion != ProtocolVersion {
		return s.writeError(&requestID, ErrorUnsupportedProtocol)
	}
	switch request.Operation {
	case OperationPing:
		if request.FileURL != "" {
			return s.writeError(&requestID, ErrorInvalidMessage)
		}
		return WriteFrame(s.output, StatusResponse{
			ProtocolVersion: ProtocolVersion,
			RequestID:       request.RequestID,
			Type:            ResponseStatus,
			OK:              true,
			HostVersion:     s.hostVersion,
		})
	case OperationReadFile:
		if len(request.FileURL) < 8 || len(request.FileURL) > 8192 {
			return s.writeError(&requestID, ErrorInvalidFileURL)
		}
		if s.reader == nil {
			return s.writeError(&requestID, ErrorInternal)
		}
		return s.handleReadFile(requestID, request.FileURL)
	default:
		return s.writeError(&requestID, ErrorUnsupportedOperation)
	}
}

func (s *Server) handleReadFile(requestID string, fileURL string) error {
	data, code := s.reader.Read(fileURL)
	if code != "" {
		return s.writeError(&requestID, code)
	}
	chunkCount := (len(data) + RawChunkBytes - 1) / RawChunkBytes
	if err := WriteFrame(s.output, ReadStartResponse{
		ProtocolVersion: ProtocolVersion,
		RequestID:       requestID,
		Type:            ResponseReadStart,
		OK:              true,
		TotalBytes:      len(data),
		ChunkCount:      chunkCount,
	}); err != nil {
		return err
	}
	for offset := 0; offset < len(data); offset += RawChunkBytes {
		end := min(offset+RawChunkBytes, len(data))
		if err := WriteFrame(s.output, ReadChunkResponse{
			ProtocolVersion: ProtocolVersion,
			RequestID:       requestID,
			Type:            ResponseReadChunk,
			OK:              true,
			ChunkIndex:      offset / RawChunkBytes,
			Data:            base64.StdEncoding.EncodeToString(data[offset:end]),
		}); err != nil {
			return err
		}
	}
	return WriteFrame(s.output, ReadCompleteResponse{
		ProtocolVersion: ProtocolVersion,
		RequestID:       requestID,
		Type:            ResponseReadComplete,
		OK:              true,
		TotalBytes:      len(data),
		ChunkCount:      chunkCount,
	})
}

func (s *Server) writeError(requestID *string, code ErrorCode) error {
	return WriteFrame(s.output, ErrorResponse{
		ProtocolVersion: ProtocolVersion,
		RequestID:       requestID,
		Type:            ResponseError,
		OK:              false,
		Error:           ErrorDetail{Code: code},
	})
}

func (s *Server) log(format string, values ...any) {
	if s.diagnostics != nil {
		_, _ = fmt.Fprintf(s.diagnostics, format+"\n", values...)
	}
}

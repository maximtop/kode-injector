package protocol

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

var (
	ErrFrameTooLarge    = errors.New("native message frame is too large")
	ErrResponseTooLarge = errors.New("native message response is too large")
)

type FrameTooLargeError struct {
	Size uint32
}

func (e FrameTooLargeError) Error() string {
	return fmt.Sprintf("%s: %d bytes", ErrFrameTooLarge, e.Size)
}

func (e FrameTooLargeError) Unwrap() error {
	return ErrFrameTooLarge
}

func ReadFrame(r io.Reader) ([]byte, error) {
	var size uint32
	if err := binary.Read(r, binary.LittleEndian, &size); err != nil {
		return nil, err
	}
	if size > MaxRequestBytes {
		return nil, FrameTooLargeError{Size: size}
	}
	data := make([]byte, size)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, err
	}
	return data, nil
}

func WriteFrame(w io.Writer, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if len(data) >= MaxResponseBytes {
		return ErrResponseTooLarge
	}
	return writeRawFrame(w, data)
}

func writeRawFrame(w io.Writer, data []byte) error {
	if err := binary.Write(w, binary.LittleEndian, uint32(len(data))); err != nil {
		return err
	}
	_, err := w.Write(data)
	return err
}

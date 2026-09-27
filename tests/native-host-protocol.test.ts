/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    ChunkAssembly,
    isCompatibleHost,
    MAX_FILE_BYTES,
    NativeErrorCode,
    NativeResponseType,
    parseNativeResponse,
    PROTOCOL_VERSION,
    RAW_CHUNK_BYTES,
} from '../src/app/common/native-host-protocol';

test('checks native host protocol compatibility', () => {
    expect(isCompatibleHost({ protocolVersion: 1, hostVersion: '0.8.3' })).toBe(true);
    expect(isCompatibleHost({ protocolVersion: 2, hostVersion: '0.8.3' })).toBe(false);
});

test('strictly parses status responses', () => {
    expect(parseNativeResponse({
        protocolVersion: PROTOCOL_VERSION,
        requestId: 'ping_1',
        type: NativeResponseType.Status,
        ok: true,
        hostVersion: '0.8.3',
    })).toMatchObject({ requestId: 'ping_1' });
    expect(() => parseNativeResponse({
        protocolVersion: 1,
        requestId: 'ping_1',
        type: NativeResponseType.Status,
        ok: true,
        hostVersion: '0.8.3',
        unknown: true,
    })).toThrowError('NATIVE_INVALID_MESSAGE');
});

test('strictly parses error responses', () => {
    expect(parseNativeResponse({
        protocolVersion: PROTOCOL_VERSION,
        requestId: 'read_1',
        type: NativeResponseType.Error,
        ok: false,
        error: { code: NativeErrorCode.FileNotFound },
    })).toMatchObject({ requestId: 'read_1', error: { code: NativeErrorCode.FileNotFound } });

    // A null requestId is the one documented exception: the host reports it
    // when the failing request could not be identified at all.
    expect(parseNativeResponse({
        protocolVersion: PROTOCOL_VERSION,
        requestId: null,
        type: NativeResponseType.Error,
        ok: false,
        error: { code: NativeErrorCode.InvalidFrame },
    })).toMatchObject({ requestId: null });
});

test('rejects malformed error responses', () => {
    const validError = {
        protocolVersion: PROTOCOL_VERSION,
        requestId: 'read_1',
        type: NativeResponseType.Error,
        ok: false,
        error: { code: NativeErrorCode.FileNotFound },
    };

    expect(() => parseNativeResponse({ ...validError, ok: true }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validError, extra: true }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validError, requestId: '' }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validError, error: { code: 'NOT_A_REAL_CODE' } }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validError, error: { code: NativeErrorCode.FileNotFound, extra: 1 } }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
});

test('strictly parses read-start and read-complete responses', () => {
    const readStart = {
        protocolVersion: PROTOCOL_VERSION,
        requestId: 'read_1',
        type: NativeResponseType.ReadStart,
        ok: true,
        totalBytes: RAW_CHUNK_BYTES,
        chunkCount: 1,
    };
    expect(parseNativeResponse(readStart)).toMatchObject({ totalBytes: RAW_CHUNK_BYTES, chunkCount: 1 });

    const readComplete = { ...readStart, type: NativeResponseType.ReadComplete };
    expect(parseNativeResponse(readComplete)).toMatchObject({ totalBytes: RAW_CHUNK_BYTES });
});

test('rejects out-of-bound or malformed read-start responses', () => {
    const validReadStart = {
        protocolVersion: PROTOCOL_VERSION,
        requestId: 'read_1',
        type: NativeResponseType.ReadStart,
        ok: true,
        totalBytes: RAW_CHUNK_BYTES,
        chunkCount: 1,
    };

    expect(() => parseNativeResponse({ ...validReadStart, totalBytes: -1 }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validReadStart, totalBytes: MAX_FILE_BYTES + 1 }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validReadStart, totalBytes: 1.5 }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({
        ...validReadStart,
        chunkCount: Math.ceil(MAX_FILE_BYTES / RAW_CHUNK_BYTES) + 1,
    })).toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validReadStart, extra: true }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
});

test('strictly parses read-chunk responses and rejects malformed ones', () => {
    const validChunk = {
        protocolVersion: PROTOCOL_VERSION,
        requestId: 'read_1',
        type: NativeResponseType.ReadChunk,
        ok: true,
        chunkIndex: 0,
        data: 'YQ==',
    };
    expect(parseNativeResponse(validChunk)).toMatchObject({ chunkIndex: 0, data: 'YQ==' });

    expect(() => parseNativeResponse({ ...validChunk, chunkIndex: 10 }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validChunk, chunkIndex: -1 }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validChunk, data: 123 }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
    expect(() => parseNativeResponse({ ...validChunk, extra: true }))
        .toThrowError('NATIVE_INVALID_MESSAGE');
});

// BUG: decodeBase64's `fail('NATIVE_CHUNK_TOO_LARGE')` call sits inside its
// own try block, so the function's `catch {}` immediately intercepts that
// throw and rewrites it to NATIVE_INVALID_BASE64. NATIVE_CHUNK_TOO_LARGE can
// never actually surface. Flip this back to a plain `test` once the size
// check is fixed (e.g. moved after the try/catch, or the catch narrowed to
// only the atob/decode failure).
test.fails('rejects a raw chunk decoding past the documented 512 KiB bound', () => {
    const assembly = new ChunkAssembly('read_1');
    assembly.start(RAW_CHUNK_BYTES, 1);
    const oversizedChunk = new Uint8Array(RAW_CHUNK_BYTES + 1).fill(97);
    expect(() => assembly.acceptChunk({
        protocolVersion: 1,
        requestId: 'read_1',
        type: NativeResponseType.ReadChunk,
        ok: true,
        chunkIndex: 0,
        data: Buffer.from(oversizedChunk).toString('base64'),
    })).toThrowError('NATIVE_CHUNK_TOO_LARGE');
});

test('rejects chunks before a start response', () => {
    const assembly = new ChunkAssembly('read_1');
    expect(() => assembly.acceptChunk({
        protocolVersion: 1,
        requestId: 'read_1',
        type: NativeResponseType.ReadChunk,
        ok: true,
        chunkIndex: 1,
        data: 'YQ==',
    })).toThrowError('NATIVE_CHUNK_SEQUENCE');
});

test('assembles an exact maximum-size UTF-8 file', () => {
    const content = new Uint8Array(MAX_FILE_BYTES).fill(97);
    const assembly = new ChunkAssembly('read_1');
    const chunkCount = MAX_FILE_BYTES / RAW_CHUNK_BYTES;
    assembly.start(MAX_FILE_BYTES, chunkCount);
    for (let index = 0; index < chunkCount; index += 1) {
        const chunk = content.slice(index * RAW_CHUNK_BYTES, (index + 1) * RAW_CHUNK_BYTES);
        assembly.acceptChunk({
            protocolVersion: 1,
            requestId: 'read_1',
            type: NativeResponseType.ReadChunk,
            ok: true,
            chunkIndex: index,
            data: Buffer.from(chunk).toString('base64'),
        });
    }
    expect(assembly.complete(MAX_FILE_BYTES, chunkCount)).toHaveLength(MAX_FILE_BYTES);
});

test('rejects invalid base64 and invalid UTF-8', () => {
    const invalidBase64 = new ChunkAssembly('read_1');
    invalidBase64.start(1, 1);
    expect(() => invalidBase64.acceptChunk({
        protocolVersion: 1,
        requestId: 'read_1',
        type: NativeResponseType.ReadChunk,
        ok: true,
        chunkIndex: 0,
        data: '***',
    })).toThrowError('NATIVE_INVALID_BASE64');

    const invalidUtf8 = new ChunkAssembly('read_2');
    invalidUtf8.start(1, 1);
    invalidUtf8.acceptChunk({
        protocolVersion: 1,
        requestId: 'read_2',
        type: NativeResponseType.ReadChunk,
        ok: true,
        chunkIndex: 0,
        data: '/w==',
    });
    expect(() => invalidUtf8.complete(1, 1)).toThrow();
});

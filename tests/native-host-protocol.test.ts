/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    ChunkAssembly,
    isCompatibleHost,
    MAX_FILE_BYTES,
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

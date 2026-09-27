/**
 * @file
 */

import { createHash } from 'node:crypto';

import {
    afterEach,
    expect,
    test,
    vi,
} from 'vitest';

import { RAW_CHUNK_BYTES } from '../src/app/common/native-host-protocol';
import {
    SafariNativeClient,
    SafariNativeOperation,
    type SafariNativeMessenger,
} from '../src/app/common/safari-native-client';

interface Request {
    protocolVersion: number;
    requestId: string;
    operation: SafariNativeOperation;
    fileUrl?: string;
    digest?: string;
    chunkIndex?: number;
}

const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const encode = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

const success = (
    request: Request,
    fields: Record<string, unknown>,
): Record<string, unknown> => ({
    protocolVersion: 1,
    requestId: request.requestId,
    ok: true,
    ...fields,
});

afterEach(() => {
    vi.useRealTimers();
});

test('pings and authorizes an exact source through one-shot Safari messages', async () => {
    const operations: SafariNativeOperation[] = [];
    const send: SafariNativeMessenger = vi.fn(async (_application, value) => {
        const request = value as Request;
        operations.push(request.operation);
        if (request.operation === SafariNativeOperation.Ping) {
            return success(request, { type: 'status', hostVersion: '0.9.1' });
        }
        return success(request, { type: 'authorization' });
    });
    const client = new SafariNativeClient(send);

    await expect(client.ping()).resolves.toEqual({
        protocolVersion: 1,
        hostVersion: '0.9.1',
    });
    await expect(client.authorizeFolder('file:///tmp/scope/source.js')).resolves.toBeUndefined();
    expect(operations).toEqual([
        SafariNativeOperation.Ping,
        SafariNativeOperation.AuthorizeFolder,
    ]);
});

test('assembles chunks, verifies SHA-256, and decodes UTF-8 strictly', async () => {
    const bytes = new TextEncoder().encode('console.log("Safari");');
    const expectedDigest = digest(bytes);
    const send: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        if (request.operation === SafariNativeOperation.ReadMetadata) {
            return success(request, {
                type: 'readMetadata',
                totalBytes: bytes.byteLength,
                chunkCount: 1,
                digest: expectedDigest,
                firstChunk: encode(bytes),
            });
        }
        return success(request, {
            type: 'readChunk',
            chunkIndex: 0,
            data: encode(bytes),
        });
    };

    await expect(new SafariNativeClient(send).readFile('file:///tmp/source.js'))
        .resolves.toBe('console.log("Safari");');
});

test('reads a small file from metadata without a second native round-trip', async () => {
    const bytes = new TextEncoder().encode('console.log("one round-trip");');
    const expectedDigest = digest(bytes);
    const operations: SafariNativeOperation[] = [];
    const send: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        operations.push(request.operation);
        return success(request, {
            type: 'readMetadata',
            totalBytes: bytes.byteLength,
            chunkCount: 1,
            digest: expectedDigest,
            firstChunk: encode(bytes),
        });
    };

    await expect(new SafariNativeClient(send).readFile('file:///tmp/source.js'))
        .resolves.toBe('console.log("one round-trip");');
    expect(operations).toEqual([SafariNativeOperation.ReadMetadata]);
});

test('retries the entire read once when the native bridge reports a changed file', async () => {
    const bytes = new Uint8Array(RAW_CHUNK_BYTES + 1);
    bytes.fill('a'.charCodeAt(0));
    const firstChunk = bytes.slice(0, RAW_CHUNK_BYTES);
    const secondChunk = bytes.slice(RAW_CHUNK_BYTES);
    const expectedDigest = digest(bytes);
    let metadataCount = 0;
    const send: SafariNativeMessenger = vi.fn(async (_application, value) => {
        const request = value as Request;
        if (request.operation === SafariNativeOperation.ReadMetadata) {
            metadataCount += 1;
            return success(request, {
                type: 'readMetadata',
                totalBytes: bytes.byteLength,
                chunkCount: 2,
                digest: expectedDigest,
                firstChunk: encode(firstChunk),
            });
        }
        if (metadataCount === 1) {
            return {
                protocolVersion: 1,
                requestId: request.requestId,
                type: 'error',
                ok: false,
                error: { code: 'FILE_CHANGED' },
            };
        }
        return success(request, {
            type: 'readChunk',
            chunkIndex: 1,
            data: encode(secondChunk),
        });
    });

    await expect(new SafariNativeClient(send).readFile('file:///tmp/source.js'))
        .resolves.toBe('a'.repeat(bytes.byteLength));
    expect(metadataCount).toBe(2);
});

test('rejects invalid UTF-8 and strict response-shape violations', async () => {
    const bytes = Uint8Array.from([0xff]);
    const expectedDigest = digest(bytes);
    const invalidUtf8: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        return request.operation === SafariNativeOperation.ReadMetadata
            ? success(request, {
                type: 'readMetadata',
                totalBytes: 1,
                chunkCount: 1,
                digest: expectedDigest,
                firstChunk: encode(bytes),
            })
            : success(request, {
                type: 'readChunk',
                chunkIndex: 0,
                data: encode(bytes),
            });
    };
    await expect(new SafariNativeClient(invalidUtf8).readFile('file:///tmp/source.js'))
        .rejects.toThrowError('INVALID_UTF8');

    const extraField: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        return success(request, {
            type: 'status',
            hostVersion: '0.9.1',
            extra: true,
        });
    };
    await expect(new SafariNativeClient(extraField).ping())
        .rejects.toThrowError('NATIVE_INVALID_MESSAGE');
});

// BUG: parseCommon's `fail('MESSAGE_TOO_LARGE')` call sits inside its own
// try block, so its `catch {}` immediately intercepts that throw and
// rewrites it to NATIVE_INVALID_MESSAGE. MESSAGE_TOO_LARGE can never
// actually surface. Flip this back to a plain `test` once the size check is
// fixed (e.g. moved after the try/catch).
test.fails('reports the documented sub-1MiB envelope limit when a response is oversized', async () => {
    const send: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        return success(request, {
            type: 'status',
            hostVersion: '0.9.1',
            padding: 'x'.repeat(2 * 1024 * 1024),
        });
    };
    await expect(new SafariNativeClient(send).ping()).rejects.toThrowError('MESSAGE_TOO_LARGE');
});

// BUG: decodeBase64's `fail('NATIVE_CHUNK_TOO_LARGE')` call sits inside its
// own try block (same defect as native-host-protocol.ts's decodeBase64), so
// its `catch {}` rewrites that throw to NATIVE_INVALID_BASE64.
// NATIVE_CHUNK_TOO_LARGE can never actually surface. Reached here through a
// metadata response's `firstChunk`, which has no length pre-check before
// decoding (unlike parseChunk's `data`, which is bounded by
// MAX_BASE64_CHUNK_LENGTH first). Flip this back to a plain `test` once the
// size check is fixed.
test.fails('rejects a first chunk decoding past the documented 512 KiB bound', async () => {
    const oversized = new Uint8Array(RAW_CHUNK_BYTES + 1).fill('a'.charCodeAt(0));
    const send: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        return success(request, {
            type: 'readMetadata',
            totalBytes: oversized.byteLength,
            chunkCount: 2,
            digest: digest(oversized),
            firstChunk: encode(oversized),
        });
    };
    await expect(new SafariNativeClient(send).readFile('file:///tmp/source.js'))
        .rejects.toThrowError('NATIVE_CHUNK_TOO_LARGE');
});

test('rejects a chunk whose encoded length exceeds the documented bound before decoding it', async () => {
    // A full-size first chunk forces a second chunk request, so the encoded
    // length guard in parseChunk gets a chance to run on it.
    const firstChunkBytes = new Uint8Array(RAW_CHUNK_BYTES).fill('a'.charCodeAt(0));
    const totalBytes = RAW_CHUNK_BYTES + 1;
    const oversizedData = 'A'.repeat(Math.ceil(RAW_CHUNK_BYTES / 3) * 4 + 4);
    const send: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        if (request.operation === SafariNativeOperation.ReadMetadata) {
            return success(request, {
                type: 'readMetadata',
                totalBytes,
                chunkCount: 2,
                digest: digest(firstChunkBytes),
                firstChunk: encode(firstChunkBytes),
            });
        }
        return success(request, {
            type: 'readChunk',
            chunkIndex: 1,
            data: oversizedData,
        });
    };

    await expect(new SafariNativeClient(send).readFile('file:///tmp/source.js'))
        .rejects.toThrowError('NATIVE_INVALID_MESSAGE');
});

test('keeps authorization failures closed and times out unanswered reads', async () => {
    const denied: SafariNativeMessenger = async (_application, value) => {
        const request = value as Request;
        return {
            protocolVersion: 1,
            requestId: request.requestId,
            type: 'error',
            ok: false,
            error: { code: 'AUTHORIZATION_TARGET_NOT_FOUND' },
        };
    };
    await expect(new SafariNativeClient(denied).authorizeFolder('file:///missing/source.js'))
        .rejects.toThrowError('AUTHORIZATION_TARGET_NOT_FOUND');

    vi.useFakeTimers();
    const unanswered: SafariNativeMessenger = () => new Promise(() => {});
    const pending = new SafariNativeClient(unanswered, 50).readFile('file:///tmp/source.js');
    const assertion = expect(pending).rejects.toThrowError('NATIVE_TIMEOUT');
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
});

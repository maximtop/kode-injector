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

import {
    SafariNativeClient,
    SafariNativeOperation,
    type SafariNativeMessenger,
} from '../src/app/common/safari-native-client';
import { RAW_CHUNK_BYTES } from '../src/app/common/native-host-protocol';

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
    const unanswered: SafariNativeMessenger = () => new Promise(() => undefined);
    const pending = new SafariNativeClient(unanswered, 50).readFile('file:///tmp/source.js');
    const assertion = expect(pending).rejects.toThrowError('NATIVE_TIMEOUT');
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
});

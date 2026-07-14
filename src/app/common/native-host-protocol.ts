/**
 * @file Native messaging protocol shared by the background runtime and tests.
 */

/* eslint-disable jsdoc/require-jsdoc, no-useless-constructor, no-empty-function */
/* eslint-disable no-restricted-syntax, max-len */

export const PROTOCOL_VERSION = 1;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const RAW_CHUNK_BYTES = 512 * 1024;
export const NATIVE_HOST_NAME = 'dev.maximtop.kode_injector';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const HOST_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/u;

export enum NativeOperation {
    Ping = 'ping',
    ReadFile = 'readFile',
}

export enum NativeResponseType {
    Status = 'status',
    ReadStart = 'readStart',
    ReadChunk = 'readChunk',
    ReadComplete = 'readComplete',
    Error = 'error',
}

export enum NativeErrorCode {
    InvalidFrame = 'INVALID_FRAME',
    MessageTooLarge = 'MESSAGE_TOO_LARGE',
    InvalidMessage = 'INVALID_MESSAGE',
    InvalidRequestId = 'INVALID_REQUEST_ID',
    UnsupportedProtocol = 'UNSUPPORTED_PROTOCOL',
    UnsupportedOperation = 'UNSUPPORTED_OPERATION',
    InvalidFileUrl = 'INVALID_FILE_URL',
    RemoteFileUrl = 'REMOTE_FILE_URL',
    FileNotFound = 'FILE_NOT_FOUND',
    NotRegularFile = 'NOT_REGULAR_FILE',
    FileTooLarge = 'FILE_TOO_LARGE',
    InvalidUtf8 = 'INVALID_UTF8',
    ReadFailed = 'READ_FAILED',
    InternalError = 'INTERNAL_ERROR',
}

export enum NativeHostStatus {
    Checking = 'checking',
    NotInstalled = 'notInstalled',
    UpdateRequired = 'updateRequired',
    Ready = 'ready',
    Disconnected = 'disconnected',
    ReadFailed = 'readFailed',
}

export interface NativeHostInfo {
    protocolVersion: number;
    hostVersion: string;
}

export interface NativeStatusResponse extends NativeHostInfo {
    requestId: string;
    type: NativeResponseType.Status;
    ok: true;
}

export interface NativeReadStartResponse {
    protocolVersion: number;
    requestId: string;
    type: NativeResponseType.ReadStart;
    ok: true;
    totalBytes: number;
    chunkCount: number;
}

export interface NativeReadChunkResponse {
    protocolVersion: number;
    requestId: string;
    type: NativeResponseType.ReadChunk;
    ok: true;
    chunkIndex: number;
    data: string;
}

export interface NativeReadCompleteResponse {
    protocolVersion: number;
    requestId: string;
    type: NativeResponseType.ReadComplete;
    ok: true;
    totalBytes: number;
    chunkCount: number;
}

export interface NativeErrorResponse {
    protocolVersion: number;
    requestId: string | null;
    type: NativeResponseType.Error;
    ok: false;
    error: { code: NativeErrorCode };
}

export type NativeResponse = NativeStatusResponse
    | NativeReadStartResponse
    | NativeReadChunkResponse
    | NativeReadCompleteResponse
    | NativeErrorResponse;

export const isCompatibleHost = (host: NativeHostInfo): boolean => {
    return host.protocolVersion === PROTOCOL_VERSION && HOST_VERSION_PATTERN.test(host.hostVersion);
};

const fail = (code: string): never => {
    throw new Error(code);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const hasExactKeys = (value: Record<string, unknown>, keys: string[]): boolean => {
    const actual = Object.keys(value).sort();
    return actual.length === keys.length
        && actual.every((key, index) => key === [...keys].sort()[index]);
};

const isRequestId = (value: unknown): value is string => {
    return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
};

const isBoundedInteger = (value: unknown, maximum: number): value is number => {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
};

export const parseNativeResponse = (value: unknown): NativeResponse => {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return fail('NATIVE_INVALID_MESSAGE');
    }
    if (value.type === NativeResponseType.Error) {
        if (!hasExactKeys(value, ['protocolVersion', 'requestId', 'type', 'ok', 'error'])
            || !Number.isInteger(value.protocolVersion)
            || value.ok !== false
            || !(value.requestId === null || isRequestId(value.requestId))
            || !isRecord(value.error)
            || !hasExactKeys(value.error, ['code'])
            || !Object.values(NativeErrorCode).includes(value.error.code as NativeErrorCode)) {
            return fail('NATIVE_INVALID_MESSAGE');
        }
        return value as unknown as NativeErrorResponse;
    }
    if (value.protocolVersion !== PROTOCOL_VERSION || !isRequestId(value.requestId) || value.ok !== true) {
        return fail('NATIVE_INVALID_MESSAGE');
    }
    switch (value.type) {
        case NativeResponseType.Status:
            if (!hasExactKeys(value, ['protocolVersion', 'requestId', 'type', 'ok', 'hostVersion'])
                || typeof value.hostVersion !== 'string'
                || !HOST_VERSION_PATTERN.test(value.hostVersion)) {
                return fail('NATIVE_INVALID_MESSAGE');
            }
            return value as unknown as NativeStatusResponse;
        case NativeResponseType.ReadStart:
        case NativeResponseType.ReadComplete:
            if (!hasExactKeys(value, ['protocolVersion', 'requestId', 'type', 'ok', 'totalBytes', 'chunkCount'])
                || !isBoundedInteger(value.totalBytes, MAX_FILE_BYTES)
                || !isBoundedInteger(value.chunkCount, Math.ceil(MAX_FILE_BYTES / RAW_CHUNK_BYTES))) {
                return fail('NATIVE_INVALID_MESSAGE');
            }
            return value as unknown as NativeReadStartResponse | NativeReadCompleteResponse;
        case NativeResponseType.ReadChunk:
            if (!hasExactKeys(value, ['protocolVersion', 'requestId', 'type', 'ok', 'chunkIndex', 'data'])
                || !isBoundedInteger(value.chunkIndex, 9)
                || typeof value.data !== 'string') {
                return fail('NATIVE_INVALID_MESSAGE');
            }
            return value as unknown as NativeReadChunkResponse;
        default:
            return fail('NATIVE_INVALID_MESSAGE');
    }
};

const decodeBase64 = (value: string): Uint8Array => {
    if (!BASE64_PATTERN.test(value) || value.length % 4 !== 0) {
        return fail('NATIVE_INVALID_BASE64');
    }
    try {
        const binary = globalThis.atob(value);
        const decoded = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        if (decoded.byteLength > RAW_CHUNK_BYTES) {
            return fail('NATIVE_CHUNK_TOO_LARGE');
        }
        return decoded;
    } catch {
        return fail('NATIVE_INVALID_BASE64');
    }
};

export class ChunkAssembly {
    private totalBytes: number | undefined;

    private chunkCount: number | undefined;

    private readonly chunks: Uint8Array[] = [];

    public constructor(private readonly requestId: string) {}

    public start(totalBytes: number, chunkCount: number): void {
        if (this.totalBytes !== undefined
            || !isBoundedInteger(totalBytes, MAX_FILE_BYTES)
            || !isBoundedInteger(chunkCount, 10)
            || chunkCount !== Math.ceil(totalBytes / RAW_CHUNK_BYTES)) {
            fail('NATIVE_CHUNK_SEQUENCE');
        }
        this.totalBytes = totalBytes;
        this.chunkCount = chunkCount;
    }

    public acceptChunk(chunk: NativeReadChunkResponse): void {
        if (this.totalBytes === undefined
            || chunk.requestId !== this.requestId
            || chunk.chunkIndex !== this.chunks.length
            || this.chunks.length >= (this.chunkCount as number)) {
            fail('NATIVE_CHUNK_SEQUENCE');
        }
        this.chunks.push(decodeBase64(chunk.data));
    }

    public complete(totalBytes: number, chunkCount: number): string {
        if (this.totalBytes === undefined
            || totalBytes !== this.totalBytes
            || chunkCount !== this.chunkCount
            || this.chunks.length !== chunkCount) {
            return fail('NATIVE_CHUNK_SEQUENCE');
        }
        const content = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of this.chunks) {
            if (offset + chunk.byteLength > totalBytes) {
                return fail('NATIVE_CHUNK_SIZE');
            }
            content.set(chunk, offset);
            offset += chunk.byteLength;
        }
        if (offset !== totalBytes) {
            return fail('NATIVE_CHUNK_SIZE');
        }
        return new TextDecoder('utf-8', { fatal: true }).decode(content);
    }
}

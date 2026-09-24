/**
 * @file Native messaging protocol shared by the background runtime and tests.
 */

export const PROTOCOL_VERSION = 1;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const RAW_CHUNK_BYTES = 512 * 1024;
export const MAX_RESPONSE_BYTES = 1024 * 1024;
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
    AuthorizationRequired = 'AUTHORIZATION_REQUIRED',
    AuthorizationCancelled = 'AUTHORIZATION_CANCELLED',
    AuthorizationTargetNotFound = 'AUTHORIZATION_TARGET_NOT_FOUND',
    AuthorizationFailed = 'AUTHORIZATION_FAILED',
    FileChanged = 'FILE_CHANGED',
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

/**
 * Native-host identity reported in a status response.
 */
export interface NativeHostInfo {
    /**
     * Native messaging protocol version implemented by the host.
     */
    protocolVersion: number;

    /**
     * Native host release version.
     */
    hostVersion: string;
}

/**
 * Response to a ping request.
 */
export interface NativeStatusResponse extends NativeHostInfo {
    /**
     * Identifier of the request this response answers.
     */
    requestId: string;

    /**
     * Discriminant identifying this as a status response.
     */
    type: NativeResponseType.Status;

    /**
     * Always true: a status response never reports failure.
     */
    ok: true;
}

/**
 * First response of a file read, announcing the transfer size.
 */
export interface NativeReadStartResponse {
    /**
     * Native messaging protocol version implemented by the host.
     */
    protocolVersion: number;

    /**
     * Identifier of the request this response answers.
     */
    requestId: string;

    /**
     * Discriminant identifying this as a read-start response.
     */
    type: NativeResponseType.ReadStart;

    /**
     * Always true: a read-start response never reports failure.
     */
    ok: true;

    /**
     * Total decoded file size in bytes.
     */
    totalBytes: number;

    /**
     * Number of chunks the file is split into.
     */
    chunkCount: number;
}

/**
 * One base64-encoded chunk of file content.
 */
export interface NativeReadChunkResponse {
    /**
     * Native messaging protocol version implemented by the host.
     */
    protocolVersion: number;

    /**
     * Identifier of the request this response answers.
     */
    requestId: string;

    /**
     * Discriminant identifying this as a read-chunk response.
     */
    type: NativeResponseType.ReadChunk;

    /**
     * Always true: a read-chunk response never reports failure.
     */
    ok: true;

    /**
     * Zero-based position of this chunk in the transfer.
     */
    chunkIndex: number;

    /**
     * Base64-encoded chunk content.
     */
    data: string;
}

/**
 * Final response of a file read, confirming the completed transfer.
 */
export interface NativeReadCompleteResponse {
    /**
     * Native messaging protocol version implemented by the host.
     */
    protocolVersion: number;

    /**
     * Identifier of the request this response answers.
     */
    requestId: string;

    /**
     * Discriminant identifying this as a read-complete response.
     */
    type: NativeResponseType.ReadComplete;

    /**
     * Always true: a read-complete response never reports failure.
     */
    ok: true;

    /**
     * Total decoded file size in bytes.
     */
    totalBytes: number;

    /**
     * Number of chunks the file was split into.
     */
    chunkCount: number;
}

/**
 * Response reporting that a request failed.
 */
export interface NativeErrorResponse {
    /**
     * Native messaging protocol version implemented by the host.
     */
    protocolVersion: number;

    /**
     * Identifier of the request this response answers, or null when the
     * failing request could not be identified.
     */
    requestId: string | null;

    /**
     * Discriminant identifying this as an error response.
     */
    type: NativeResponseType.Error;

    /**
     * Always false: an error response never reports success.
     */
    ok: false;

    /**
     * Machine-readable failure reason.
     */
    error: {
        /**
         * Machine-readable failure code.
         */
        code: NativeErrorCode;
    };
}

/**
 * Any response the native host can send.
 */
export type NativeResponse = NativeStatusResponse
    | NativeReadStartResponse
    | NativeReadChunkResponse
    | NativeReadCompleteResponse
    | NativeErrorResponse;

/**
 * Checks whether a native host implements a supported protocol and reports a
 * well-formed version.
 *
 * @param host Native-host identity to check.
 *
 * @returns Whether the host is compatible.
 */
export const isCompatibleHost = (host: NativeHostInfo): boolean => {
    return host.protocolVersion === PROTOCOL_VERSION && HOST_VERSION_PATTERN.test(host.hostVersion);
};

/**
 * Throws a closed native-protocol failure.
 *
 * @param code Error code exposed to the caller.
 *
 * @throws {Error} Always, using the supplied error code.
 */
const fail = (code: string): never => {
    throw new Error(code);
};

/**
 * Checks whether an untrusted value is a plain record.
 *
 * @param value Value to inspect.
 *
 * @returns Whether the value is a non-array object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Checks that a protocol object contains exactly the expected keys.
 *
 * @param value Protocol object to inspect.
 * @param keys Complete expected key list.
 *
 * @returns Whether the keys match exactly.
 */
const hasExactKeys = (value: Record<string, unknown>, keys: string[]): boolean => {
    const actual = Object.keys(value).sort();
    return actual.length === keys.length
        && actual.every((key, index) => key === [...keys].sort()[index]);
};

/**
 * Checks whether a value is a well-formed request identifier.
 *
 * @param value Value to validate.
 *
 * @returns Whether the value matches the request identifier format.
 */
const isRequestId = (value: unknown): value is string => {
    return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
};

/**
 * Checks whether a value is an integer within a bounded range.
 *
 * @param value Value to validate.
 * @param maximum Inclusive upper bound.
 *
 * @returns Whether the value is an integer in `[0, maximum]`.
 */
const isBoundedInteger = (value: unknown, maximum: number): value is number => {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
};

/**
 * Validates and narrows an untrusted native-host message.
 *
 * @param value Untrusted message received from the native host.
 *
 * @returns Validated native response.
 */
export const parseNativeResponse = (value: unknown): NativeResponse => {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return fail('NATIVE_INVALID_MESSAGE');
    }
    // Unknown types fall through to the default branch below.
    const type = value.type as NativeResponseType;
    if (type === NativeResponseType.Error) {
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
    switch (type) {
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

/**
 * Strictly decodes one bounded base64 chunk.
 *
 * @param value Encoded native response data.
 *
 * @returns Decoded raw bytes.
 */
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

/**
 * Accumulates chunked file content for one outstanding read request.
 */
export class ChunkAssembly {
    private totalBytes: number | undefined;

    private chunkCount: number | undefined;

    private readonly chunks: Uint8Array[] = [];

    /**
     * Creates a chunk assembly bound to one request.
     *
     * @param requestId Identifier of the read request being assembled.
     */
    public constructor(private readonly requestId: string) {}

    /**
     * Records the announced transfer size.
     *
     * @param totalBytes Total decoded file size in bytes.
     * @param chunkCount Number of chunks the file is split into.
     *
     * @throws {Error} When the assembly already started or the sizes are invalid.
     */
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

    /**
     * Appends the next decoded chunk in sequence.
     *
     * @param chunk Chunk response to decode and append.
     *
     * @throws {Error} When the chunk is out of sequence or unexpected.
     */
    public acceptChunk(chunk: NativeReadChunkResponse): void {
        if (this.totalBytes === undefined
            || chunk.requestId !== this.requestId
            || chunk.chunkIndex !== this.chunks.length
            || this.chunks.length >= (this.chunkCount as number)) {
            fail('NATIVE_CHUNK_SEQUENCE');
        }
        this.chunks.push(decodeBase64(chunk.data));
    }

    /**
     * Finalizes the assembly into decoded UTF-8 text.
     *
     * @param totalBytes Total decoded file size in bytes, for cross-checking.
     * @param chunkCount Number of chunks received, for cross-checking.
     *
     * @returns Assembled UTF-8 file content.
     */
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

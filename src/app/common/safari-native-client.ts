/**
 * @file One-request/one-response native client used by Safari Web Extensions.
 */

/* eslint-disable no-restricted-syntax, max-len */

import {
    MAX_FILE_BYTES,
    MAX_RESPONSE_BYTES,
    NATIVE_HOST_NAME,
    NativeErrorCode,
    type NativeHostInfo,
    PROTOCOL_VERSION,
    RAW_CHUNK_BYTES,
} from './native-host-protocol';

const DEFAULT_TIMEOUT_MS = 5000;
const AUTHORIZATION_TIMEOUT_MS = 5 * 60 * 1000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const HOST_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/u;
const MAX_CHUNK_COUNT = Math.ceil(MAX_FILE_BYTES / RAW_CHUNK_BYTES);
const MAX_BASE64_CHUNK_LENGTH = Math.ceil(RAW_CHUNK_BYTES / 3) * 4;

/**
 * Operations accepted by the native Safari bridge.
 */
export enum SafariNativeOperation {
    /**
     * Checks bridge and embedded-helper readiness.
     */
    Ping = 'ping',

    /**
     * Requests read-only access to a source's immediate folder.
     */
    AuthorizeFolder = 'authorizeFolder',

    /**
     * Reads validated metadata and the first content chunk.
     */
    ReadMetadata = 'readMetadata',

    /**
     * Reads one remaining content chunk by digest and index.
     */
    ReadChunk = 'readChunk',
}

/**
 * Safari native-messaging function exposed by the WebExtension runtime.
 *
 * @param application Native application identifier supplied by the browser API.
 * @param message Strict protocol request sent to the native bridge.
 *
 * @returns Untrusted native response to validate.
 */
export type SafariNativeMessenger = (
    application: string,
    message: unknown,
) => Promise<unknown>;

/**
 * Validated metadata needed to assemble one local source.
 */
interface SafariMetadataResponse {
    /**
     * Exact logical file size in bytes.
     */
    totalBytes: number;

    /**
     * Number of raw chunks needed for the complete file.
     */
    chunkCount: number;

    /**
     * SHA-256 digest binding subsequent chunk requests.
     */
    digest: string;

    /**
     * First decoded raw chunk returned with metadata.
     */
    firstChunk: Uint8Array;
}

/**
 * Throws a closed client-side protocol failure.
 *
 * @param code Error code exposed to the caller.
 *
 * @returns Never returns.
 *
 * @throws Always, using the supplied closed client error code.
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
const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/**
 * Checks that a protocol object contains exactly the expected keys.
 *
 * @param value Protocol object to inspect.
 * @param keys Complete expected key list.
 *
 * @returns Whether the keys match exactly.
 */
const hasExactKeys = (value: Record<string, unknown>, keys: string[]): boolean => {
    const expected = [...keys].sort();
    const actual = Object.keys(value).sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

/**
 * Validates a response request identifier against the outstanding request.
 *
 * @param value Untrusted response identifier.
 * @param expected Outstanding request identifier.
 *
 * @returns Whether the identifier is valid and matches.
 */
const isRequestId = (value: unknown, expected: string): value is string => (
    typeof value === 'string' && value === expected && REQUEST_ID_PATTERN.test(value)
);

/**
 * Validates fields shared by every successful or error response.
 *
 * @param value Untrusted native response.
 * @param requestId Outstanding request identifier.
 *
 * @returns Validated response record.
 */
const parseCommon = (
    value: unknown,
    requestId: string,
): Record<string, unknown> => {
    if (!isRecord(value)) {
        return fail('NATIVE_INVALID_MESSAGE');
    }
    try {
        if (new TextEncoder().encode(JSON.stringify(value)).byteLength >= MAX_RESPONSE_BYTES) {
            return fail('MESSAGE_TOO_LARGE');
        }
    } catch {
        return fail('NATIVE_INVALID_MESSAGE');
    }

    if (value.type === 'error') {
        if (!hasExactKeys(value, ['protocolVersion', 'requestId', 'type', 'ok', 'error'])
            || value.protocolVersion !== PROTOCOL_VERSION
            || !isRequestId(value.requestId, requestId)
            || value.ok !== false
            || !isRecord(value.error)
            || !hasExactKeys(value.error, ['code'])
            || !Object.values(NativeErrorCode).includes(value.error.code as NativeErrorCode)) {
            return fail('NATIVE_INVALID_MESSAGE');
        }
        return fail(value.error.code as string);
    }

    if (value.protocolVersion !== PROTOCOL_VERSION
        || !isRequestId(value.requestId, requestId)
        || value.ok !== true) {
        return fail('NATIVE_INVALID_MESSAGE');
    }
    return value;
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
        const decoded = Uint8Array.from(
            globalThis.atob(value),
            (character) => character.charCodeAt(0),
        );
        if (decoded.byteLength > RAW_CHUNK_BYTES) {
            return fail('NATIVE_CHUNK_TOO_LARGE');
        }
        return decoded;
    } catch {
        return fail('NATIVE_INVALID_BASE64');
    }
};

/**
 * Calculates a lowercase SHA-256 digest for assembled source bytes.
 *
 * @param bytes Source bytes to hash.
 *
 * @returns Lowercase hexadecimal digest.
 */
const digestHex = async (bytes: Uint8Array): Promise<string> => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * Strict one-request/one-response client for Safari native messaging.
 */
export class SafariNativeClient {
    /**
     * Monotonic counter used to create request identifiers.
     */
    private requestCounter = 0;

    /**
     * Browser function used to send one native message.
     */
    private readonly sendMessage: SafariNativeMessenger;

    /**
     * Default timeout for non-interactive native operations.
     */
    private readonly timeoutMs: number;

    /**
     * Creates a Safari native client.
     *
     * @param sendMessage Browser native-messaging function.
     * @param timeoutMs Default request timeout in milliseconds.
     */
    public constructor(
        sendMessage: SafariNativeMessenger,
        timeoutMs = DEFAULT_TIMEOUT_MS,
    ) {
        this.sendMessage = sendMessage;
        this.timeoutMs = timeoutMs;
    }

    /**
     * Matches the shared native-client lifecycle without retaining a connection.
     */
    public disconnect = (): void => undefined;

    /**
     * Checks the native bridge and returns embedded-helper metadata.
     *
     * @returns Validated native-host information.
     */
    public ping = async (): Promise<NativeHostInfo> => {
        const requestId = this.nextRequestId();
        const response = parseCommon(
            await this.requestWithId(requestId, SafariNativeOperation.Ping),
            requestId,
        );
        if (!hasExactKeys(response, ['protocolVersion', 'requestId', 'type', 'ok', 'hostVersion'])
            || response.type !== 'status'
            || typeof response.hostVersion !== 'string'
            || !HOST_VERSION_PATTERN.test(response.hostVersion)) {
            return fail('NATIVE_INVALID_MESSAGE');
        }
        return {
            protocolVersion: PROTOCOL_VERSION,
            hostVersion: response.hostVersion,
        };
    };

    /**
     * Requests read-only authorization for the immediate source folder.
     *
     * @param fileUrl Local source URL whose folder must be authorized.
     */
    public authorizeFolder = async (fileUrl: string): Promise<void> => {
        const requestId = this.nextRequestId();
        const response = parseCommon(
            await this.requestWithId(
                requestId,
                SafariNativeOperation.AuthorizeFolder,
                { fileUrl },
                AUTHORIZATION_TIMEOUT_MS,
            ),
            requestId,
        );
        if (!hasExactKeys(response, ['protocolVersion', 'requestId', 'type', 'ok'])
            || response.type !== 'authorization') {
            fail('NATIVE_INVALID_MESSAGE');
        }
    };

    /**
     * Reads, verifies, and strictly decodes one local source.
     *
     * A file-change failure is retried once from fresh metadata.
     *
     * @param fileUrl Local source URL to read.
     *
     * @returns Valid UTF-8 source contents.
     */
    public readFile = async (fileUrl: string): Promise<string> => {
        let content: string;
        try {
            content = await this.readOnce(fileUrl);
        } catch (error) {
            if (!(error instanceof Error) || error.message !== NativeErrorCode.FileChanged) {
                throw error;
            }
            content = await this.readOnce(fileUrl);
        }
        return content;
    };

    /**
     * Creates the next protocol request identifier.
     *
     * @returns Unique identifier for this client instance.
     */
    private nextRequestId(): string {
        this.requestCounter += 1;
        return `safari_${this.requestCounter}`;
    }

    /**
     * Performs one complete metadata-and-chunk read attempt.
     *
     * @param fileUrl Local source URL to read.
     *
     * @returns Verified UTF-8 source contents.
     */
    private readOnce = async (fileUrl: string): Promise<string> => {
        const metadataRequestId = this.nextRequestId();
        const metadata = this.parseMetadata(
            await this.requestWithId(metadataRequestId, SafariNativeOperation.ReadMetadata, { fileUrl }),
            metadataRequestId,
        );
        const remainingChunks = await Promise.all(Array.from(
            { length: Math.max(0, metadata.chunkCount - 1) },
            async (_value, offset) => {
                const chunkIndex = offset + 1;
                const requestId = this.nextRequestId();
                return this.parseChunk(
                    await this.requestWithId(requestId, SafariNativeOperation.ReadChunk, {
                        fileUrl,
                        digest: metadata.digest,
                        chunkIndex,
                    }),
                    requestId,
                    chunkIndex,
                );
            },
        ));
        const chunks = metadata.chunkCount === 0
            ? []
            : [metadata.firstChunk, ...remainingChunks];
        const content = new Uint8Array(metadata.totalBytes);
        let offset = 0;
        chunks.forEach((chunk) => {
            if (offset + chunk.byteLength > content.byteLength) {
                fail('NATIVE_CHUNK_SIZE');
            }
            content.set(chunk, offset);
            offset += chunk.byteLength;
        });

        if (offset !== metadata.totalBytes
            || await digestHex(content) !== metadata.digest) {
            return fail(NativeErrorCode.FileChanged);
        }

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(content);
        } catch {
            return fail(NativeErrorCode.InvalidUtf8);
        }
    };

    /**
     * Sends one bounded native request with a timeout.
     *
     * @param requestId Request identifier to send and later validate.
     * @param operation Closed native operation.
     * @param fields Operation-specific request fields.
     * @param timeoutMs Request timeout in milliseconds.
     *
     * @returns Untrusted native response.
     */
    private requestWithId = (
        requestId: string,
        operation: SafariNativeOperation,
        fields: Record<string, unknown> = {},
        timeoutMs = this.timeoutMs,
    ): Promise<unknown> => {
        const request = this.sendMessage(NATIVE_HOST_NAME, {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            operation,
            ...fields,
        });
        return new Promise<unknown>((resolve, reject) => {
            const timeout = globalThis.setTimeout(
                () => reject(new Error('NATIVE_TIMEOUT')),
                timeoutMs,
            );
            request.then(
                (response) => {
                    globalThis.clearTimeout(timeout);
                    resolve(response);
                },
                (error) => {
                    globalThis.clearTimeout(timeout);
                    reject(error);
                },
            );
        });
    };

    /**
     * Validates a metadata response and decodes its first chunk.
     *
     * @param value Untrusted native response.
     * @param requestId Outstanding request identifier.
     *
     * @returns Validated metadata response.
     */
    private parseMetadata(value: unknown, requestId: string): SafariMetadataResponse {
        const response = parseCommon(value, requestId);
        if (!hasExactKeys(response, [
            'protocolVersion',
            'requestId',
            'type',
            'ok',
            'totalBytes',
            'chunkCount',
            'digest',
            'firstChunk',
        ])
            || response.type !== 'readMetadata'
            || !Number.isInteger(response.totalBytes)
            || (response.totalBytes as number) < 0
            || (response.totalBytes as number) > MAX_FILE_BYTES
            || !Number.isInteger(response.chunkCount)
            || response.chunkCount !== Math.ceil((response.totalBytes as number) / RAW_CHUNK_BYTES)
            || (response.chunkCount as number) > MAX_CHUNK_COUNT
            || typeof response.digest !== 'string'
            || !DIGEST_PATTERN.test(response.digest)
            || typeof response.firstChunk !== 'string') {
            return fail('NATIVE_INVALID_MESSAGE');
        }
        const firstChunk = decodeBase64(response.firstChunk);
        const expectedFirstChunkBytes = Math.min(
            response.totalBytes as number,
            RAW_CHUNK_BYTES,
        );
        if (firstChunk.byteLength !== expectedFirstChunkBytes) {
            return fail('NATIVE_CHUNK_SIZE');
        }
        return {
            totalBytes: response.totalBytes as number,
            chunkCount: response.chunkCount as number,
            digest: response.digest,
            firstChunk,
        };
    }

    /**
     * Validates and decodes one indexed chunk response.
     *
     * @param value Untrusted native response.
     * @param requestId Outstanding request identifier.
     * @param chunkIndex Expected raw chunk index.
     *
     * @returns Decoded raw chunk bytes.
     */
    private parseChunk(
        value: unknown,
        requestId: string,
        chunkIndex: number,
    ): Uint8Array {
        const response = parseCommon(value, requestId);
        if (!hasExactKeys(response, [
            'protocolVersion', 'requestId', 'type', 'ok', 'chunkIndex', 'data',
        ])
            || response.type !== 'readChunk'
            || response.chunkIndex !== chunkIndex
            || typeof response.data !== 'string'
            || response.data.length > MAX_BASE64_CHUNK_LENGTH) {
            return fail('NATIVE_INVALID_MESSAGE');
        }
        return decodeBase64(response.data);
    }
}

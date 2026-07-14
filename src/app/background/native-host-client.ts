/**
 * @file Persistent native messaging client.
 */

/* eslint-disable jsdoc/require-jsdoc, no-useless-constructor, no-empty-function */
/* eslint-disable no-param-reassign, no-restricted-syntax, max-len, object-curly-newline */

import {
    ChunkAssembly,
    NATIVE_HOST_NAME,
    NativeOperation,
    type NativeHostInfo,
    type NativeResponse,
    NativeResponseType,
    parseNativeResponse,
    PROTOCOL_VERSION,
} from '../common/native-host-protocol';

const DEFAULT_TIMEOUT_MS = 2000;

interface NativeEvent<T extends (...args: never[]) => void> {
    addListener(listener: T): void;
    removeListener(listener: T): void;
}

export interface NativePort {
    postMessage(message: unknown): void;
    disconnect(): void;
    onMessage: NativeEvent<(message: unknown) => void>;
    onDisconnect: NativeEvent<() => void>;
}

export type NativePortFactory = (name: string) => NativePort;

interface PendingRequest {
    operation: NativeOperation;
    resolve: (value: NativeHostInfo | string) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    assembly?: ChunkAssembly;
}

export class NativeHostClient {
    private port: NativePort | undefined;

    private portDisconnectListener: (() => void) | undefined;

    private readonly pending = new Map<string, PendingRequest>();

    private requestCounter = 0;

    public constructor(
        private readonly connect: NativePortFactory,
        private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
    ) {}

    public ping = (): Promise<NativeHostInfo> => {
        return this.request(NativeOperation.Ping) as Promise<NativeHostInfo>;
    };

    public readFile = (fileUrl: string): Promise<string> => {
        return this.request(NativeOperation.ReadFile, fileUrl) as Promise<string>;
    };

    public disconnect = (): void => {
        const { port } = this;
        if (!port) {
            return;
        }

        this.detachPort(port);
        this.rejectAllPending(new Error('NATIVE_DISCONNECTED'));
        port.disconnect();
    };

    private request(operation: NativeOperation, fileUrl?: string): Promise<NativeHostInfo | string> {
        const requestId = `request_${this.requestCounter += 1}`;
        const port = this.getPort();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.rejectPending(requestId, new Error('NATIVE_TIMEOUT'));
            }, this.timeoutMs);
            this.pending.set(requestId, { operation, resolve, reject, timeout });
            port.postMessage({
                protocolVersion: PROTOCOL_VERSION,
                requestId,
                operation,
                ...(fileUrl === undefined ? {} : { fileUrl }),
            });
        });
    }

    private getPort(): NativePort {
        if (!this.port) {
            const port = this.connect(NATIVE_HOST_NAME);
            const handleDisconnect = (): void => {
                this.handleDisconnect(port);
            };
            this.port = port;
            this.portDisconnectListener = handleDisconnect;
            port.onMessage.addListener(this.handleMessage);
            port.onDisconnect.addListener(handleDisconnect);
        }
        return this.port;
    }

    private readonly handleMessage = (message: unknown): void => {
        let response: NativeResponse;
        try {
            response = parseNativeResponse(message);
        } catch {
            return;
        }
        if (response.requestId === null) {
            return;
        }
        const pending = this.pending.get(response.requestId);
        if (!pending) {
            return;
        }
        try {
            this.applyResponse(response, pending);
        } catch (error) {
            this.rejectPending(
                response.requestId,
                error instanceof Error ? error : new Error('NATIVE_INVALID_MESSAGE'),
            );
        }
    };

    private applyResponse(response: NativeResponse, pending: PendingRequest): void {
        switch (response.type) {
            case NativeResponseType.Error:
                this.rejectPending(response.requestId as string, new Error(response.error.code));
                break;
            case NativeResponseType.Status:
                if (pending.operation !== NativeOperation.Ping) {
                    throw new Error('NATIVE_INVALID_MESSAGE');
                }
                this.resolvePending(response.requestId, {
                    protocolVersion: response.protocolVersion,
                    hostVersion: response.hostVersion,
                });
                break;
            case NativeResponseType.ReadStart:
                if (pending.operation !== NativeOperation.ReadFile || pending.assembly) {
                    throw new Error('NATIVE_CHUNK_SEQUENCE');
                }
                pending.assembly = new ChunkAssembly(response.requestId);
                pending.assembly.start(response.totalBytes, response.chunkCount);
                break;
            case NativeResponseType.ReadChunk:
                pending.assembly?.acceptChunk(response);
                if (!pending.assembly) {
                    throw new Error('NATIVE_CHUNK_SEQUENCE');
                }
                break;
            case NativeResponseType.ReadComplete:
                if (!pending.assembly) {
                    throw new Error('NATIVE_CHUNK_SEQUENCE');
                }
                this.resolvePending(
                    response.requestId,
                    pending.assembly.complete(response.totalBytes, response.chunkCount),
                );
                break;
            default:
                throw new Error('NATIVE_INVALID_MESSAGE');
        }
    }

    private resolvePending(requestId: string, value: NativeHostInfo | string): void {
        const pending = this.pending.get(requestId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(requestId);
        pending.resolve(value);
    }

    private rejectPending(requestId: string, error: Error): void {
        const pending = this.pending.get(requestId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(requestId);
        pending.reject(error);
    }

    private handleDisconnect(port: NativePort): void {
        if (this.port !== port) {
            return;
        }

        this.detachPort(port);
        this.rejectAllPending(new Error('NATIVE_DISCONNECTED'));
    }

    private detachPort(port: NativePort): void {
        if (this.port !== port) {
            return;
        }

        port.onMessage.removeListener(this.handleMessage);
        if (this.portDisconnectListener) {
            port.onDisconnect.removeListener(this.portDisconnectListener);
        }
        this.port = undefined;
        this.portDisconnectListener = undefined;
    }

    private rejectAllPending(error: Error): void {
        for (const requestId of [...this.pending.keys()]) {
            this.rejectPending(requestId, error);
        }
    }
}

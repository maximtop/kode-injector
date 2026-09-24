/**
 * @file Persistent native messaging client.
 */

/* eslint-disable no-param-reassign */

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

/**
 * Browser-style listener registration for one native port event.
 */
interface NativeEvent<T extends (...args: never[]) => void> {
    addListener(listener: T): void;
    removeListener(listener: T): void;
}

/**
 * Browser native-messaging port used to exchange raw protocol messages.
 */
export interface NativePort {
    postMessage(message: unknown): void;
    disconnect(): void;

    /**
     * Fires for every message received on the port.
     */
    onMessage: NativeEvent<(message: unknown) => void>;

    /**
     * Fires once when the port is disconnected.
     */
    onDisconnect: NativeEvent<() => void>;
}

/**
 * Opens a native port for a given native application name.
 *
 * @param name Native application identifier registered with the browser.
 *
 * @returns Connected native port.
 */
export type NativePortFactory = (name: string) => NativePort;

/**
 * Bookkeeping kept for one outstanding request while it awaits a response.
 */
interface PendingRequest {
    /**
     * Native operation the request was sent for.
     */
    operation: NativeOperation;

    /**
     * Settles the request promise with its final value.
     */
    resolve: (value: NativeHostInfo | string) => void;

    /**
     * Settles the request promise with a failure.
     */
    reject: (reason: Error) => void;

    /**
     * Timer that fails the request if no response arrives in time.
     */
    timeout: ReturnType<typeof setTimeout>;

    /**
     * Chunk assembly in progress, once a read has started.
     */
    assembly?: ChunkAssembly;
}

/**
 * Persistent client for the native messaging protocol, reconnecting the
 * underlying port on demand and tracking requests across responses.
 */
export class NativeHostClient {
    private port: NativePort | undefined;

    private portDisconnectListener: (() => void) | undefined;

    private readonly pending = new Map<string, PendingRequest>();

    private requestCounter = 0;

    /**
     * Creates a native host client.
     *
     * @param connect Factory that opens the native messaging port.
     * @param timeoutMs Timeout applied to each outstanding request.
     */
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

    /**
     * Sends one request and registers it for its eventual response.
     *
     * @param operation Native operation to perform.
     * @param fileUrl File URL to read, for a read-file operation.
     *
     * @returns Promise settled once the response arrives or the request times out.
     */
    private request(operation: NativeOperation, fileUrl?: string): Promise<NativeHostInfo | string> {
        const requestId = `request_${this.requestCounter += 1}`;
        const port = this.getPort();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.rejectPending(requestId, new Error('NATIVE_TIMEOUT'));
            }, this.timeoutMs);
            this.pending.set(requestId, {
                operation, resolve, reject, timeout,
            });
            port.postMessage({
                protocolVersion: PROTOCOL_VERSION,
                requestId,
                operation,
                ...(fileUrl === undefined ? {} : { fileUrl }),
            });
        });
    }

    /**
     * Returns the connected port, opening and wiring one up when absent.
     *
     * @returns Connected native port.
     */
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

    /**
     * Applies one native response to its pending request.
     *
     * @param response Validated native response.
     * @param pending Pending request the response belongs to.
     *
     * @throws {Error} When the response does not fit the pending request's
     * operation or chunk sequence.
     */
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

    /**
     * Resolves and clears a pending request, when still outstanding.
     *
     * @param requestId Identifier of the request to resolve.
     * @param value Value to resolve the request's promise with.
     */
    private resolvePending(requestId: string, value: NativeHostInfo | string): void {
        const pending = this.pending.get(requestId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(requestId);
        pending.resolve(value);
    }

    /**
     * Rejects and clears a pending request, when still outstanding.
     *
     * @param requestId Identifier of the request to reject.
     * @param error Failure to reject the request's promise with.
     */
    private rejectPending(requestId: string, error: Error): void {
        const pending = this.pending.get(requestId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(requestId);
        pending.reject(error);
    }

    /**
     * Handles the port's disconnect event, cleaning up state for it.
     *
     * @param port Port that reported the disconnect.
     */
    private handleDisconnect(port: NativePort): void {
        if (this.port !== port) {
            return;
        }

        this.detachPort(port);
        this.rejectAllPending(new Error('NATIVE_DISCONNECTED'));
    }

    /**
     * Detaches listeners and clears the current port, when it is still current.
     *
     * @param port Port to detach.
     */
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

    /**
     * Rejects every outstanding pending request.
     *
     * @param error Failure to reject every pending request's promise with.
     */
    private rejectAllPending(error: Error): void {
        for (const requestId of [...this.pending.keys()]) {
            this.rejectPending(requestId, error);
        }
    }
}

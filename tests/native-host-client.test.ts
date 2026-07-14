/**
 * @file
 */

/* eslint-disable max-classes-per-file */

import { expect, test, vi } from 'vitest';

import { NativeHostClient, type NativePort } from '../src/app/background/native-host-client';
import { NativeResponseType } from '../src/app/common/native-host-protocol';

class FakeEvent<T extends (...args: never[]) => void> {
    listeners = new Set<T>();

    addListener = (listener: T): void => {
        this.listeners.add(listener);
    };

    removeListener = (listener: T): void => {
        this.listeners.delete(listener);
    };

    emit = (...args: Parameters<T>): void => {
        for (const listener of this.listeners) {
            listener(...args);
        }
    };
}

class FakePort implements NativePort {
    onMessage = new FakeEvent<(message: unknown) => void>();

    onDisconnect = new FakeEvent<() => void>();

    posted: unknown[] = [];

    postMessage = (message: unknown): void => {
        this.posted.push(message);
    };

    disconnect = (): void => {
        this.onDisconnect.emit();
    };
}

test('uses one connection for ping and concurrent out-of-order reads', async () => {
    const port = new FakePort();
    const connect = vi.fn(() => port);
    const client = new NativeHostClient(connect);

    const ping = client.ping();
    const pingRequest = port.posted[0] as { requestId: string };
    port.onMessage.emit({
        protocolVersion: 1,
        requestId: pingRequest.requestId,
        type: NativeResponseType.Status,
        ok: true,
        hostVersion: '0.8.3',
    });
    await expect(ping).resolves.toEqual({ protocolVersion: 1, hostVersion: '0.8.3' });

    const first = client.readFile('file:///tmp/first.js');
    const second = client.readFile('file:///tmp/second.js');
    const firstRequest = port.posted[1] as { requestId: string };
    const secondRequest = port.posted[2] as { requestId: string };
    completeRead(port, secondRequest.requestId, 'second');
    completeRead(port, firstRequest.requestId, 'first');

    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(connect).toHaveBeenCalledTimes(1);
});

test('rejects pending work on disconnect and reconnects on later demand', async () => {
    const ports = [new FakePort(), new FakePort()];
    const connect = vi.fn(() => ports.shift() as FakePort);
    const client = new NativeHostClient(connect);
    const first = client.ping();
    ports[0]?.disconnect();
    // The first port was shifted out of the array.
    const connectedPort = connect.mock.results[0].value;
    connectedPort.disconnect();
    await expect(first).rejects.toThrowError('NATIVE_DISCONNECTED');

    const second = client.ping();
    const nextPort = connect.mock.results[1].value;
    const request = nextPort.posted[0] as { requestId: string };
    nextPort.onMessage.emit({
        protocolVersion: 1,
        requestId: request.requestId,
        type: NativeResponseType.Status,
        ok: true,
        hostVersion: '0.8.3',
    });
    await expect(second).resolves.toMatchObject({ hostVersion: '0.8.3' });
});

test('times out unanswered requests', async () => {
    vi.useFakeTimers();
    const client = new NativeHostClient(() => new FakePort(), 2000);
    const result = client.ping();
    const assertion = expect(result).rejects.toThrowError('NATIVE_TIMEOUT');
    await vi.advanceTimersByTimeAsync(2000);
    await assertion;
    vi.useRealTimers();
});

const completeRead = (port: FakePort, requestId: string, content: string): void => {
    const data = Buffer.from(content).toString('base64');
    port.onMessage.emit({
        protocolVersion: 1,
        requestId,
        type: NativeResponseType.ReadStart,
        ok: true,
        totalBytes: content.length,
        chunkCount: 1,
    });
    port.onMessage.emit({
        protocolVersion: 1,
        requestId,
        type: NativeResponseType.ReadChunk,
        ok: true,
        chunkIndex: 0,
        data,
    });
    port.onMessage.emit({
        protocolVersion: 1,
        requestId,
        type: NativeResponseType.ReadComplete,
        ok: true,
        totalBytes: content.length,
        chunkCount: 1,
    });
};

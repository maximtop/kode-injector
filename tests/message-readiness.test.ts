/**
 * @file
 */

import { expect, test } from 'vitest';

import { gateMessageHandler } from '../src/app/background/message-readiness';

test('gated handler waits for background initialization', async () => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
    let handled = false;
    const handler = gateMessageHandler(ready, async (value: string) => {
        handled = true;
        return `${value}:handled`;
    });

    const result = handler('message');
    await Promise.resolve();
    expect(handled).toBe(false);

    resolveReady();
    expect(await result).toBe('message:handled');
    expect(handled).toBe(true);
});

test('gated handler propagates initialization failure without handling', async () => {
    const failure = new Error('initialization failed');
    let handled = false;
    const handler = gateMessageHandler(Promise.reject(failure), () => {
        handled = true;
    });

    await expect(handler()).rejects.toBe(failure);
    expect(handled).toBe(false);
});

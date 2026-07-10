/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { gateMessageHandler } from '../src/js/background/message-readiness';

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
    assert.equal(handled, false);

    resolveReady();
    assert.equal(await result, 'message:handled');
    assert.equal(handled, true);
});

test('gated handler propagates initialization failure without handling', async () => {
    const failure = new Error('initialization failed');
    let handled = false;
    const handler = gateMessageHandler(Promise.reject(failure), () => {
        handled = true;
    });

    await assert.rejects(handler(), failure);
    assert.equal(handled, false);
});

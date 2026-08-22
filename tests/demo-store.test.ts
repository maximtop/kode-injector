/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import {
    DEMO_POLL_INTERVAL_MS,
    DEMO_UI_WAIT_LIMIT_MS,
    DemoStore,
    DemoUiStatus,
} from '../src/app/options/stores/DemoStore';
import {
    DemoFailureReason,
    DemoLaunchStatus,
    type DemoLaunchState,
    type RunDemoResult,
} from '../src/app/common/demo-contracts';

const flush = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

const makeStore = () => {
    const scheduled: Array<{ callback: () => void | Promise<void>; delayMs: number }> = [];
    const runDemo = vi.fn<() => Promise<RunDemoResult>>();
    const getDemoLaunchState = vi.fn<() => Promise<DemoLaunchState>>();
    const store = new DemoStore({
        runDemo,
        getDemoLaunchState,
        schedule: (callback, delayMs) => {
            const entry = { callback, delayMs };
            scheduled.push(entry);
            return () => {
                const index = scheduled.indexOf(entry);
                if (index >= 0) {
                    scheduled.splice(index, 1);
                }
            };
        },
    });
    const tick = async (): Promise<void> => {
        const next = scheduled.shift();
        if (!next) {
            throw new Error('nothing scheduled');
        }
        expect(next.delayMs).toBe(DEMO_POLL_INTERVAL_MS);
        await next.callback();
        await flush();
    };
    return { store, runDemo, getDemoLaunchState, scheduled, tick };
};

test('a refused run shows the reason without polling', async () => {
    const { store, runDemo, scheduled } = makeStore();
    runDemo.mockResolvedValue({ ok: false, reason: DemoFailureReason.Paused });

    await store.run();

    expect(store.status).toBe(DemoUiStatus.Failed);
    expect(store.failure).toBe(DemoFailureReason.Paused);
    expect(scheduled).toHaveLength(0);
});

test('an accepted run polls until the background reports applied or failed', async () => {
    const applied = makeStore();
    applied.runDemo.mockResolvedValue({ ok: true });
    applied.getDemoLaunchState
        .mockResolvedValueOnce({ status: DemoLaunchStatus.Waiting })
        .mockResolvedValueOnce({ status: DemoLaunchStatus.Applied });
    await applied.store.run();
    expect(applied.store.status).toBe(DemoUiStatus.Running);
    await applied.tick();
    expect(applied.store.status).toBe(DemoUiStatus.Running);
    await applied.tick();
    expect(applied.store.status).toBe(DemoUiStatus.Applied);
    expect(applied.store.failure).toBeNull();
    expect(applied.scheduled).toHaveLength(0);

    const failed = makeStore();
    failed.runDemo.mockResolvedValue({ ok: true });
    failed.getDemoLaunchState.mockResolvedValue({
        status: DemoLaunchStatus.Failed,
        failure: DemoFailureReason.WebsiteAccessRequired,
    });
    await failed.store.run();
    await failed.tick();
    expect(failed.store.status).toBe(DemoUiStatus.Failed);
    expect(failed.store.failure).toBe(DemoFailureReason.WebsiteAccessRequired);
});

test('a vanished launch is reported as interrupted and reset returns to idle', async () => {
    const { store, runDemo, getDemoLaunchState, scheduled, tick } = makeStore();
    runDemo.mockResolvedValue({ ok: true });
    getDemoLaunchState
        .mockResolvedValueOnce({ status: DemoLaunchStatus.None })
        .mockResolvedValue({ status: DemoLaunchStatus.Waiting });

    await store.run();
    await tick();
    expect(store.status).toBe(DemoUiStatus.Failed);
    expect(store.failure).toBe(DemoFailureReason.Interrupted);

    await store.run();
    expect(scheduled).toHaveLength(1);
    store.reset();
    expect(scheduled).toHaveLength(0);
    expect(store.status).toBe(DemoUiStatus.Idle);
    expect(store.failure).toBeNull();
});

test('polling stops with not confirmed after the UI wait limit', async () => {
    const { store, runDemo, getDemoLaunchState, tick, scheduled } = makeStore();
    runDemo.mockResolvedValue({ ok: true });
    getDemoLaunchState.mockResolvedValue({ status: DemoLaunchStatus.Waiting });

    await store.run();
    const ticks = DEMO_UI_WAIT_LIMIT_MS / DEMO_POLL_INTERVAL_MS;
    for (let index = 0; index < ticks; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await tick();
    }

    expect(store.status).toBe(DemoUiStatus.Failed);
    expect(store.failure).toBe(DemoFailureReason.NotConfirmed);
    expect(scheduled).toHaveLength(0);
});

/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { InjectionsStore } from '../src/app/options/stores/InjectionsStore';
import { messenger } from '../src/app/common/messenger';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

vi.mock('../src/app/common/messenger', () => ({
    messenger: {
        getOptionsData: vi.fn(),
        getLocalSourceAccessStatus: vi.fn(),
        setLocalSourceAccessMethod: vi.fn(),
    },
}));

vi.mock('../src/app/common/i18n', () => ({
    i18n: {
        init: vi.fn().mockResolvedValue(undefined),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
});

const unavailableState = {
    kind: LocalSourceAccessMethod.NativeHost,
    permissionGranted: true,
    host: { status: NativeHostStatus.NotInstalled },
} as const;

const readyState = {
    kind: LocalSourceAccessMethod.NativeHost,
    permissionGranted: true,
    host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
} as const;

test('options initialization stores local-source access state', async () => {
    vi.mocked(messenger.getOptionsData).mockResolvedValue({
        localSourceAccess: unavailableState,
        localSourceAccessMethod: LocalSourceAccessMethod.NativeHost,
        injections: [],
        selectedLanguage: 'auto',
        appEnabled: true,
    });
    const store = new InjectionsStore({} as never);

    await store.getOptionsData();

    expect(store.localSourceAccess).toEqual(unavailableState);
    expect(store.localSourceAccessMethod).toBe(LocalSourceAccessMethod.NativeHost);
    expect(store.optionsDataReady).toBe(true);
});

test('options can refresh local-source access state without reloading its data', async () => {
    vi.mocked(messenger.getLocalSourceAccessStatus).mockResolvedValue(readyState);
    const store = new InjectionsStore({} as never);
    store.localSourceAccess = unavailableState;
    store.localSourceAccessMethod = LocalSourceAccessMethod.NativeHost;

    await store.refreshLocalSourceAccess();

    expect(store.localSourceAccess).toEqual(readyState);
    expect(messenger.getOptionsData).not.toHaveBeenCalled();
});

test('options can activate a selected local-source method', async () => {
    vi.mocked(messenger.setLocalSourceAccessMethod)
        .mockResolvedValue(LocalSourceAccessMethod.NativeHost);
    vi.mocked(messenger.getLocalSourceAccessStatus).mockResolvedValue(readyState);
    const store = new InjectionsStore({} as never);

    await store.setLocalSourceAccessMethod(LocalSourceAccessMethod.NativeHost);

    expect(messenger.setLocalSourceAccessMethod)
        .toHaveBeenCalledWith(LocalSourceAccessMethod.NativeHost);
    expect(store.localSourceAccess).toEqual(readyState);
    expect(store.localSourceAccessMethod).toBe(LocalSourceAccessMethod.NativeHost);
    expect(store.localSourceAccessMethodPending).toBe(false);
});

test('a stale readiness response cannot overwrite a newer method selection', async () => {
    let resolveStale: ((state: {
        kind: LocalSourceAccessMethod.Browser;
        allowed: boolean;
    }) => void) | undefined;
    const staleStatus = new Promise<{
        kind: LocalSourceAccessMethod.Browser;
        allowed: boolean;
    }>((resolve) => {
        resolveStale = resolve;
    });
    vi.mocked(messenger.getLocalSourceAccessStatus)
        .mockReturnValueOnce(staleStatus)
        .mockResolvedValueOnce(readyState);
    vi.mocked(messenger.setLocalSourceAccessMethod)
        .mockResolvedValue(LocalSourceAccessMethod.NativeHost);
    const store = new InjectionsStore({} as never);

    const staleRefresh = store.refreshLocalSourceAccess();
    const transition = store.setLocalSourceAccessMethod(LocalSourceAccessMethod.NativeHost);
    resolveStale?.({ kind: LocalSourceAccessMethod.Browser, allowed: false });
    await Promise.all([staleRefresh, transition]);

    expect(store.localSourceAccessMethod).toBe(LocalSourceAccessMethod.NativeHost);
    expect(store.localSourceAccess).toEqual(readyState);
});

test('method selector remains pending until background persistence completes', async () => {
    let resolveMethod: ((method: LocalSourceAccessMethod) => void) | undefined;
    vi.mocked(messenger.setLocalSourceAccessMethod).mockReturnValue(new Promise((resolve) => {
        resolveMethod = resolve;
    }));
    vi.mocked(messenger.getLocalSourceAccessStatus).mockResolvedValue(readyState);
    const store = new InjectionsStore({} as never);

    const transition = store.setLocalSourceAccessMethod(LocalSourceAccessMethod.NativeHost);
    expect(store.localSourceAccessMethodPending).toBe(true);
    expect(store.localSourceAccessMethod).toBe(LocalSourceAccessMethod.Browser);

    resolveMethod?.(LocalSourceAccessMethod.NativeHost);
    await transition;

    expect(store.localSourceAccessMethodPending).toBe(false);
    expect(store.localSourceAccessMethod).toBe(LocalSourceAccessMethod.NativeHost);
});

test('an outer method transition keeps the selector pending and rejects overlap', async () => {
    const store = new InjectionsStore({} as never);

    expect(store.beginLocalSourceAccessMethodTransition()).toBe(true);
    expect(store.localSourceAccessMethodPending).toBe(true);
    expect(store.beginLocalSourceAccessMethodTransition()).toBe(false);

    store.endLocalSourceAccessMethodTransition();

    expect(store.localSourceAccessMethodPending).toBe(false);
    expect(store.beginLocalSourceAccessMethodTransition()).toBe(true);
});

test('outer method transition remains pending through persistence and status refresh', async () => {
    let resolveStatus: ((state: typeof readyState) => void) | undefined;
    vi.mocked(messenger.setLocalSourceAccessMethod)
        .mockResolvedValue(LocalSourceAccessMethod.NativeHost);
    vi.mocked(messenger.getLocalSourceAccessStatus).mockReturnValue(new Promise((resolve) => {
        resolveStatus = resolve;
    }));
    const store = new InjectionsStore({} as never);
    store.beginLocalSourceAccessMethodTransition();

    const persistence = store.setLocalSourceAccessMethod(LocalSourceAccessMethod.NativeHost);
    await vi.waitFor(() => {
        expect(messenger.getLocalSourceAccessStatus).toHaveBeenCalled();
    });

    expect(store.localSourceAccessMethodPending).toBe(true);
    resolveStatus?.(readyState);
    await persistence;
    expect(store.localSourceAccessMethodPending).toBe(true);

    store.endLocalSourceAccessMethodTransition();
    expect(store.localSourceAccessMethodPending).toBe(false);
});

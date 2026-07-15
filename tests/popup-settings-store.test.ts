/**
 * @file Popup local-source access transitions.
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { messenger } from '../src/app/common/messenger';
import { nativeMessagingPermission } from '../src/app/common/native-messaging-permission';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';
import { SettingsStore } from '../src/app/popup/stores/SettingsStore';

vi.mock('../src/app/common/messenger', () => ({
    messenger: {
        getLocalSourceAccessStatus: vi.fn(),
        setLocalSourceAccessMethod: vi.fn(),
    },
}));

vi.mock('../src/app/common/native-messaging-permission', () => ({
    nativeMessagingPermission: {
        contains: vi.fn(),
        request: vi.fn(),
        remove: vi.fn(),
    },
}));

vi.mock('../src/app/common/log', () => ({
    log: { error: vi.fn() },
}));

vi.mock('../src/app/common/tabs', () => ({
    tabs: {},
}));

vi.mock('../src/app/common/i18n', () => ({
    i18n: {},
}));

const unavailableNativeHost = {
    kind: LocalSourceAccessMethod.NativeHost,
    permissionGranted: true,
    host: { status: NativeHostStatus.NotInstalled },
} as const;

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nativeMessagingPermission.remove).mockResolvedValue(true);
});

test('popup explicitly switches an unavailable Native Host to browser access', async () => {
    vi.mocked(messenger.setLocalSourceAccessMethod)
        .mockResolvedValue(LocalSourceAccessMethod.Browser);
    vi.mocked(messenger.getLocalSourceAccessStatus).mockResolvedValue({
        kind: LocalSourceAccessMethod.Browser,
        allowed: false,
    });
    const store = new SettingsStore({} as never);
    store.localSourceAccess = unavailableNativeHost;

    await store.useBrowserFileAccess();

    expect(messenger.setLocalSourceAccessMethod)
        .toHaveBeenCalledWith(LocalSourceAccessMethod.Browser);
    expect(nativeMessagingPermission.remove).toHaveBeenCalledOnce();
    expect(store.localSourceAccess).toEqual({
        kind: LocalSourceAccessMethod.Browser,
        allowed: false,
    });
    expect(store.localSourceAccessMethodPending).toBe(false);
});

test('popup keeps Native Host selected when switching methods fails', async () => {
    vi.mocked(messenger.setLocalSourceAccessMethod)
        .mockRejectedValue(new Error('save failed'));
    const store = new SettingsStore({} as never);
    store.localSourceAccess = unavailableNativeHost;

    await store.useBrowserFileAccess();

    expect(nativeMessagingPermission.remove).not.toHaveBeenCalled();
    expect(store.localSourceAccess).toEqual(unavailableNativeHost);
    expect(store.localSourceAccessMethodPending).toBe(false);
});

test('popup ignores overlapping browser-access transitions', async () => {
    const store = new SettingsStore({} as never);
    store.localSourceAccessMethodPending = true;

    await store.useBrowserFileAccess();

    expect(messenger.setLocalSourceAccessMethod).not.toHaveBeenCalled();
    expect(nativeMessagingPermission.remove).not.toHaveBeenCalled();
});

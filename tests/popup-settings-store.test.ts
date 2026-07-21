/**
 * @file Popup local-source access transitions.
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { InjectionField } from '../src/app/common/constants';
import { messenger } from '../src/app/common/messenger';
import { nativeMessagingPermission } from '../src/app/common/native-messaging-permission';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';
import { SettingsStore } from '../src/app/popup/stores/SettingsStore';

vi.mock('../src/app/common/messenger', () => ({
    messenger: {
        getLocalSourceAccessStatus: vi.fn(),
        setLocalSourceAccessMethod: vi.fn(),
        setInjectionFileEnabled: vi.fn(),
        openSettings: vi.fn(),
        openTab: vi.fn(),
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
    tabs: {
        reloadTab: vi.fn(),
        getOptionsUrlForSite: vi.fn(
            (site: string) => `chrome-extension://id/options.html?site=${site}`,
        ),
    },
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

const makeRule = (
    id: string,
    enabled: boolean,
    flags: { jsEnabled?: boolean; cssEnabled?: boolean } = {},
) => ({
    id,
    site: 'example.com',
    jsPath: 'file:///patch.js',
    cssPath: 'file:///theme.css',
    enabled,
    jsEnabled: flags.jsEnabled ?? true,
    cssEnabled: flags.cssEnabled ?? true,
});

test('matching-rule computeds derive from active files', () => {
    const store = new SettingsStore({} as never);
    store.matchingInjections = [makeRule('a', true), makeRule('b', false)];

    expect(store.siteHasEnabledInjections).toBe(true);
    expect(store.activeInjectionCount).toBe(1);

    // Enabled rule but both files off → not active.
    store.matchingInjections = [makeRule('a', true, { jsEnabled: false, cssEnabled: false })];
    expect(store.siteHasEnabledInjections).toBe(false);
    expect(store.activeInjectionCount).toBe(0);
});

test('toggling a file flips only that flag and reloads the tab', async () => {
    const { tabs } = await import('../src/app/common/tabs');
    const store = new SettingsStore({} as never);
    store.currentTab = { id: 5, url: 'https://example.com/' };
    store.matchingInjections = [makeRule('a', true)];
    vi.mocked(messenger.setInjectionFileEnabled)
        .mockResolvedValue(makeRule('a', true, { jsEnabled: false }));

    await store.toggleInjectionFile('a', InjectionField.JsPath);

    expect(messenger.setInjectionFileEnabled)
        .toHaveBeenCalledWith('a', InjectionField.JsPath, false);
    expect(store.matchingInjections[0].jsEnabled).toBe(false);
    expect(store.matchingInjections[0].cssEnabled).toBe(true);
    expect(tabs.reloadTab).toHaveBeenCalledWith(5);
});

test('toggling a file of an unknown rule does nothing', async () => {
    const { tabs } = await import('../src/app/common/tabs');
    const store = new SettingsStore({} as never);
    store.matchingInjections = [makeRule('a', true)];

    await store.toggleInjectionFile('missing', InjectionField.JsPath);

    expect(messenger.setInjectionFileEnabled).not.toHaveBeenCalled();
    expect(tabs.reloadTab).not.toHaveBeenCalled();
});

test('a null file-toggle response leaves state untouched and skips reload', async () => {
    const { tabs } = await import('../src/app/common/tabs');
    const store = new SettingsStore({} as never);
    store.currentTab = { id: 5, url: 'https://example.com/' };
    store.matchingInjections = [makeRule('a', true)];
    vi.mocked(messenger.setInjectionFileEnabled).mockResolvedValue(null);

    await store.toggleInjectionFile('a', InjectionField.JsPath);

    expect(store.matchingInjections[0].jsEnabled).toBe(true);
    expect(tabs.reloadTab).not.toHaveBeenCalled();
});

test('add-rule deep link carries the current tab host', async () => {
    const store = new SettingsStore({} as never);
    store.currentTab = { id: 5, url: 'https://www.example.com/page' };

    await store.openOptionsForCurrentSite();

    expect(messenger.openTab)
        .toHaveBeenCalledWith('chrome-extension://id/options.html?site=example.com');
    expect(messenger.openSettings).not.toHaveBeenCalled();
});

test('add-rule deep link falls back to plain settings without a host', async () => {
    const store = new SettingsStore({} as never);
    store.currentTab = { id: 5, url: undefined };

    await store.openOptionsForCurrentSite();

    expect(messenger.openSettings).toHaveBeenCalledOnce();
    expect(messenger.openTab).not.toHaveBeenCalled();
});

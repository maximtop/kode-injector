/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { messageHandler } from '../src/app/background/message-handler';
import { localSourceAccess } from '../src/app/background/local-source-access';
import { settings } from '../src/app/background/settings';
import { InjectionField, MESSAGE_TYPES } from '../src/app/common/constants';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

vi.mock('webextension-polyfill', () => ({
    default: {
        runtime: {
            onMessage: { addListener: vi.fn() },
        },
    },
}));

vi.mock('../src/app/background/local-source-access', () => ({
    localSourceAccess: {
        getState: vi.fn(),
        methodChanged: vi.fn(),
    },
}));

vi.mock('../src/app/background/injections', () => ({
    injections: {
        getInjections: vi.fn().mockReturnValue([]),
        getInjectionsByUrl: vi.fn().mockReturnValue([]),
        isSiteBlacklisted: vi.fn().mockReturnValue(false),
        addInjection: vi.fn(),
        updateInjection: vi.fn(),
        setInjectionFileEnabled: vi.fn(),
    },
}));

vi.mock('../src/app/background/settings', () => ({
    settings: {
        getSelectedLanguage: vi.fn().mockReturnValue('auto'),
        getLocalSourceAccessMethod: vi.fn().mockReturnValue('nativeHost'),
        setLocalSourceAccessMethod: vi.fn(),
        getSetting: vi.fn().mockReturnValue(true),
        getSettings: vi.fn().mockReturnValue({
            'app.enabled': true,
            'localSourceAccess.method': 'nativeHost',
            'language.selected': 'auto',
        }),
    },
}));

beforeEach(() => {
    vi.mocked(localSourceAccess.getState).mockReset();
    vi.mocked(localSourceAccess.methodChanged).mockReset();
    vi.mocked(settings.setLocalSourceAccessMethod).mockReset();
    vi.mocked(settings.setLocalSourceAccessMethod).mockResolvedValue(undefined);
});

const readyState = {
    kind: LocalSourceAccessMethod.NativeHost,
    permissionGranted: true,
    host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
} as const;

test('options data includes a fresh local-source access result', async () => {
    vi.mocked(localSourceAccess.getState).mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_OPTIONS_DATA,
    }, {})).resolves.toMatchObject({
        localSourceAccess: readyState,
        localSourceAccessMethod: LocalSourceAccessMethod.NativeHost,
        appEnabled: true,
    });
    expect(localSourceAccess.getState).toHaveBeenCalledOnce();
});

test('popup data includes a fresh local-source access result', async () => {
    vi.mocked(localSourceAccess.getState).mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_POPUP_DATA,
        data: { tab: { id: 7, url: 'https://example.com' } },
    }, {})).resolves.toMatchObject({
        localSourceAccess: readyState,
        matchingInjections: [],
    });
    expect(localSourceAccess.getState).toHaveBeenCalledOnce();
});

test('add-injection message forwards the initial enabled state', async () => {
    const { injections } = await import('../src/app/background/injections');
    const injectionData = { site: 'example.com', jsPath: '', cssPath: 'file:///theme.css' };

    await messageHandler.messageHandler({
        type: MESSAGE_TYPES.ADD_INJECTION,
        data: { injectionData, enabled: false },
    }, {});

    expect(injections.addInjection).toHaveBeenCalledWith(injectionData, false);
});

test('update-injection message forwards the rule id and data', async () => {
    const { injections } = await import('../src/app/background/injections');
    const injectionData = { site: 'example.com', jsPath: 'file:///patch.js', cssPath: '' };
    const updated = {
        id: 'rule-1', ...injectionData, enabled: true, jsEnabled: true, cssEnabled: true,
    };
    vi.mocked(injections.updateInjection).mockReturnValue(updated);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.UPDATE_INJECTION,
        data: { id: 'rule-1', injectionData },
    }, {})).resolves.toEqual(updated);

    expect(injections.updateInjection).toHaveBeenCalledWith('rule-1', injectionData);
});

test('set-injection-file-enabled forwards id, field and enabled', async () => {
    const { injections } = await import('../src/app/background/injections');
    const updated = {
        id: 'rule-1',
        site: 'example.com',
        jsPath: 'file:///patch.js',
        cssPath: '',
        enabled: true,
        jsEnabled: false,
        cssEnabled: true,
    };
    vi.mocked(injections.setInjectionFileEnabled).mockReturnValue(updated);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.SET_INJECTION_FILE_ENABLED,
        data: { id: 'rule-1', field: InjectionField.JsPath, enabled: false },
    }, {})).resolves.toEqual(updated);

    expect(injections.setInjectionFileEnabled)
        .toHaveBeenCalledWith('rule-1', InjectionField.JsPath, false);
});

test('set-injection-file-enabled rejects an unknown field', async () => {
    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.SET_INJECTION_FILE_ENABLED,
        data: { id: 'rule-1', field: 'bogus' as never, enabled: false },
    }, {})).rejects.toThrow();
});

test('local-source status message returns a fresh result', async () => {
    vi.mocked(localSourceAccess.getState).mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_LOCAL_SOURCE_ACCESS_STATUS,
    }, {})).resolves.toEqual(readyState);
    expect(localSourceAccess.getState).toHaveBeenCalledOnce();
});

test('local-source method message persists the selection before checking status', async () => {
    const getState = vi.mocked(localSourceAccess.getState);
    const setMethod = vi.mocked(settings.setLocalSourceAccessMethod);
    getState.mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.SET_LOCAL_SOURCE_ACCESS_METHOD,
        data: { method: LocalSourceAccessMethod.NativeHost },
    }, {})).resolves.toEqual(LocalSourceAccessMethod.NativeHost);

    expect(setMethod)
        .toHaveBeenCalledWith(LocalSourceAccessMethod.NativeHost);
    expect(setMethod.mock.invocationCallOrder[0])
        .toBeLessThan(
            vi.mocked(localSourceAccess.methodChanged).mock.invocationCallOrder[0] as number,
        );
    expect(localSourceAccess.methodChanged)
        .toHaveBeenCalledWith(LocalSourceAccessMethod.NativeHost);
    expect(getState).not.toHaveBeenCalled();
});

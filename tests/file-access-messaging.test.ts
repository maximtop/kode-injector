/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { messageHandler } from '../src/app/background/message-handler';
import { localSourceAccess } from '../src/app/background/local-source-access';
import { settings } from '../src/app/background/settings';
import { MESSAGE_TYPES } from '../src/app/common/constants';
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
        hasSiteEnabledInjections: vi.fn().mockReturnValue(false),
        isSiteBlacklisted: vi.fn().mockReturnValue(false),
    },
}));

vi.mock('../src/app/background/settings', () => ({
    settings: {
        getSelectedLanguage: vi.fn().mockReturnValue('auto'),
        getLocalSourceAccessMethod: vi.fn().mockReturnValue('nativeHost'),
        setLocalSourceAccessMethod: vi.fn(),
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
    });
    expect(localSourceAccess.getState).toHaveBeenCalledOnce();
});

test('popup data includes a fresh local-source access result', async () => {
    vi.mocked(localSourceAccess.getState).mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_POPUP_DATA,
        data: { tab: { id: 7, url: 'https://example.com' } },
    }, {})).resolves.toMatchObject({ localSourceAccess: readyState });
    expect(localSourceAccess.getState).toHaveBeenCalledOnce();
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

/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { messageHandler } from '../src/app/background/message-handler';
import { localSourceAccess } from '../src/app/background/local-source-access';
import { MESSAGE_TYPES } from '../src/app/common/constants';
import { LocalSourceAccessKind } from '../src/app/common/contracts';
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
        currentState: undefined,
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
        getSettings: vi.fn().mockReturnValue({
            'app.enabled': true,
            'language.selected': 'auto',
        }),
    },
}));

beforeEach(() => {
    vi.mocked(localSourceAccess.getState).mockReset();
    Object.defineProperty(localSourceAccess, 'currentState', {
        configurable: true,
        value: readyState,
    });
});

const readyState = {
    kind: LocalSourceAccessKind.NativeHost,
    host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
} as const;

test('options data includes a fresh local-source access result', async () => {
    vi.mocked(localSourceAccess.getState).mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_OPTIONS_DATA,
    }, {})).resolves.toMatchObject({ localSourceAccess: readyState });
    expect(localSourceAccess.getState).not.toHaveBeenCalled();
});

test('popup data includes a fresh local-source access result', async () => {
    vi.mocked(localSourceAccess.getState).mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_POPUP_DATA,
        data: { tab: { id: 7, url: 'https://example.com' } },
    }, {})).resolves.toMatchObject({ localSourceAccess: readyState });
    expect(localSourceAccess.getState).not.toHaveBeenCalled();
});

test('local-source status message returns a fresh result', async () => {
    vi.mocked(localSourceAccess.getState).mockResolvedValue(readyState);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_LOCAL_SOURCE_ACCESS_STATUS,
    }, {})).resolves.toEqual(readyState);
    expect(localSourceAccess.getState).toHaveBeenCalledOnce();
});

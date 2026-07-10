/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { messageHandler } from '../src/app/background/message-handler';
import { fileAccess } from '../src/app/background/file-access';
import { MESSAGE_TYPES } from '../src/app/common/constants';

vi.mock('webextension-polyfill', () => ({
    default: {
        runtime: {
            onMessage: { addListener: vi.fn() },
        },
    },
}));

vi.mock('../src/app/background/file-access', () => ({
    fileAccess: {
        isAllowed: vi.fn(),
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
    vi.mocked(fileAccess.isAllowed).mockReset();
});

test('options data includes a fresh file-access result', async () => {
    vi.mocked(fileAccess.isAllowed).mockResolvedValue(false);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_OPTIONS_DATA,
    }, {})).resolves.toMatchObject({ fileAccessAllowed: false });
    expect(fileAccess.isAllowed).toHaveBeenCalledOnce();
});

test('popup data includes a fresh file-access result', async () => {
    vi.mocked(fileAccess.isAllowed).mockResolvedValue(true);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_POPUP_DATA,
        data: { tab: { id: 7, url: 'https://example.com' } },
    }, {})).resolves.toMatchObject({ fileAccessAllowed: true });
    expect(fileAccess.isAllowed).toHaveBeenCalledOnce();
});

test('file-access status message returns a fresh result', async () => {
    vi.mocked(fileAccess.isAllowed)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_FILE_ACCESS_STATUS,
    }, {})).resolves.toBe(false);
    await expect(messageHandler.messageHandler({
        type: MESSAGE_TYPES.GET_FILE_ACCESS_STATUS,
    }, {})).resolves.toBe(true);
    expect(fileAccess.isAllowed).toHaveBeenCalledTimes(2);
});

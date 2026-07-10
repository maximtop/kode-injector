/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { InjectionsStore } from '../src/app/options/stores/InjectionsStore';
import { messenger } from '../src/app/common/messenger';

vi.mock('../src/app/common/messenger', () => ({
    messenger: {
        getOptionsData: vi.fn(),
        getFileAccessStatus: vi.fn(),
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

test('options initialization stores file-access state', async () => {
    vi.mocked(messenger.getOptionsData).mockResolvedValue({
        fileAccessAllowed: false,
        injections: [],
        selectedLanguage: 'auto',
    });
    const store = new InjectionsStore({} as never);

    await store.getOptionsData();

    expect(store.fileAccessAllowed).toBe(false);
    expect(store.optionsDataReady).toBe(true);
});

test('options can refresh file-access state without reloading its data', async () => {
    vi.mocked(messenger.getFileAccessStatus).mockResolvedValue(true);
    const store = new InjectionsStore({} as never);
    store.fileAccessAllowed = false;

    await store.refreshFileAccess();

    expect(store.fileAccessAllowed).toBe(true);
    expect(messenger.getOptionsData).not.toHaveBeenCalled();
});

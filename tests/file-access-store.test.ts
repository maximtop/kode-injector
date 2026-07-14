/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { InjectionsStore } from '../src/app/options/stores/InjectionsStore';
import { messenger } from '../src/app/common/messenger';
import { LocalSourceAccessKind } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

vi.mock('../src/app/common/messenger', () => ({
    messenger: {
        getOptionsData: vi.fn(),
        getLocalSourceAccessStatus: vi.fn(),
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
    kind: LocalSourceAccessKind.NativeHost,
    host: { status: NativeHostStatus.NotInstalled },
} as const;

const readyState = {
    kind: LocalSourceAccessKind.NativeHost,
    host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
} as const;

test('options initialization stores local-source access state', async () => {
    vi.mocked(messenger.getOptionsData).mockResolvedValue({
        localSourceAccess: unavailableState,
        injections: [],
        selectedLanguage: 'auto',
    });
    const store = new InjectionsStore({} as never);

    await store.getOptionsData();

    expect(store.localSourceAccess).toEqual(unavailableState);
    expect(store.optionsDataReady).toBe(true);
});

test('options can refresh local-source access state without reloading its data', async () => {
    vi.mocked(messenger.getLocalSourceAccessStatus).mockResolvedValue(readyState);
    const store = new InjectionsStore({} as never);
    store.localSourceAccess = unavailableState;

    await store.refreshLocalSourceAccess();

    expect(store.localSourceAccess).toEqual(readyState);
    expect(messenger.getOptionsData).not.toHaveBeenCalled();
});

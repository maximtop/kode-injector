/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { SETTINGS } from '../src/app/common/constants';
import {
    SettingsService,
    type SettingsStorage,
} from '../src/app/background/settings-service';
import {
    LocalSourceAccessMethod,
    normalizeAppSettingsWithRepair,
    type AppSettings,
} from '../src/app/common/contracts';
import { BrowserTarget } from '../src/app/common/browser-target';

class FakeStorage {
    private value: unknown;

    public writes: AppSettings[] = [];

    constructor(value: unknown) {
        this.value = value;
    }

    async get<TValue>(_key: string): Promise<TValue | undefined> {
        return this.value as TValue | undefined;
    }

    async set<TValue>(_key: string, value: TValue): Promise<void> {
        this.value = value;
        this.writes.push(value as AppSettings);
    }
}

interface ControlledWrite {
    resolve: () => void;
}

/**
 * Controllable settings storage used by concurrency tests.
 */
interface ControlledStorage extends SettingsStorage {
    writes: AppSettings[];
    activeWrites: number;
    maximumActiveWrites: number;
    completeNextWrite: () => void;
    getValue: () => unknown;
}

/**
 * Creates storage that holds each write until the test allows it to finish.
 *
 * @param initialValue Initial persisted value.
 *
 * @returns Controllable settings storage.
 */
const createControlledStorage = (initialValue: unknown): ControlledStorage => {
    let value = initialValue;
    const pendingWrites: ControlledWrite[] = [];

    const controlledStorage: ControlledStorage = {
        writes: [],
        activeWrites: 0,
        maximumActiveWrites: 0,
        async get<TValue>(_key: string): Promise<TValue | undefined> {
            return value as TValue | undefined;
        },
        async set<TValue>(_key: string, nextValue: TValue): Promise<void> {
            this.writes.push(nextValue as AppSettings);
            this.activeWrites += 1;
            this.maximumActiveWrites = Math.max(
                this.maximumActiveWrites,
                this.activeWrites,
            );

            await new Promise<void>((resolve) => {
                pendingWrites.push({ resolve });
            });

            value = nextValue;
            this.activeWrites -= 1;
        },
        completeNextWrite(): void {
            const pendingWrite = pendingWrites.shift();
            if (!pendingWrite) {
                throw new Error('No controlled settings write is pending');
            }
            pendingWrite.resolve();
        },
        getValue(): unknown {
            return value;
        },
    };

    return controlledStorage;
};

test('valid app settings do not require repair', () => {
    const settings: AppSettings = {
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.NativeHost,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    };

    expect(normalizeAppSettingsWithRepair(settings, BrowserTarget.Chrome)).toEqual({
        settings,
        shouldRepair: false,
    });
});

test('invalid language normalization preserves a valid app state', () => {
    expect(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
        [SETTINGS.SELECTED_LANGUAGE]: 'unsupported',
    }, BrowserTarget.Chrome)).toEqual({
        settings: {
            [SETTINGS.APP_ENABLED]: false,
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
            [SETTINGS.SELECTED_LANGUAGE]: 'auto',
        },
        shouldRepair: true,
    });
});

test('invalid app state normalization preserves a valid language', () => {
    expect(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: 'yes',
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    }, BrowserTarget.Chrome)).toEqual({
        settings: {
            [SETTINGS.APP_ENABLED]: true,
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
            [SETTINGS.SELECTED_LANGUAGE]: 'de',
        },
        shouldRepair: true,
    });
});

test('unexpected settings properties require strict repair', () => {
    expect(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
        unexpected: true,
    }, BrowserTarget.Chrome)).toEqual({
        settings: {
            [SETTINGS.APP_ENABLED]: true,
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
            [SETTINGS.SELECTED_LANGUAGE]: 'de',
        },
        shouldRepair: true,
    });
});

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    'legacy settings default to browser access for %s',
    async (browserTarget) => {
        const storage = new FakeStorage({ [SETTINGS.APP_ENABLED]: false });
        const service = new SettingsService(storage, browserTarget);

        await service.init();

        expect(service.getSettings()).toEqual({
            [SETTINGS.APP_ENABLED]: false,
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
            [SETTINGS.SELECTED_LANGUAGE]: 'auto',
        });
        expect(storage.writes[storage.writes.length - 1]).toEqual(service.getSettings());
    },
);

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    'invalid local-source access defaults to browser access for %s',
    (browserTarget) => {
        expect(normalizeAppSettingsWithRepair({
            [SETTINGS.APP_ENABLED]: true,
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: 'unsupported',
            [SETTINGS.SELECTED_LANGUAGE]: 'de',
        }, browserTarget)).toEqual({
            settings: {
                [SETTINGS.APP_ENABLED]: true,
                [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
                [SETTINGS.SELECTED_LANGUAGE]: 'de',
            },
            shouldRepair: true,
        });
    },
);

test('legacy Firefox settings default to native-host access', async () => {
    const storage = new FakeStorage({ [SETTINGS.APP_ENABLED]: false });
    const service = new SettingsService(storage, BrowserTarget.Firefox);

    await service.init();

    expect(service.getSettings()).toEqual({
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.NativeHost,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    });
    expect(storage.writes[storage.writes.length - 1]).toEqual(service.getSettings());
});

test('invalid Firefox local-source access defaults to native-host access', () => {
    expect(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: 'unsupported',
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    }, BrowserTarget.Firefox)).toEqual({
        settings: {
            [SETTINGS.APP_ENABLED]: true,
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.NativeHost,
            [SETTINGS.SELECTED_LANGUAGE]: 'de',
        },
        shouldRepair: true,
    });
});

test('Firefox coerces persisted browser access to native-host access', async () => {
    const storage = new FakeStorage({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    });
    const service = new SettingsService(storage, BrowserTarget.Firefox);

    await service.init();

    expect(service.getLocalSourceAccessMethod()).toBe(LocalSourceAccessMethod.NativeHost);
    expect(storage.writes).toHaveLength(1);
    expect(
        storage.writes[0]?.[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD],
    ).toBe(LocalSourceAccessMethod.NativeHost);
});

test('Chrome preserves a persisted native-host selection', async () => {
    const storage = new FakeStorage({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.NativeHost,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    });
    const service = new SettingsService(storage, BrowserTarget.Chrome);

    await service.init();

    expect(service.getLocalSourceAccessMethod()).toBe(LocalSourceAccessMethod.NativeHost);
    expect(storage.writes).toHaveLength(0);
});

test('invalid language repairs to auto', async () => {
    const storage = new FakeStorage({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
        [SETTINGS.SELECTED_LANGUAGE]: 'zh_TW',
    });
    const service = new SettingsService(storage, BrowserTarget.Chrome);

    await service.init();

    expect(service.getSelectedLanguage()).toBe('auto');
    expect(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.SELECTED_LANGUAGE],
    ).toBe('auto');
});

test('setSelectedLanguage persists before resolving', async () => {
    const storage = new FakeStorage(undefined);
    const service = new SettingsService(storage, BrowserTarget.Chrome);
    await service.init();

    await service.setSelectedLanguage('de');

    expect(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.SELECTED_LANGUAGE],
    ).toBe('de');
    expect(service.getSelectedLanguage()).toBe('de');
});

test('interleaved enabled, method, and language writes stay serialized', async () => {
    const initialSettings: AppSettings = {
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    };
    const storage = createControlledStorage(initialSettings);
    const service = new SettingsService(storage, BrowserTarget.Chrome);
    await service.init();

    const enabledWrite = service.setSetting(SETTINGS.APP_ENABLED, false);
    const methodWrite = service.setLocalSourceAccessMethod(
        LocalSourceAccessMethod.NativeHost,
    );
    const languageWrite = service.setSelectedLanguage('de');

    await vi.waitFor(() => {
        expect(storage.writes).toHaveLength(1);
    });
    expect(storage.writes[0]).toEqual({
        ...initialSettings,
        [SETTINGS.APP_ENABLED]: false,
    });
    expect(storage.activeWrites).toBe(1);

    storage.completeNextWrite();
    await vi.waitFor(() => {
        expect(storage.writes).toHaveLength(2);
    });
    expect(storage.writes[1]).toEqual({
        ...initialSettings,
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.NativeHost,
    });

    storage.completeNextWrite();
    await vi.waitFor(() => {
        expect(storage.writes).toHaveLength(3);
    });
    const finalSettings: AppSettings = {
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.NativeHost,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    };
    expect(storage.writes[2]).toEqual(finalSettings);

    storage.completeNextWrite();
    await Promise.all([enabledWrite, methodWrite, languageWrite]);

    expect(storage.maximumActiveWrites).toBe(1);
    expect(storage.getValue()).toEqual(finalSettings);
    expect(service.getSettings()).toEqual(finalSettings);
});

test('an app toggle queued behind a method write preserves both updates', async () => {
    const initialSettings: AppSettings = {
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.Browser,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    };
    const storage = createControlledStorage(initialSettings);
    const service = new SettingsService(storage, BrowserTarget.Chrome);
    await service.init();

    const methodWrite = service.setLocalSourceAccessMethod(
        LocalSourceAccessMethod.NativeHost,
    );
    const enabledWrite = service.setSetting(SETTINGS.APP_ENABLED, false);

    await vi.waitFor(() => {
        expect(storage.writes).toHaveLength(1);
    });
    storage.completeNextWrite();
    await vi.waitFor(() => {
        expect(storage.writes).toHaveLength(2);
    });

    const finalSettings: AppSettings = {
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: LocalSourceAccessMethod.NativeHost,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    };
    expect(storage.writes[1]).toEqual(finalSettings);

    storage.completeNextWrite();
    await Promise.all([methodWrite, enabledWrite]);

    expect(storage.maximumActiveWrites).toBe(1);
    expect(storage.getValue()).toEqual(finalSettings);
    expect(service.getSettings()).toEqual(finalSettings);
});

test('setLocalSourceAccessMethod persists a Chromium native-host selection', async () => {
    const storage = new FakeStorage(undefined);
    const service = new SettingsService(storage, BrowserTarget.Edge);
    await service.init();

    await service.setLocalSourceAccessMethod(LocalSourceAccessMethod.NativeHost);

    expect(service.getLocalSourceAccessMethod()).toBe(LocalSourceAccessMethod.NativeHost);
    expect(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD],
    ).toBe(LocalSourceAccessMethod.NativeHost);
});

test('failed local-source method persistence preserves the current runtime method', async () => {
    const storage = new FakeStorage(undefined);
    const service = new SettingsService(storage, BrowserTarget.Chrome);
    await service.init();
    vi.spyOn(storage, 'set').mockRejectedValueOnce(new Error('WRITE_FAILED'));

    await expect(
        service.setLocalSourceAccessMethod(LocalSourceAccessMethod.NativeHost),
    ).rejects.toThrow('WRITE_FAILED');

    expect(service.getLocalSourceAccessMethod()).toBe(LocalSourceAccessMethod.Browser);
});

test('setLocalSourceAccessMethod cannot select browser access on Firefox', async () => {
    const storage = new FakeStorage(undefined);
    const service = new SettingsService(storage, BrowserTarget.Firefox);
    await service.init();

    await service.setLocalSourceAccessMethod(LocalSourceAccessMethod.Browser);

    expect(service.getLocalSourceAccessMethod()).toBe(LocalSourceAccessMethod.NativeHost);
    expect(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD],
    ).toBe(LocalSourceAccessMethod.NativeHost);
});

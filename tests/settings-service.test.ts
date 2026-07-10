/**
 * @file
 */

import { expect, test } from 'vitest';

import { SETTINGS, STORAGE_KEYS } from '../src/app/common/constants';
import { SettingsService } from '../src/app/background/settings-service';
import {
    normalizeAppSettingsWithRepair,
    type AppSettings,
} from '../src/app/common/contracts';

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

test('valid app settings do not require repair', () => {
    const settings: AppSettings = {
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    };

    expect(normalizeAppSettingsWithRepair(settings)).toEqual({
        settings,
        shouldRepair: false,
    });
});

test('invalid language normalization preserves a valid app state', () => {
    expect(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.SELECTED_LANGUAGE]: 'unsupported',
    })).toEqual({
        settings: {
            [SETTINGS.APP_ENABLED]: false,
            [SETTINGS.SELECTED_LANGUAGE]: 'auto',
        },
        shouldRepair: true,
    });
});

test('invalid app state normalization preserves a valid language', () => {
    expect(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: 'yes',
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    })).toEqual({
        settings: {
            [SETTINGS.APP_ENABLED]: true,
            [SETTINGS.SELECTED_LANGUAGE]: 'de',
        },
        shouldRepair: true,
    });
});

test('unexpected settings properties require strict repair', () => {
    expect(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
        unexpected: true,
    })).toEqual({
        settings: {
            [SETTINGS.APP_ENABLED]: true,
            [SETTINGS.SELECTED_LANGUAGE]: 'de',
        },
        shouldRepair: true,
    });
});

test('legacy settings retain app state and default language to auto', async () => {
    const storage = new FakeStorage({ [SETTINGS.APP_ENABLED]: false });
    const service = new SettingsService(storage);

    await service.init();

    expect(service.getSettings()).toEqual({
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    });
    expect(storage.writes[storage.writes.length - 1]).toEqual(service.getSettings());
});

test('invalid language repairs to auto', async () => {
    const storage = new FakeStorage({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.SELECTED_LANGUAGE]: 'zh_TW',
    });
    const service = new SettingsService(storage);

    await service.init();

    expect(service.getSelectedLanguage()).toBe('auto');
    expect(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.SELECTED_LANGUAGE],
    ).toBe('auto');
});

test('setSelectedLanguage persists before resolving', async () => {
    const storage = new FakeStorage(undefined);
    const service = new SettingsService(storage);
    await service.init();

    await service.setSelectedLanguage('de');

    expect(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.SELECTED_LANGUAGE],
    ).toBe('de');
    expect(service.getSelectedLanguage()).toBe('de');
});

test('settings expose the expected storage key', () => {
    expect(STORAGE_KEYS.SETTINGS).toBe('settings');
});

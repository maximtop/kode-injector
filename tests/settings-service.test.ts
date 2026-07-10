/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

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

    assert.deepEqual(normalizeAppSettingsWithRepair(settings), {
        settings,
        shouldRepair: false,
    });
});

test('invalid language normalization preserves a valid app state', () => {
    assert.deepEqual(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.SELECTED_LANGUAGE]: 'unsupported',
    }), {
        settings: {
            [SETTINGS.APP_ENABLED]: false,
            [SETTINGS.SELECTED_LANGUAGE]: 'auto',
        },
        shouldRepair: true,
    });
});

test('invalid app state normalization preserves a valid language', () => {
    assert.deepEqual(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: 'yes',
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
    }), {
        settings: {
            [SETTINGS.APP_ENABLED]: true,
            [SETTINGS.SELECTED_LANGUAGE]: 'de',
        },
        shouldRepair: true,
    });
});

test('unexpected settings properties require strict repair', () => {
    assert.deepEqual(normalizeAppSettingsWithRepair({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.SELECTED_LANGUAGE]: 'de',
        unexpected: true,
    }), {
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

    assert.deepEqual(service.getSettings(), {
        [SETTINGS.APP_ENABLED]: false,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    });
    assert.deepEqual(storage.writes[storage.writes.length - 1], service.getSettings());
});

test('invalid language repairs to auto', async () => {
    const storage = new FakeStorage({
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.SELECTED_LANGUAGE]: 'zh_TW',
    });
    const service = new SettingsService(storage);

    await service.init();

    assert.equal(service.getSelectedLanguage(), 'auto');
    assert.equal(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.SELECTED_LANGUAGE],
        'auto',
    );
});

test('setSelectedLanguage persists before resolving', async () => {
    const storage = new FakeStorage(undefined);
    const service = new SettingsService(storage);
    await service.init();

    await service.setSelectedLanguage('de');

    assert.equal(
        storage.writes[storage.writes.length - 1]?.[SETTINGS.SELECTED_LANGUAGE],
        'de',
    );
    assert.equal(service.getSelectedLanguage(), 'de');
});

test('settings expose the expected storage key', () => {
    assert.equal(STORAGE_KEYS.SETTINGS, 'settings');
});

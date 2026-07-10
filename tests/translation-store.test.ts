/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { TranslationStore, type AvailableLocale, type LocalePreference } from '../src/app/common/locale';

const createService = (
    resolved: AvailableLocale,
    fail = false,
) => {
    let calls = 0;
    return {
        get calls(): number {
            return calls;
        },
        async loadLocaleData(_preference?: LocalePreference): Promise<AvailableLocale> {
            calls += 1;
            if (fail) {
                throw new Error('load failed');
            }
            return resolved;
        },
    };
};

test('store resolves preference and direction atomically', async () => {
    const service = createService('ar');
    const store = new TranslationStore(service);
    await store.init('ar');

    assert.equal(store.userLocalePreference, 'ar');
    assert.equal(store.currentLocale, 'ar');
    assert.equal(store.direction, 'rtl');
    assert.equal(store.htmlLanguage, 'ar');
    assert.equal(store.isLoading, false);
});

test('first-time auto initialization is not skipped', async () => {
    const service = createService('de');
    const store = new TranslationStore(service);
    await store.init();

    assert.equal(service.calls, 1);
    assert.equal(store.currentLocale, 'de');
});

test('failed locale activation keeps the preference and falls back to English', async () => {
    const service = createService('de', true);
    const store = new TranslationStore(service);
    await store.setLocalePreference('de');

    assert.equal(store.userLocalePreference, 'de');
    assert.equal(store.currentLocale, 'en');
    assert.equal(store.isLoading, false);
});

test('reapplying an active preference does not load again', async () => {
    const service = createService('de');
    const store = new TranslationStore(service);
    await store.init('de');
    await store.setLocalePreference('de');

    assert.equal(service.calls, 1);
});

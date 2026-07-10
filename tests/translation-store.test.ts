/**
 * @file
 */

import { expect, test } from 'vitest';

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

    expect(store.userLocalePreference).toBe('ar');
    expect(store.currentLocale).toBe('ar');
    expect(store.direction).toBe('rtl');
    expect(store.htmlLanguage).toBe('ar');
    expect(store.isLoading).toBe(false);
});

test('first-time auto initialization is not skipped', async () => {
    const service = createService('de');
    const store = new TranslationStore(service);
    await store.init();

    expect(service.calls).toBe(1);
    expect(store.currentLocale).toBe('de');
});

test('failed locale activation keeps the preference and falls back to English', async () => {
    const service = createService('de', true);
    const store = new TranslationStore(service);
    await store.setLocalePreference('de');

    expect(store.userLocalePreference).toBe('de');
    expect(store.currentLocale).toBe('en');
    expect(store.isLoading).toBe(false);
});

test('reapplying an active preference does not load again', async () => {
    const service = createService('de');
    const store = new TranslationStore(service);
    await store.init('de');
    await store.setLocalePreference('de');

    expect(service.calls).toBe(1);
});

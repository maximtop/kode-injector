/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BASE_LOCALE,
    LANGUAGE_AUTO,
    type MessagesJson,
    TranslationService,
} from '../src/js/common/locale';

const FIXTURES: Record<string, MessagesJson> = {
    en: {
        greeting: { message: 'Hello' },
        english_only: { message: 'English only' },
    },
    de: {
        greeting: { message: 'Hallo' },
    },
};

const createService = (browserLocale = 'en') => {
    const calls: string[] = [];
    const service = new TranslationService({
        getUILanguage: () => browserLocale,
        getURL: (path) => `extension://${path}`,
        fetchJson: async (url) => {
            calls.push(url);
            const locale = url.match(/_locales\/([^/]+)\/messages\.json$/)?.[1];
            if (!locale) {
                throw new Error(`Invalid locale URL ${url}`);
            }
            const messages = FIXTURES[locale];
            if (!messages) {
                throw new Error(`Missing fixture ${locale}`);
            }
            return messages;
        },
    });
    return { service, calls };
};

test('loads English and the browser locale in auto mode', async () => {
    const { service, calls } = createService('de');
    const resolved = await service.loadLocaleData();

    assert.equal(resolved, 'de');
    assert.deepEqual(calls, [
        'extension://_locales/en/messages.json',
        'extension://_locales/de/messages.json',
    ]);
    assert.equal(service.getMessage('de', 'greeting'), 'Hallo');
});

test('uses cache for repeated and concurrent loads', async () => {
    const { service, calls } = createService('de');
    await Promise.all([service.loadLocale('de'), service.loadLocale('de')]);

    assert.equal(calls.length, 1);
});

test('uses explicit preference instead of browser locale', async () => {
    const { service } = createService('en');
    assert.equal(await service.loadLocaleData('de'), 'de');
    assert.equal(service.getMessage('de', 'greeting'), 'Hallo');
});

test('returns English for unsupported and Traditional Chinese browser locales', async () => {
    const unsupported = createService('xx-YY').service;
    assert.equal(await unsupported.loadLocaleData(LANGUAGE_AUTO), BASE_LOCALE);

    const traditional = createService('zh-Hant-TW').service;
    assert.equal(await traditional.loadLocaleData(), BASE_LOCALE);
});

test('returns empty for missing translated keys and throws for missing English keys', async () => {
    const { service } = createService();
    await service.loadLocaleData('de');

    assert.equal(service.getMessage('de', 'english_only'), '');
    assert.throws(() => service.getMessage('de', 'unknown'), /There is no such key "unknown"/);
});

test('formats locale codes for the translator library', () => {
    const { service } = createService();
    assert.equal(service.getUILanguage('en'), 'en');
    assert.equal(service.getUILanguage('pt_BR'), 'pt_br');
    assert.equal(service.getUILanguage('zh_CN'), 'zh_cn');
    assert.equal(service.getBaseUILanguage(), 'en');
});

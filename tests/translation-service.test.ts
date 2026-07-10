/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    BASE_LOCALE,
    LANGUAGE_AUTO,
    type MessagesJson,
    TranslationService,
} from '../src/app/common/locale';

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

    expect(resolved).toBe('de');
    expect(calls).toEqual([
        'extension://_locales/en/messages.json',
        'extension://_locales/de/messages.json',
    ]);
    expect(service.getMessage('de', 'greeting')).toBe('Hallo');
});

test('uses cache for repeated and concurrent loads', async () => {
    const { service, calls } = createService('de');
    await Promise.all([service.loadLocale('de'), service.loadLocale('de')]);

    expect(calls).toHaveLength(1);
});

test('uses explicit preference instead of browser locale', async () => {
    const { service } = createService('en');
    expect(await service.loadLocaleData('de')).toBe('de');
    expect(service.getMessage('de', 'greeting')).toBe('Hallo');
});

test('returns English for unsupported and Traditional Chinese browser locales', async () => {
    const unsupported = createService('xx-YY').service;
    expect(await unsupported.loadLocaleData(LANGUAGE_AUTO)).toBe(BASE_LOCALE);

    const traditional = createService('zh-Hant-TW').service;
    expect(await traditional.loadLocaleData()).toBe(BASE_LOCALE);
});

test('returns empty for missing translated keys and throws for missing English keys', async () => {
    const { service } = createService();
    await service.loadLocaleData('de');

    expect(service.getMessage('de', 'english_only')).toBe('');
    expect(() => service.getMessage('de', 'unknown')).toThrow(/There is no such key "unknown"/);
});

test('formats locale codes for the translator library', () => {
    const { service } = createService();
    expect(service.getUILanguage('en')).toBe('en');
    expect(service.getUILanguage('pt_BR')).toBe('pt_br');
    expect(service.getUILanguage('zh_CN')).toBe('zh_cn');
    expect(service.getBaseUILanguage()).toBe('en');
});

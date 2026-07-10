/**
 * @file
 */

import { fallback, parse, picklist } from 'valibot';

/**
 * Base locale used for source messages and runtime fallback.
 */
export const BASE_LOCALE = 'en' as const;

/**
 * Sentinel value meaning that the browser UI language should be used.
 */
export const LANGUAGE_AUTO = 'auto' as const;

/**
 * Supported locale directory names.
 */
export const AVAILABLE_LOCALES = [
    'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi',
    'fr', 'he', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pl',
    'pt_BR', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'vi', 'zh_CN',
] as const;

/**
 * Supported concrete locale union.
 */
export type AvailableLocale = typeof AVAILABLE_LOCALES[number];

/**
 * Persisted locale preference union.
 */
export type LocalePreference = AvailableLocale | typeof LANGUAGE_AUTO;

/**
 * Strict schema for supported persisted locale preferences.
 */
export const localePreferenceValueSchema = picklist([
    LANGUAGE_AUTO,
    ...AVAILABLE_LOCALES,
]);

/**
 * Locale preference schema that recovers unsupported values to auto.
 */
export const localePreferenceSchema = fallback(
    localePreferenceValueSchema,
    LANGUAGE_AUTO,
);

/**
 * Native language names shown in the selector.
 */
export const LANGUAGE_NAMES: Record<AvailableLocale, string> = {
    ar: 'العربية',
    bg: 'Български',
    cs: 'Čeština',
    da: 'Dansk',
    de: 'Deutsch',
    el: 'Ελληνικά',
    en: 'English',
    es: 'Español',
    fa: 'فارسی',
    fi: 'Suomi',
    fr: 'Français',
    he: 'עברית',
    hr: 'Hrvatski',
    hu: 'Magyar',
    id: 'Bahasa Indonesia',
    it: 'Italiano',
    ja: '日本語',
    ko: '한국어',
    nl: 'Nederlands',
    pl: 'Polski',
    pt_BR: 'Português (Brasil)',
    ro: 'Română',
    ru: 'Русский',
    sk: 'Slovenčina',
    sv: 'Svenska',
    th: 'ไทย',
    tr: 'Türkçe',
    uk: 'Українська',
    vi: 'Tiếng Việt',
    zh_CN: '简体中文',
};

/**
 * Locale codes whose scripts read from right to left.
 */
export const RTL_LOCALES = new Set<AvailableLocale>(['ar', 'fa', 'he']);

/**
 * Validates a persisted language preference.
 *
 * @param value Unknown value read from storage.
 *
 * @returns A supported preference or auto.
 */
export const toLocalePreference = (value: unknown): LocalePreference => {
    return parse(localePreferenceSchema, value);
};

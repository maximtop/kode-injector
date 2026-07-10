/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    AVAILABLE_LOCALES,
    LANGUAGE_AUTO,
    LANGUAGE_NAMES,
    RTL_LOCALES,
    toLocalePreference,
} from '../src/app/common/locale';

test('locale constants define the exact supported set', () => {
    expect(AVAILABLE_LOCALES).toHaveLength(30);
    expect(AVAILABLE_LOCALES).toEqual([
        'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi',
        'fr', 'he', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pl',
        'pt_BR', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'vi', 'zh_CN',
    ]);
    expect([...RTL_LOCALES].sort()).toEqual(['ar', 'fa', 'he']);
    expect(Object.keys(LANGUAGE_NAMES)).toHaveLength(30);
});

test('unknown preferences self-normalize to auto', () => {
    expect(toLocalePreference('de')).toBe('de');
    expect(toLocalePreference(LANGUAGE_AUTO)).toBe(LANGUAGE_AUTO);
    expect(toLocalePreference('zh_TW')).toBe(LANGUAGE_AUTO);
    expect(toLocalePreference(null)).toBe(LANGUAGE_AUTO);
});

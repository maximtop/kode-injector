/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    AVAILABLE_LOCALES,
    LANGUAGE_NAMES,
} from '../src/app/common/locale';
import { buildLanguageOptions } from '../src/app/options/components/SettingsView/language-options';

// Derived from the source constant rather than hardcoded, so this test keeps
// checking real behavior (one option per locale, plus "auto") instead of
// breaking whenever a locale is added or removed.
const EXPECTED_OPTION_COUNT = AVAILABLE_LOCALES.length + 1;

test('auto selection places browser language first', () => {
    const options = buildLanguageOptions('auto', 'Browser language');

    expect(options).toHaveLength(EXPECTED_OPTION_COUNT);
    expect(options[0]).toEqual({ value: 'auto', label: 'Browser language' });
    expect(new Set(options.map(({ value }) => value)).size).toBe(EXPECTED_OPTION_COUNT);
});

test('explicit selection is first and browser language is second', () => {
    const options = buildLanguageOptions('ja', 'Browser language');

    expect(options[0]).toEqual({ value: 'ja', label: LANGUAGE_NAMES.ja });
    expect(options[1]).toEqual({ value: 'auto', label: 'Browser language' });
    expect(options.filter(({ value }) => value === 'ja')).toHaveLength(1);
});

test('remaining options are sorted by native name', () => {
    const options = buildLanguageOptions('ja', 'Browser language');
    const labels = options.slice(2).map(({ label }) => label);

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
});

test('falls back to auto-first ordering when the selected language is not available', () => {
    const options = buildLanguageOptions(
        'not-a-real-locale' as unknown as Parameters<typeof buildLanguageOptions>[0],
        'Browser language',
    );

    expect(options).toHaveLength(EXPECTED_OPTION_COUNT);
    expect(options[0]).toEqual({ value: 'auto', label: 'Browser language' });
});

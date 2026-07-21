/**
 * @file
 */

import { expect, test } from 'vitest';

import { buildLanguageOptions } from '../src/app/options/components/SettingsView/language-options';

test('auto selection places browser language first', () => {
    const options = buildLanguageOptions('auto', 'Browser language');

    expect(options).toHaveLength(31);
    expect(options[0]).toEqual({ value: 'auto', label: 'Browser language' });
    expect(new Set(options.map(({ value }) => value)).size).toBe(31);
});

test('explicit selection is first and browser language is second', () => {
    const options = buildLanguageOptions('ja', 'Browser language');

    expect(options[0]).toEqual({ value: 'ja', label: '日本語' });
    expect(options[1]).toEqual({ value: 'auto', label: 'Browser language' });
});

test('remaining options are sorted by native name', () => {
    const options = buildLanguageOptions('ja', 'Browser language');
    const labels = options.slice(2).map(({ label }) => label);

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
});

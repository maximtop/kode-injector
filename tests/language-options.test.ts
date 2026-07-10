/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLanguageOptions } from '../src/app/options/components/LanguageSelect/language-options';

test('auto selection places browser language first', () => {
    const options = buildLanguageOptions('auto', 'Browser language');

    assert.equal(options.length, 31);
    assert.deepEqual(options[0], { value: 'auto', label: 'Browser language' });
    assert.equal(new Set(options.map(({ value }) => value)).size, 31);
});

test('explicit selection is first and browser language is second', () => {
    const options = buildLanguageOptions('ja', 'Browser language');

    assert.deepEqual(options[0], { value: 'ja', label: '日本語' });
    assert.deepEqual(options[1], { value: 'auto', label: 'Browser language' });
});

test('remaining options are sorted by native name', () => {
    const options = buildLanguageOptions('ja', 'Browser language');
    const labels = options.slice(2).map(({ label }) => label);

    assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b)));
});

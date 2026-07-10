/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AVAILABLE_LOCALES,
    LANGUAGE_AUTO,
    LANGUAGE_NAMES,
    RTL_LOCALES,
    toLocalePreference,
} from '../src/js/common/locale';

test('locale constants define the exact supported set', () => {
    assert.equal(AVAILABLE_LOCALES.length, 30);
    assert.deepEqual(AVAILABLE_LOCALES, [
        'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi',
        'fr', 'he', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'pl',
        'pt_BR', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'vi', 'zh_CN',
    ]);
    assert.deepEqual([...RTL_LOCALES].sort(), ['ar', 'fa', 'he']);
    assert.equal(Object.keys(LANGUAGE_NAMES).length, 30);
});

test('unknown preferences self-normalize to auto', () => {
    assert.equal(toLocalePreference('de'), 'de');
    assert.equal(toLocalePreference(LANGUAGE_AUTO), LANGUAGE_AUTO);
    assert.equal(toLocalePreference('zh_TW'), LANGUAGE_AUTO);
    assert.equal(toLocalePreference(null), LANGUAGE_AUTO);
});

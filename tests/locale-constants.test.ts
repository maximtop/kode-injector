/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    LANGUAGE_AUTO,
    toLocalePreference,
} from '../src/app/common/locale';

test('unknown preferences self-normalize to auto', () => {
    expect(toLocalePreference('de')).toBe('de');
    expect(toLocalePreference(LANGUAGE_AUTO)).toBe(LANGUAGE_AUTO);
    expect(toLocalePreference('zh_TW')).toBe(LANGUAGE_AUTO);
    expect(toLocalePreference(null)).toBe(LANGUAGE_AUTO);
});

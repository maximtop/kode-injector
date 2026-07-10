/**
 * @file
 */

import { expect, test } from 'vitest';

import { AVAILABLE_LOCALES, checkLocale } from '../src/app/common/locale';

const CASES: Array<[string | null, string | null]> = [
    ['EN', 'en'],
    ['en-GB', 'en'],
    ['es-MX', 'es'],
    ['pt', 'pt_BR'],
    ['pt-PT', 'pt_BR'],
    ['zh', 'zh_CN'],
    ['zh-CN', 'zh_CN'],
    ['zh-Hans-CN', 'zh_CN'],
    ['zh-SG', 'zh_CN'],
    ['zh-TW', null],
    ['zh-Hant', null],
    ['zh-Hant-TW', null],
    ['zh-HK', null],
    ['zh-MO', null],
    ['xx-YY', null],
    [null, null],
];

test('checkLocale resolves only compatible supported locales', () => {
    CASES.forEach(([input, expected]) => {
        const result = checkLocale(AVAILABLE_LOCALES, input);
        expect(result.suitable ? result.locale : null, String(input)).toBe(expected);
    });
});

/**
 * @file
 */

import { describe, expect, test } from 'vitest';

import { urlUtils } from '../src/app/common/url-utils';

test.each([
    'example.com',
    'a-b.co',
    'sub.domain.example.com',
    'localhost',
])('isValidRuleSite accepts %s', (value) => {
    expect(urlUtils.isValidRuleSite(value)).toBe(true);
});

test.each([
    'https://x.com',
    'example',
    '-a.com',
    'a-.com',
    'exa mple.com',
    '',
])('isValidRuleSite rejects "%s"', (value) => {
    expect(urlUtils.isValidRuleSite(value)).toBe(false);
});

test.each([
    ['https://www.Example.com/path?q=1', 'example.com'],
    ['example.com', 'example.com'],
    ['  example.com  ', 'example.com'],
    ['example.com:8080', 'example.com'],
    ['www.example.com', 'example.com'],
    ['localhost', 'localhost'],
    ['http://localhost:3000/app', 'localhost'],
])('normalizeRuleSite normalizes "%s" to "%s"', (input, expected) => {
    expect(urlUtils.normalizeRuleSite(input)).toBe(expected);
});

test.each([
    'not a url at all',
    '',
    'chrome://extensions',
])('normalizeRuleSite returns null for "%s"', (input) => {
    expect(urlUtils.normalizeRuleSite(input)).toBeNull();
});

test.each([
    'file:///Users/x/a.js',
    'FILE:///x.css',
    ' file:///x.js ',
])('isFileUrl accepts "%s"', (value) => {
    expect(urlUtils.isFileUrl(value)).toBe(true);
});

test.each([
    'file://host/x',
    'http://x',
    '',
])('isFileUrl rejects "%s"', (value) => {
    expect(urlUtils.isFileUrl(value)).toBe(false);
});

describe('normalizeRuleFilePath', () => {
    test.each([
        ['/Users/me/patch.js', 'file:///Users/me/patch.js'],
        ['  /Users/me/patch.js  ', 'file:///Users/me/patch.js'],
        ['C:\\overrides\\patch.js', 'file:///C:/overrides/patch.js'],
        ['c:/overrides/patch.js', 'file:///c:/overrides/patch.js'],
    ])('prepends the file scheme to absolute path %s', (input, expected) => {
        expect(urlUtils.normalizeRuleFilePath(input)).toBe(expected);
    });

    test.each([
        'file:///Users/me/patch.js',
        'FILE:///x.css',
        'http://localhost:3000/bundle.js',
        'https://example.com/style.css',
    ])('keeps values that already carry a scheme: %s', (input) => {
        expect(urlUtils.normalizeRuleFilePath(input)).toBe(input);
    });

    test.each([
        ['relative/path.js', 'relative/path.js'],
        ['~/overrides/patch.js', '~/overrides/patch.js'],
        ['', ''],
        ['   ', ''],
    ])('passes unrecognized input %s through trimmed', (input, expected) => {
        expect(urlUtils.normalizeRuleFilePath(input)).toBe(expected);
    });
});

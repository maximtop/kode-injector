/**
 * @file
 */

import { expect, test } from 'vitest';

import { InjectionField } from '../src/app/common/constants';
import { getRuleFileEntries } from '../src/app/popup/components/RulesList/rule-file-entries';

const makeRule = (overrides = {}) => ({
    id: 'rule-1',
    site: 'example.com',
    jsPath: 'file:///a.js',
    cssPath: 'file:///a.css',
    enabled: true,
    jsEnabled: true,
    cssEnabled: true,
    ...overrides,
});

test('produces one entry per configured file, JS before CSS', () => {
    const entries = getRuleFileEntries([makeRule()]);

    expect(entries.map((e) => e.field)).toEqual([
        InjectionField.JsPath,
        InjectionField.CssPath,
    ]);
    expect(entries[0]).toMatchObject({ ruleId: 'rule-1', path: 'file:///a.js', checked: true });
});

test('skips files with an empty path', () => {
    const entries = getRuleFileEntries([makeRule({ cssPath: '' })]);

    expect(entries).toHaveLength(1);
    expect(entries[0].field).toBe(InjectionField.JsPath);
});

test('checked combines the rule enabled state and the file flag', () => {
    const [entry] = getRuleFileEntries([makeRule({ cssPath: '', jsEnabled: false })]);

    expect(entry.checked).toBe(false);
    expect(entry.ruleDisabled).toBe(false);
});

test('ruleDisabled is set and checked is false when the rule is off', () => {
    const [entry] = getRuleFileEntries([makeRule({ cssPath: '', enabled: false })]);

    expect(entry.ruleDisabled).toBe(true);
    expect(entry.checked).toBe(false);
});

test('flattens multiple rules in order', () => {
    const entries = getRuleFileEntries([
        makeRule({ id: 'a', cssPath: '' }),
        makeRule({ id: 'b', jsPath: '' }),
    ]);

    expect(entries.map((e) => e.ruleId)).toEqual(['a', 'b']);
});

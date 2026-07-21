/**
 * @file
 */

import { expect, test } from 'vitest';

import { InjectionField } from '../src/app/common/constants';
import {
    isValidInjectionInput,
    validateInjectionInput,
} from '../src/app/common/injection-validation';

test.each([
    ['JS only', { site: 'example.com', jsPath: 'file:///a.js', cssPath: '' }],
    ['CSS only', { site: 'example.com', jsPath: '', cssPath: 'file:///a.css' }],
    ['both sources', { site: 'example.com', jsPath: 'file:///a.js', cssPath: 'file:///a.css' }],
])('valid input with %s produces no errors', (name, data) => {
    const errors = validateInjectionInput(data);

    expect(errors).toEqual({});
    expect(isValidInjectionInput(errors)).toBe(true);
});

test('invalid site is flagged', () => {
    const errors = validateInjectionInput({
        site: 'not a url at all',
        jsPath: 'file:///a.js',
        cssPath: '',
    });

    expect(errors).toEqual({ [InjectionField.Site]: true });
    expect(isValidInjectionInput(errors)).toBe(false);
});

test('a JS path that is not a file URL is flagged', () => {
    const errors = validateInjectionInput({
        site: 'example.com',
        jsPath: 'http://example.com/a.js',
        cssPath: '',
    });

    expect(errors).toEqual({ [InjectionField.JsPath]: true });
    expect(isValidInjectionInput(errors)).toBe(false);
});

test('a CSS path that is not a file URL is flagged', () => {
    const errors = validateInjectionInput({
        site: 'example.com',
        jsPath: '',
        cssPath: 'http://example.com/a.css',
    });

    expect(errors).toEqual({ [InjectionField.CssPath]: true });
    expect(isValidInjectionInput(errors)).toBe(false);
});

test('empty source paths are flagged as a missing source', () => {
    const errors = validateInjectionInput({
        site: 'example.com',
        jsPath: '',
        cssPath: '',
    });

    expect(errors).toEqual({ missingSource: true });
    expect(isValidInjectionInput(errors)).toBe(false);
});

test('multiple simultaneous errors combine', () => {
    const errors = validateInjectionInput({
        site: '',
        jsPath: 'http://example.com/a.js',
        cssPath: 'not-a-file.css',
    });

    expect(errors).toEqual({
        [InjectionField.Site]: true,
        [InjectionField.JsPath]: true,
        [InjectionField.CssPath]: true,
    });
    expect(isValidInjectionInput(errors)).toBe(false);
});

test('an invalid site combines with a missing source', () => {
    const errors = validateInjectionInput({
        site: 'invalid host',
        jsPath: '',
        cssPath: '',
    });

    expect(errors).toEqual({
        [InjectionField.Site]: true,
        missingSource: true,
    });
    expect(isValidInjectionInput(errors)).toBe(false);
});

test('a site pasted as a full URL is accepted', () => {
    const errors = validateInjectionInput({
        site: 'https://www.example.com/x',
        jsPath: 'file:///a.js',
        cssPath: '',
    });

    expect(errors).toEqual({});
    expect(isValidInjectionInput(errors)).toBe(true);
});

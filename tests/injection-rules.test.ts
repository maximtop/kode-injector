/**
 * @file
 */

import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from 'vitest';

import { injections } from '../src/app/background/injections';
import { sourceReader } from '../src/app/background/native-host';
import { InjectionField } from '../src/app/common/constants';
import { log } from '../src/app/common/log';

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                get: vi.fn(),
                set: vi.fn(),
            },
        },
    },
}));

vi.mock('../src/app/background/app', () => ({
    app: { enabled: true },
}));

vi.mock('../src/app/background/execute-script', () => ({
    executeScript: vi.fn(),
}));

vi.mock('../src/app/background/local-source-access', () => ({
    localSourceAccess: { markReadFailed: vi.fn() },
}));

vi.mock('../src/app/background/native-host', () => ({
    sourceReader: { read: vi.fn() },
}));

vi.mock('../src/app/background/storage', () => ({
    storage: { get: vi.fn(), set: vi.fn() },
}));

beforeEach(() => {
    vi.clearAllMocks();
    injections.injections = [];
    injections.blocklist = [];
});

afterEach(() => {
    vi.restoreAllMocks();
});

test('addInjection creates an enabled CSS-only rule', () => {
    const rule = injections.addInjection({
        site: 'example.com',
        jsPath: '',
        cssPath: 'file:///a.css',
    });

    expect(rule).toMatchObject({
        site: 'example.com',
        jsPath: '',
        cssPath: 'file:///a.css',
        enabled: true,
        jsEnabled: true,
        cssEnabled: true,
    });
    expect(injections.injections).toHaveLength(1);
});

test('addInjection creates an enabled JS-only rule', () => {
    const rule = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    });

    expect(rule).toMatchObject({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
        enabled: true,
    });
    expect(injections.injections).toHaveLength(1);
});

test('addInjection rejects a rule without any source path', () => {
    const rule = injections.addInjection({
        site: 'example.com',
        jsPath: '',
        cssPath: '',
    });

    expect(rule).toBeNull();
    expect(injections.injections).toHaveLength(0);
});

test('addInjection rejects a whitespace-only site', () => {
    const rule = injections.addInjection({
        site: '   ',
        jsPath: 'file:///a.js',
        cssPath: '',
    });

    expect(rule).toBeNull();
    expect(injections.injections).toHaveLength(0);
});

test('addInjection trims the site and source paths', () => {
    const rule = injections.addInjection({
        site: '  example.com  ',
        jsPath: '  file:///a.js  ',
        cssPath: '  file:///a.css  ',
    });

    expect(rule).toMatchObject({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: 'file:///a.css',
    });
});

test('addInjection creates a disabled rule when requested', () => {
    const rule = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    }, false);

    expect(rule).toMatchObject({ enabled: false });
});

test('updateInjection preserves the id and enabled state and replaces fields', () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    }, false);
    if (!created) {
        throw new Error('Expected the rule to be created');
    }

    const updated = injections.updateInjection(created.id, {
        site: 'other.com',
        jsPath: '',
        cssPath: 'file:///b.css',
    });

    expect(updated).toMatchObject({
        id: created.id,
        site: 'other.com',
        jsPath: '',
        cssPath: 'file:///b.css',
        enabled: false,
    });
    expect(injections.injections).toHaveLength(1);
    expect(injections.injections[0]).toEqual(updated);
});

test('updateInjection returns null and logs an error for an unknown id', () => {
    const error = vi.spyOn(log, 'error').mockImplementation(() => undefined);

    const updated = injections.updateInjection('missing-id', {
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    });

    expect(updated).toBeNull();
    expect(error).toHaveBeenCalled();
});

test('updateInjection rejects invalid data and keeps the original rule', () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    });
    if (!created) {
        throw new Error('Expected the rule to be created');
    }

    const updated = injections.updateInjection(created.id, {
        site: 'example.com',
        jsPath: '',
        cssPath: '',
    });

    expect(updated).toBeNull();
    expect(injections.injections).toEqual([created]);
});

test('injectJs never reads the source of a rule without a JS path', async () => {
    injections.addInjection({
        site: 'example.com',
        jsPath: '',
        cssPath: 'file:///a.css',
    });

    await injections.injectJs('https://example.com', 1);

    expect(sourceReader.read).not.toHaveBeenCalled();
});

test('getCssInjection skips rules without a CSS path', async () => {
    injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    });

    await expect(injections.getCssInjection('https://example.com')).resolves.toEqual([]);

    expect(sourceReader.read).not.toHaveBeenCalled();
});

test('setInjectionFileEnabled flips only the targeted flag', () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: 'file:///a.css',
    });

    const updated = injections.setInjectionFileEnabled(created!.id, InjectionField.JsPath, false);

    expect(updated).toMatchObject({ jsEnabled: false, cssEnabled: true });
    expect(injections.injections[0].jsEnabled).toBe(false);
});

test('setInjectionFileEnabled returns null for an unknown id', () => {
    const error = vi.spyOn(log, 'error').mockImplementation(() => undefined);

    expect(injections.setInjectionFileEnabled('missing', InjectionField.JsPath, false)).toBeNull();
    expect(error).toHaveBeenCalled();
});

test('setInjectionFileEnabled returns null for an empty-path field', () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    });
    vi.spyOn(log, 'error').mockImplementation(() => undefined);

    const result = injections.setInjectionFileEnabled(created!.id, InjectionField.CssPath, false);
    expect(result).toBeNull();
});

test('injectJs skips a rule whose JS file is individually disabled', async () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: '',
    });
    injections.setInjectionFileEnabled(created!.id, InjectionField.JsPath, false);

    await injections.injectJs('https://example.com', 1);

    expect(sourceReader.read).not.toHaveBeenCalled();
});

test('getCssInjection ignores the JS flag and applies an enabled CSS file', async () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: 'file:///a.css',
    });
    injections.setInjectionFileEnabled(created!.id, InjectionField.JsPath, false);
    vi.mocked(sourceReader.read).mockResolvedValue({ ok: true, content: 'body{}' });

    const result = await injections.getCssInjection('https://example.com');

    expect(result).toHaveLength(1);
    expect(sourceReader.read).toHaveBeenCalledWith('file:///a.css');
});

test('updateInjection preserves a disabled file flag across an edit', () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: 'file:///a.css',
    });
    injections.setInjectionFileEnabled(created!.id, InjectionField.JsPath, false);

    const updated = injections.updateInjection(created!.id, {
        site: 'example.com',
        jsPath: 'file:///b.js',
        cssPath: 'file:///a.css',
    });

    expect(updated).toMatchObject({ jsEnabled: false, cssEnabled: true });
});

test('updateInjection resets a file flag when its path is cleared', () => {
    const created = injections.addInjection({
        site: 'example.com',
        jsPath: 'file:///a.js',
        cssPath: 'file:///a.css',
    });
    injections.setInjectionFileEnabled(created!.id, InjectionField.JsPath, false);

    const updated = injections.updateInjection(created!.id, {
        site: 'example.com',
        jsPath: '',
        cssPath: 'file:///a.css',
    });

    expect(updated).toMatchObject({ jsPath: '', jsEnabled: true });
});

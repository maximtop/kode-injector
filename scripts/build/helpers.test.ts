/**
 * @file
 */

import { expect, test } from 'vitest';

import { BROWSER_TARGETS, CHANNEL_ENVS } from '../constants';
import { updateLocalesMSGName, updateManifest } from './helpers';

test('updateManifest applies the package version', () => {
    const result = JSON.parse(updateManifest(
        '{"name":"Kode Injector"}',
        {
            browser: BROWSER_TARGETS.CHROME,
            version: '1.2.3',
        },
    ));

    expect(result).toEqual({
        background: { service_worker: 'background.js' },
        name: 'Kode Injector',
        optional_permissions: ['nativeMessaging'],
        permissions: [],
        version: '1.2.3',
    });
});

test.each([BROWSER_TARGETS.CHROME, BROWSER_TARGETS.EDGE])(
    'updateManifest creates a service-worker manifest for %s',
    (browser) => {
        const result = JSON.parse(updateManifest(
            '{"background":{"page":"old.html"}}',
            { browser, version: '1.2.3' },
        ));

        expect(result.background).toEqual({ service_worker: 'background.js' });
        expect(result.browser_specific_settings).toBeUndefined();
    },
);

test.each([BROWSER_TARGETS.CHROME, BROWSER_TARGETS.EDGE])(
    'updateManifest makes native messaging optional for %s',
    (browser) => {
        const result = JSON.parse(updateManifest(
            JSON.stringify({
                permissions: ['storage', 'nativeMessaging', 'storage'],
                optional_permissions: ['downloads', 'nativeMessaging', 'downloads'],
            }),
            { browser, version: '1.2.3' },
        ));

        expect(result.permissions).toEqual(['storage']);
        expect(result.optional_permissions).toEqual(['downloads', 'nativeMessaging']);
    },
);

test('updateManifest requires native messaging only for Firefox', () => {
    const result = JSON.parse(updateManifest(
        JSON.stringify({
            permissions: ['storage', 'nativeMessaging', 'storage'],
            optional_permissions: ['downloads', 'nativeMessaging', 'downloads'],
        }),
        {
            browser: BROWSER_TARGETS.FIREFOX,
            version: '1.2.3',
        },
    ));

    expect(result.permissions).toEqual(['storage', 'nativeMessaging']);
    expect(result.optional_permissions).toEqual(['downloads']);
});

test('updateManifest creates the Firefox background and signing metadata', () => {
    const result = JSON.parse(updateManifest(
        '{"background":{"service_worker":"background.js"}}',
        {
            browser: BROWSER_TARGETS.FIREFOX,
            version: '1.2.3',
        },
    ));

    expect(result.background).toEqual({ page: 'background.html' });
    expect(result.browser_specific_settings).toEqual({
        gecko: {
            id: 'kode-injector@maximtop.dev',
            data_collection_permissions: {
                required: ['none'],
            },
        },
    });
});

test('updateLocalesMSGName marks development builds', () => {
    const result = JSON.parse(updateLocalesMSGName(
        '{"name":{"message":"Kode Injector"}}',
        CHANNEL_ENVS.DEV,
    ));

    expect(result.name.message).toBe('Kode Injector (Dev)');
});

test('updateLocalesMSGName leaves production names unchanged', () => {
    const result = JSON.parse(updateLocalesMSGName(
        '{"name":{"message":"Kode Injector"}}',
        CHANNEL_ENVS.RELEASE,
    ));

    expect(result.name.message).toBe('Kode Injector');
});

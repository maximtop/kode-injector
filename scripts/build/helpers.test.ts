/**
 * @file
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { BROWSER_TARGETS, CHANNEL_ENVS } from '../constants';
import { AVAILABLE_LOCALES } from '../../src/app/common/locale/locale-constants';
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
            strict_min_version: '153.0',
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

test('locale build transforms cover every packaged catalog', () => {
    for (const locale of AVAILABLE_LOCALES) {
        const filePath = path.join(process.cwd(), 'src/_locales', locale, 'messages.json');
        const source = fs.readFileSync(filePath, 'utf8');
        const sourceName = JSON.parse(source).name.message as string;
        const devName = JSON.parse(
            updateLocalesMSGName(source, CHANNEL_ENVS.DEV),
        ).name.message as string;
        const prodName = JSON.parse(
            updateLocalesMSGName(source, CHANNEL_ENVS.RELEASE),
        ).name.message as string;

        expect(devName, locale).toBe(`${sourceName} (Dev)`);
        expect(prodName, locale).toBe(sourceName);
    }
});

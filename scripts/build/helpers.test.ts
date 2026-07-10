/**
 * @file
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { CHANNEL_ENVS } from '../constants';
import { AVAILABLE_LOCALES } from '../../src/app/common/locale/locale-constants';
import { updateLocalesMSGName, updateManifest } from './helpers';

test('updateManifest applies the package version', () => {
    const result = JSON.parse(updateManifest(
        '{"name":"Kode Injector"}',
        { version: '1.2.3' },
    ));

    expect(result).toEqual({ name: 'Kode Injector', version: '1.2.3' });
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
        CHANNEL_ENVS.PROD,
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
            updateLocalesMSGName(source, CHANNEL_ENVS.PROD),
        ).name.message as string;

        expect(devName, locale).toBe(`${sourceName} (Dev)`);
        expect(prodName, locale).toBe(sourceName);
    }
});

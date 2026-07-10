/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { CHANNEL_ENVS } from '../constants';
import { updateLocalesMSGName, updateManifest } from './helpers';

test('updateManifest applies the package version', () => {
    const result = JSON.parse(updateManifest(
        '{"name":"Kode Injector"}',
        { version: '1.2.3' },
    ));

    assert.deepEqual(result, { name: 'Kode Injector', version: '1.2.3' });
});

test('updateLocalesMSGName marks development builds', () => {
    const result = JSON.parse(updateLocalesMSGName(
        '{"name":{"message":"Kode Injector"}}',
        CHANNEL_ENVS.DEV,
    ));

    assert.equal(result.name.message, 'Kode Injector (Dev)');
});

test('updateLocalesMSGName leaves production names unchanged', () => {
    const result = JSON.parse(updateLocalesMSGName(
        '{"name":{"message":"Kode Injector"}}',
        CHANNEL_ENVS.PROD,
    ));

    assert.equal(result.name.message, 'Kode Injector');
});

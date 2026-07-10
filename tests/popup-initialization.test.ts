/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { preparePopupState } from '../src/js/popup/stores/popup-initialization';

test('popup locale initializes before presentation state is returned', async () => {
    const calls: string[] = [];
    const result = await preparePopupState(
        { id: 7, url: 'https://example.com' },
        {
            settings: { 'app.enabled': true, 'language.selected': 'de' },
            siteHasEnabledInjections: true,
            siteIsBlacklisted: false,
        },
        async (language) => { calls.push(`locale:${language}`); },
    );

    calls.push('ready');
    assert.deepEqual(calls, ['locale:de', 'ready']);
    assert.deepEqual(result, {
        appEnabled: true,
        currentTab: { id: 7, url: 'https://example.com' },
        siteHasEnabledInjections: true,
        siteIsBlacklisted: false,
    });
});

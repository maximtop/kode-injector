/**
 * @file
 */

import { expect, test } from 'vitest';

import { preparePopupState } from '../src/app/popup/stores/popup-initialization';
import { LocalSourceAccessKind } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

test('popup locale initializes before presentation state is returned', async () => {
    const calls: string[] = [];
    const result = await preparePopupState(
        { id: 7, url: 'https://example.com' },
        {
            localSourceAccess: {
                kind: LocalSourceAccessKind.NativeHost,
                host: { status: NativeHostStatus.NotInstalled },
            },
            settings: { 'app.enabled': true, 'language.selected': 'de' },
            siteHasEnabledInjections: true,
            siteIsBlacklisted: false,
        },
        async (language) => { calls.push(`locale:${language}`); },
    );

    calls.push('ready');
    expect(calls).toEqual(['locale:de', 'ready']);
    expect(result).toEqual({
        appEnabled: true,
        currentTab: { id: 7, url: 'https://example.com' },
        localSourceAccess: {
            kind: LocalSourceAccessKind.NativeHost,
            host: { status: NativeHostStatus.NotInstalled },
        },
        siteHasEnabledInjections: true,
        siteIsBlacklisted: false,
    });
});

/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { BrowserTarget } from '../src/app/common/browser-target';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { getSiteStatus } from '../src/app/popup/components/SiteBlock/site-status';

vi.mock('../src/app/common/translator', () => ({
    translator: {
        getMessage: (key: string, params?: Record<string, string>) => (
            params ? `${key}:${Object.values(params).join(',')}` : key
        ),
        getPlural: (key: string, count: number) => `${key}#${count}`,
    },
}));

const healthyAccess = {
    kind: LocalSourceAccessMethod.Browser,
    allowed: true,
} as const;

const brokenAccess = {
    kind: LocalSourceAccessMethod.Browser,
    allowed: false,
} as const;

const baseInput = {
    appEnabled: true,
    localSourceAccess: healthyAccess,
    browserTarget: BrowserTarget.Chrome,
    matchingCount: 2,
    activeCount: 2,
    siteIsBlacklisted: false,
};

test('global pause outranks every other state', () => {
    const status = getSiteStatus({
        ...baseInput,
        appEnabled: false,
        localSourceAccess: brokenAccess,
    });

    expect(status).toEqual({ tone: 'off', text: 'popup_paused_strip' });
});

test('broken file access outranks rule states', () => {
    const status = getSiteStatus({ ...baseInput, localSourceAccess: brokenAccess });

    expect(status).toEqual({ tone: 'warn', text: 'popup_files_unreadable' });
});

test('no matching rules reads as an off state', () => {
    const status = getSiteStatus({ ...baseInput, matchingCount: 0, activeCount: 0 });

    expect(status).toEqual({ tone: 'off', text: 'popup_no_rules' });
});

test('blocklisted site outranks rule toggles', () => {
    const status = getSiteStatus({ ...baseInput, siteIsBlacklisted: true });

    expect(status).toEqual({ tone: 'off', text: 'popup_site_disabled' });
});

test('all rules off reads as an off state', () => {
    const status = getSiteStatus({ ...baseInput, activeCount: 0 });

    expect(status).toEqual({ tone: 'off', text: 'popup_all_rules_off' });
});

test('active rules resolve through the plural form for their count', () => {
    expect(getSiteStatus({ ...baseInput, matchingCount: 1, activeCount: 1 }))
        .toEqual({ tone: 'ok', text: 'popup_rules_active#1' });
    expect(getSiteStatus({ ...baseInput, matchingCount: 3, activeCount: 3 }))
        .toEqual({ tone: 'ok', text: 'popup_rules_active#3' });
});

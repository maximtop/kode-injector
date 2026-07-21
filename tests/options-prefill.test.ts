/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    getPrefillSiteFromSearch,
    getRequestedTabFromSearch,
} from '../src/app/options/options-url-params';

test.each([
    ['?site=example.com', 'example.com'],
    ['?site=https%3A%2F%2Fwww.example.com%2Fpath', 'example.com'],
])('getPrefillSiteFromSearch extracts "%s" as "%s"', (search, expected) => {
    expect(getPrefillSiteFromSearch(search)).toBe(expected);
});

test.each([
    '?site=chrome',
    '',
    '?other=1',
])('getPrefillSiteFromSearch returns null for "%s"', (search) => {
    expect(getPrefillSiteFromSearch(search)).toBeNull();
});

test.each([
    ['?tab=settings', 'settings'],
    ['?tab=injections', 'injections'],
])('getRequestedTabFromSearch extracts "%s" as "%s"', (search, expected) => {
    expect(getRequestedTabFromSearch(search)).toBe(expected);
});

test.each([
    '?tab=bogus',
    '',
    '?other=1',
])('getRequestedTabFromSearch returns null for "%s"', (search) => {
    expect(getRequestedTabFromSearch(search)).toBeNull();
});

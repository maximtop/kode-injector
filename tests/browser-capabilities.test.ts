/**
 * @file
 */

import { expect, test } from 'vitest';

import { BROWSER_CAPABILITIES, getBrowserCapabilities } from '../src/app/common/browser-capabilities';
import { BrowserTarget } from '../src/app/common/browser-target';
import {
    getDefaultLocalSourceAccessMethod,
    getSupportedLocalSourceAccessMethod,
    LocalSourceAccessMethod,
} from '../src/app/common/contracts';

// getBrowserCapabilities is a pure lookup with no transformation of its own;
// re-asserting every capability field here would just duplicate the
// BROWSER_CAPABILITIES map and break on any legitimate capability change with
// no bug signal (see AGENTS.md: don't mirror configuration to pin its
// contents). Checking object identity still catches the only real regression
// this function can have: indexing the wrong target, or returning a
// hardcoded/shared object regardless of input.
test.each(Object.values(BrowserTarget))('%s resolves to its own capability entry', (target) => {
    expect(getBrowserCapabilities(target)).toBe(BROWSER_CAPABILITIES[target]);
});

test('capability entries are distinct per browser target', () => {
    const entries = Object.values(BrowserTarget).map(getBrowserCapabilities);
    expect(new Set(entries).size).toBe(entries.length);
});

// These derived helpers do have real branching logic, so pinning their
// per-target results as domain facts is meaningful (unlike the raw map above).
test.each([
    [BrowserTarget.Chrome, LocalSourceAccessMethod.Browser],
    [BrowserTarget.Edge, LocalSourceAccessMethod.Browser],
    [BrowserTarget.Firefox, LocalSourceAccessMethod.NativeHost],
    [BrowserTarget.Safari, LocalSourceAccessMethod.NativeHost],
])('%s defaults to %s as its local-source access method', (target, expected) => {
    expect(getDefaultLocalSourceAccessMethod(target)).toBe(expected);
});

test.each([
    [BrowserTarget.Chrome, LocalSourceAccessMethod.Browser],
    [BrowserTarget.Edge, LocalSourceAccessMethod.Browser],
])('%s honors a requested Browser access method', (target, requested) => {
    expect(getSupportedLocalSourceAccessMethod(requested, target)).toBe(requested);
});

test.each([
    [BrowserTarget.Firefox],
    [BrowserTarget.Safari],
])('%s forces Native Host regardless of the requested method', (target) => {
    expect(getSupportedLocalSourceAccessMethod(LocalSourceAccessMethod.Browser, target))
        .toBe(LocalSourceAccessMethod.NativeHost);
});

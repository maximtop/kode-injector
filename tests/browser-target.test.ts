/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    BrowserTarget,
    detectBrowserTarget,
    getExtensionSettingsUrl,
} from '../src/app/common/browser-target';

test('detects Firefox from its extension protocol', () => {
    expect(detectBrowserTarget('moz-extension:', 'Mozilla/5.0 Firefox/153.0'))
        .toBe(BrowserTarget.Firefox);
});

test('detects Edge from its Chromium user agent token', () => {
    expect(detectBrowserTarget('extension:', 'Mozilla/5.0 Chrome/152.0 Edg/152.0'))
        .toBe(BrowserTarget.Edge);
});

test('uses Chrome for other Chromium extension pages', () => {
    expect(detectBrowserTarget('chrome-extension:', 'Mozilla/5.0 Chrome/152.0'))
        .toBe(BrowserTarget.Chrome);
});

test.each([
    [BrowserTarget.Chrome, 'dynamic-chrome-id', 'chrome://extensions/?id=dynamic-chrome-id'],
    [BrowserTarget.Edge, 'dynamic-edge-id', 'edge://extensions/?id=dynamic-edge-id'],
] as const)('creates an ID-safe %s settings URL', (target, id, expected) => {
    expect(getExtensionSettingsUrl(target, id)).toBe(expected);
});

test('does not expose an unsupported Firefox settings URL', () => {
    expect(getExtensionSettingsUrl(BrowserTarget.Firefox, 'firefox-id')).toBeUndefined();
});

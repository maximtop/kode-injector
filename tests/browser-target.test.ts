/**
 * @file
 */

import { afterEach, expect, test, vi } from 'vitest';

import {
    BrowserTarget,
    detectBrowserTarget,
    getCurrentBrowserTarget,
    getExtensionSettingsUrl,
} from '../src/app/common/browser-target';

afterEach(() => {
    vi.unstubAllGlobals();
});

test('detects Firefox from its extension protocol', () => {
    expect(detectBrowserTarget('moz-extension:', 'Mozilla/5.0 Firefox/153.0'))
        .toBe(BrowserTarget.Firefox);
});

test('detects Safari from its extension protocol', () => {
    expect(detectBrowserTarget('safari-web-extension:', 'Mozilla/5.0 Safari/626.1'))
        .toBe(BrowserTarget.Safari);
});

test('detects Edge from its Chromium user agent token', () => {
    expect(detectBrowserTarget('extension:', 'Mozilla/5.0 Chrome/152.0 Edg/152.0'))
        .toBe(BrowserTarget.Edge);
});

test('uses Chrome for other Chromium extension pages', () => {
    expect(detectBrowserTarget('chrome-extension:', 'Mozilla/5.0 Chrome/152.0'))
        .toBe(BrowserTarget.Chrome);
});

test('detects the current browser from worker-safe globals', () => {
    vi.stubGlobal('location', { protocol: 'extension:' });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Edg/152.0' });

    expect(getCurrentBrowserTarget()).toBe(BrowserTarget.Edge);
});

test.each([
    [BrowserTarget.Chrome, 'dynamic-chrome-id', 'chrome://extensions/?id=dynamic-chrome-id'],
    [BrowserTarget.Edge, 'dynamic-edge-id', 'edge://extensions/?id=dynamic-edge-id'],
] as const)('creates an ID-safe %s settings URL', (target, id, expected) => {
    expect(getExtensionSettingsUrl(target, id)).toBe(expected);
});

test.each([BrowserTarget.Firefox, BrowserTarget.Safari])(
    'does not expose an unsupported %s settings URL',
    (target) => {
        expect(getExtensionSettingsUrl(target, 'extension-id')).toBeUndefined();
    },
);

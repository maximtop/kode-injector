/**
 * @file
 */

import { expect, test } from 'vitest';

import {
    DEMO_CSS_MARKER_PROPERTY,
    DEMO_ELEMENT_ID,
    DemoFailureReason,
    DemoLaunchStatus,
    isBuiltInDemoOffered,
    isDemoCss,
    isDemoJavaScript,
    isDemoTargetUrl,
    toPersistedDemoLaunch,
} from '../src/app/common/demo-contracts';

test.each([
    ['https://example.com/', true],
    ['https://example.com/path?q=1', true],
    ['https://www.example.com/', true],
    ['http://example.com/', false],
    ['https://example.org/', false],
    ['https://notexample.com/', false],
    ['https://example.com.evil.test/', false],
    ['chrome-extension://abc/options.html', false],
    ['', false],
    ['not a url', false],
])('isDemoTargetUrl(%j) is %s', (url, expected) => {
    expect(isDemoTargetUrl(url)).toBe(expected);
});

test('demo is offered only by a shipping build with zero rules', () => {
    expect(isBuiltInDemoOffered(0, true)).toBe(true);
    expect(isBuiltInDemoOffered(1, true)).toBe(false);
    expect(isBuiltInDemoOffered(0, false)).toBe(false);
});

test('persisted launches are validated before use', () => {
    const launch = {
        tabId: 100,
        startedAt: 1_000,
        status: DemoLaunchStatus.Failed,
        failure: DemoFailureReason.NotConfirmed,
    };
    expect(toPersistedDemoLaunch(launch)).toEqual(launch);
    expect(toPersistedDemoLaunch({
        tabId: 100, startedAt: 1_000, status: DemoLaunchStatus.Waiting,
    })).toEqual({ tabId: 100, startedAt: 1_000, status: DemoLaunchStatus.Waiting });
    expect(toPersistedDemoLaunch({ ...launch, status: DemoLaunchStatus.None })).toBeNull();
    expect(toPersistedDemoLaunch({ ...launch, failure: 'unknown' })).toBeNull();
    expect(toPersistedDemoLaunch({ tabId: '100', startedAt: 1_000, status: 'waiting' })).toBeNull();
    expect(toPersistedDemoLaunch(null)).toBeNull();
    expect(toPersistedDemoLaunch([])).toBeNull();
});

test('demo source markers are required', () => {
    expect(isDemoJavaScript(`document.getElementById('${DEMO_ELEMENT_ID}');`)).toBe(true);
    expect(isDemoJavaScript('console.log(1);')).toBe(false);
    expect(isDemoJavaScript('')).toBe(false);
    expect(isDemoCss(`:root { ${DEMO_CSS_MARKER_PROPERTY}: applied; }`)).toBe(true);
    expect(isDemoCss('body { color: red; }')).toBe(false);
    expect(isDemoCss('   ')).toBe(false);
});

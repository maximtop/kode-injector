/**
 * @file
 */

import { afterEach, expect, test, vi } from 'vitest';

import { injections } from '../src/app/background/injections';
import { log } from '../src/app/common/log';

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                get: vi.fn(),
                set: vi.fn(),
            },
        },
    },
}));

afterEach(() => {
    vi.restoreAllMocks();
});

test.each([
    'about:debugging#/runtime/this-firefox',
    'chrome://extensions/',
    'edge://extensions/',
])('browser page %s has no injection state and does not log an error', (url) => {
    const error = vi.spyOn(log, 'error').mockImplementation(() => undefined);

    expect(injections.hasSiteEnabledInjections(url)).toBe(false);
    expect(injections.isSiteBlacklisted(url)).toBe(false);
    expect(error).not.toHaveBeenCalled();
});

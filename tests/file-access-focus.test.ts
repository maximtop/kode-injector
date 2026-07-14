/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { subscribeLocalSourceAccessRefreshOnFocus } from '../src/app/options/local-source-access-focus';

test('options refreshes file access on focus and removes its listener', () => {
    let focusListener: (() => void) | undefined;
    const target = {
        addEventListener: vi.fn((_type: 'focus', listener: () => void) => {
            focusListener = listener;
        }),
        removeEventListener: vi.fn(),
    };
    const refresh = vi.fn();

    const unsubscribe = subscribeLocalSourceAccessRefreshOnFocus(target, refresh);
    focusListener?.();

    expect(refresh).toHaveBeenCalledOnce();
    unsubscribe();
    expect(target.removeEventListener).toHaveBeenCalledWith('focus', focusListener);
});

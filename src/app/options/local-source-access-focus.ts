/**
 * @file Options focus refresh for the active local-source access state.
 */

/* eslint-disable jsdoc/require-jsdoc */

export interface FocusEventTarget {
    addEventListener(type: 'focus', listener: () => void): void;
    removeEventListener(type: 'focus', listener: () => void): void;
}

type FocusUnsubscribe = () => void;

export const subscribeLocalSourceAccessRefreshOnFocus = (
    target: FocusEventTarget,
    refresh: () => void | Promise<void>,
): FocusUnsubscribe => {
    const handleFocus = (): void => {
        refresh();
    };

    target.addEventListener('focus', handleFocus);
    return () => target.removeEventListener('focus', handleFocus);
};

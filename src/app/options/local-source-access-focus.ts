/**
 * @file Options focus refresh for the active local-source access state.
 */

/**
 * Browser-style focus event target, such as `window`.
 */
export interface FocusEventTarget {
    addEventListener(type: 'focus', listener: () => void): void;
    removeEventListener(type: 'focus', listener: () => void): void;
}

/**
 * Removes a focus subscription.
 */
type FocusUnsubscribe = () => void;

/**
 * Refreshes local-source access state whenever the target regains focus.
 *
 * @param target Event target to observe for focus.
 * @param refresh Callback that refreshes the local-source access state.
 *
 * @returns Function that removes the focus subscription.
 */
export const subscribeLocalSourceAccessRefreshOnFocus = (
    target: FocusEventTarget,
    refresh: () => void | Promise<void>,
): FocusUnsubscribe => {
    const handleFocus = (): void => {
        void refresh();
    };

    target.addEventListener('focus', handleFocus);
    return () => target.removeEventListener('focus', handleFocus);
};

/**
 * @file
 */

/**
 * Window-like focus event source used by the options page.
 */
export interface FocusEventTarget {
    /**
     * Registers a focus listener.
     */
    addEventListener(type: 'focus', listener: () => void): void;

    /**
     * Removes a focus listener.
     */
    removeEventListener(type: 'focus', listener: () => void): void;
}

/**
 * Removes the registered options focus listener.
 */
type FocusUnsubscribe = () => void;

/**
 * Refreshes local-file permission whenever the options window regains focus.
 *
 * @param target Focus event source.
 * @param refresh Permission refresh callback.
 *
 * @returns Function that removes the focus listener.
 */
export const subscribeFileAccessRefreshOnFocus = (
    target: FocusEventTarget,
    refresh: () => void | Promise<void>,
): FocusUnsubscribe => {
    /**
     * Invokes the permission refresh without blocking the focus event.
     */
    const handleFocus = (): void => {
        refresh();
    };

    target.addEventListener('focus', handleFocus);
    return () => target.removeEventListener('focus', handleFocus);
};

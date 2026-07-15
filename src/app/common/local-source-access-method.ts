/**
 * @file Applies user-selected local-source access methods.
 */

import { LocalSourceAccessMethod } from './contracts';

/**
 * Optional native-messaging permission operations.
 */
interface OptionalNativeMessagingPermission {
    /**
     * Checks whether native messaging is currently granted.
     */
    contains(): Promise<boolean>;

    /**
     * Requests native messaging from the current user gesture.
     */
    request(): Promise<boolean>;

    /**
     * Removes native messaging after browser access is selected.
     */
    remove(): Promise<boolean>;
}

/**
 * Collaborators required to apply an access method.
 */
export interface LocalSourceAccessMethodActions {
    /**
     * Optional native-messaging permission service.
     */
    permission: OptionalNativeMessagingPermission;

    /**
     * Persists and activates a supported method.
     */
    setMethod(method: LocalSourceAccessMethod): Promise<void>;

    /**
     * Shows a denied or failed permission request.
     */
    showPermissionDenied(): void;

    /**
     * Records permission API failures.
     */
    logPermissionError(error: unknown): void;
}

/**
 * Applies a Chromium local-source method selection.
 *
 * @param method User-selected access method.
 * @param actions Permission and persistence operations.
 *
 * @returns Whether the selected method was activated.
 */
export const applyLocalSourceAccessMethod = async (
    method: LocalSourceAccessMethod,
    actions: LocalSourceAccessMethodActions,
): Promise<boolean> => {
    if (method === LocalSourceAccessMethod.NativeHost) {
        let granted = false;
        try {
            // This must remain the first asynchronous operation so Chromium
            // associates the request with the originating UI event.
            granted = await actions.permission.request();
        } catch (error) {
            actions.logPermissionError(error);
        }

        if (!granted) {
            actions.showPermissionDenied();
            return false;
        }

        try {
            await actions.setMethod(method);
        } catch (error) {
            await removeUnusedNativeMessagingPermission(actions);
            throw error;
        }
        return true;
    }

    await actions.setMethod(method);
    await removeUnusedNativeMessagingPermission(actions);
    return true;
};

const PERMISSION_NOT_REMOVED_ERROR = 'NATIVE_MESSAGING_PERMISSION_NOT_REMOVED';

/**
 * Removes an unused optional permission and verifies ambiguous false results.
 *
 * @param actions Permission operations and failure logger.
 */
const removeUnusedNativeMessagingPermission = async (
    actions: LocalSourceAccessMethodActions,
): Promise<void> => {
    try {
        const removed = await actions.permission.remove();
        if (!removed && await actions.permission.contains()) {
            actions.logPermissionError(new Error(PERMISSION_NOT_REMOVED_ERROR));
        }
    } catch (error) {
        actions.logPermissionError(error);
    }
};

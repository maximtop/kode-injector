/**
 * @file Receives best-effort messages from the Safari containing application.
 *
 * The macOS app calls `SFSafariApplication.dispatchMessage`; Safari delivers
 * it to a native port opened with `browser.runtime.connectNative`. Safari
 * does not wake a suspended background for these messages, so every action
 * triggered here must also have a manual route in the app (FR-018).
 */

import { log } from '../common/log';

/**
 * Message name and `userInfo.action` sent by the containing app's Try Demo.
 */
export const SAFARI_APP_MESSAGE_OPEN_DEMO = 'openDemo';

/**
 * Minimal native port surface used by the subscription.
 */
export interface SafariAppMessagePort {
    /**
     * Incoming message events.
     */
    onMessage: {
        /**
         * Registers a message listener.
         *
         * @param listener Receives each untrusted message.
         */
        addListener(listener: (message: unknown) => void): void;
    };

    /**
     * Disconnect events.
     */
    onDisconnect: {
        /**
         * Registers a disconnect listener.
         *
         * @param listener Invoked once when the port closes.
         */
        addListener(listener: () => void): void;
    };
}

/**
 * Checks whether a value is a plain record.
 *
 * @param value Value to inspect.
 *
 * @returns Whether the value is a non-null, non-array object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/**
 * Checks whether an untrusted port message asks to open the demo.
 *
 * Safari delivers app messages either as `{ name, userInfo }` or as the
 * `userInfo` dictionary itself; both documented shapes are accepted.
 *
 * @param message Untrusted native port message.
 *
 * @returns Whether the containing app requested the demo entry.
 */
export const isOpenDemoAppMessage = (message: unknown): boolean => {
    if (!isRecord(message)) {
        return false;
    }
    if (message.name === SAFARI_APP_MESSAGE_OPEN_DEMO
        || message.action === SAFARI_APP_MESSAGE_OPEN_DEMO) {
        return true;
    }
    return isRecord(message.userInfo)
        && message.userInfo.action === SAFARI_APP_MESSAGE_OPEN_DEMO;
};

/**
 * Opens the native port and forwards open-demo requests.
 *
 * @param connect Creates the native port (`browser.runtime.connectNative`).
 * @param onOpenDemo Invoked for each open-demo request.
 */
export const subscribeSafariAppMessages = (
    connect: () => SafariAppMessagePort,
    onOpenDemo: () => void,
): void => {
    let port: SafariAppMessagePort;
    try {
        port = connect();
    } catch (error) {
        log.debug('Safari app message port unavailable', error);
        return;
    }
    port.onMessage.addListener((message) => {
        if (isOpenDemoAppMessage(message)) {
            onOpenDemo();
        }
    });
    port.onDisconnect.addListener(() => {
        log.debug('Safari app message port closed');
    });
};

/**
 * @file
 */

import { MESSAGE_TYPES } from './constants';
import type { LocalePreference } from './locale';

/**
 * Typed event emitted after a language preference is persisted.
 */
export interface LanguageChangedMessage {
    /**
     * Event discriminator.
     */
    type: typeof MESSAGE_TYPES.LANGUAGE_CHANGED;

    /**
     * Event payload.
     */
    data: LanguageChangedData;
}

/**
 * Payload carried by a language-change event.
 */
interface LanguageChangedData {
    /**
     * Normalized language preference.
     */
    language: LocalePreference;
}

/**
 * Runtime operations needed by the language channel.
 */
export interface LanguageRuntime {
    /**
     * Sends an extension runtime message.
     */
    sendMessage(message: unknown): Promise<unknown>;

    /**
     * Runtime message listener operations.
     */
    onMessage: {
        /**
         * Registers a runtime listener.
         */
        addListener(listener: (message: unknown) => unknown): void;

        /**
         * Removes a runtime listener.
         */
        removeListener(listener: (message: unknown) => unknown): void;
    };
}

/**
 * Callback invoked for a valid language event.
 */
type LanguageListener = (language: LocalePreference) => void | Promise<void>;

/**
 * Checks an unknown runtime message.
 *
 * @param message Runtime message.
 *
 * @returns Whether the message is a language-change event.
 */
const isLanguageChangedMessage = (message: unknown): message is LanguageChangedMessage => {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const value = message as Partial<LanguageChangedMessage>;
    if (value.type !== MESSAGE_TYPES.LANGUAGE_CHANGED
        || !value.data
        || typeof value.data.language !== 'string') {
        return false;
    }

    return true;
};

/**
 * Publishes and receives language-change events.
 */
export class LanguageChannel {
    /**
     * Runtime adapter used for event delivery.
     */
    private runtime: LanguageRuntime;

    /**
     * Creates a channel over a runtime adapter.
     *
     * @param runtime Runtime adapter.
     */
    constructor(runtime: LanguageRuntime) {
        this.runtime = runtime;
    }

    /**
     * Broadcasts a normalized preference.
     *
     * @param language Preference to broadcast.
     *
     * @returns Promise resolved after the runtime call completes.
     */
    public publish = (language: LocalePreference): Promise<unknown> => {
        return this.runtime.sendMessage({
            type: MESSAGE_TYPES.LANGUAGE_CHANGED,
            data: { language },
        });
    };

    /**
     * Subscribes to language-change events.
     *
     * @param listener Event callback.
     *
     * @returns Cleanup function.
     */
    public subscribe = (listener: LanguageListener): (() => void) => {
        /**
         * Handles a runtime message for this subscription.
         *
         * @param message Runtime message.
         *
         * @returns Listener result for matching messages.
         */
        const handler = (message: unknown): void | Promise<void> => {
            if (!isLanguageChangedMessage(message)) {
                return undefined;
            }

            return listener(message.data.language);
        };

        this.runtime.onMessage.addListener(handler);
        return () => this.runtime.onMessage.removeListener(handler);
    };
}

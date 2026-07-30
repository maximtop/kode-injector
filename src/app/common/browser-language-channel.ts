/**
 * @file
 */

import browser from 'webextension-polyfill';

import { LanguageChannel } from './language-channel';

/**
 * Browser runtime language channel for the current extension context.
 */
export const browserLanguageChannel = new LanguageChannel({
    /**
     * Sends a language message through the browser runtime.
     *
     * @param message Language-channel message to send.
     */
    sendMessage: (message) => browser.runtime.sendMessage(message),
    onMessage: {
        /**
         * Subscribes to language messages from the browser runtime.
         *
         * @param listener Listener to register.
         */
        addListener: (listener) => browser.runtime.onMessage.addListener(listener),

        /**
         * Removes a language-message listener from the browser runtime.
         *
         * @param listener Previously registered listener to remove.
         */
        removeListener: (listener) => browser.runtime.onMessage.removeListener(listener),
    },
});

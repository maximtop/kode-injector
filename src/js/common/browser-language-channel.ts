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
     */
    sendMessage: (message) => browser.runtime.sendMessage(message),
    onMessage: {
        /**
         * Subscribes to language messages from the browser runtime.
         */
        addListener: (listener) => browser.runtime.onMessage.addListener(listener),

        /**
         * Removes a language-message listener from the browser runtime.
         */
        removeListener: (listener) => browser.runtime.onMessage.removeListener(listener),
    },
});

/**
 * @file
 */

import browser from 'webextension-polyfill';

import {
    BrowserTarget,
    getExtensionSettingsUrl,
} from './browser-target';
import type { PopupTab } from './contracts';
import { log } from './log';

/**
 * Provides browser tab and extension-page operations.
 */
class Tabs {
    /**
     * Opens the extension settings page.
     */
    openSettings = (): Promise<void> => {
        return browser.runtime.openOptionsPage();
    }

    /**
     * Opens this extension's browser-managed settings page when supported.
     *
     * @param target Browser hosting the extension.
     */
    openBrowserExtensionSettings = async (target: BrowserTarget): Promise<void> => {
        const url = getExtensionSettingsUrl(target, browser.runtime.id);
        if (!url) {
            return;
        }

        await this.openTab(url);
    };

    /**
     * Opens a browser tab for a URL.
     */
    openTab = (url: string): Promise<browser.Tabs.Tab> => {
        return browser.tabs.create({ active: true, url });
    }

    /**
     * Returns the active browser tab.
     */
    getCurrentTab = async (): Promise<PopupTab> => {
        const [current] = await browser.tabs.query({ active: true, currentWindow: true });
        return {
            id: current?.id,
            url: current?.url,
        };
    }

    /**
     * Reloads a browser tab when an identifier is available.
     */
    reloadTab = async (tabId?: number): Promise<void> => {
        try {
            await browser.tabs.reload(tabId);
        } catch (e) {
            log.error(e);
        }
    };
}

export const tabs = new Tabs();

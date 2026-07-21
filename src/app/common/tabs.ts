/**
 * @file
 */

import browser from 'webextension-polyfill';

import {
    BrowserTarget,
    getExtensionSettingsUrl,
} from './browser-target';
import { OPTIONS_PAGE_PATH, OPTIONS_QUERY_PARAMS } from './constants';
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
     * Builds an options page URL that prefills the rule editor with a site.
     *
     * @param site Hostname to prefill.
     *
     * @returns Absolute options page URL with the prefill query parameter.
     */
    getOptionsUrlForSite = (site: string): string => {
        const baseUrl = browser.runtime.getURL(OPTIONS_PAGE_PATH);
        return `${baseUrl}?${OPTIONS_QUERY_PARAMS.PREFILL_SITE}=${encodeURIComponent(site)}`;
    };

    /**
     * Builds an options page URL that opens a specific tab.
     *
     * @param tab Options tab identifier.
     *
     * @returns Absolute options page URL with the tab query parameter.
     */
    getOptionsUrlForTab = (tab: string): string => {
        const baseUrl = browser.runtime.getURL(OPTIONS_PAGE_PATH);
        return `${baseUrl}?${OPTIONS_QUERY_PARAMS.TAB}=${encodeURIComponent(tab)}`;
    };

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

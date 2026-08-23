/**
 * @file Background singleton of the built-in demo launch.
 */

import browser from 'webextension-polyfill';

import {
    BUILT_IN_DEMO_SHIPPED,
    DEMO_LAUNCH_SESSION_KEY,
    DEMO_WAIT_TIMEOUT_MS,
    toPersistedDemoLaunch,
    type PersistedDemoLaunch,
} from '../common/demo-contracts';
import { tabs } from '../common/tabs';
import { app } from './app';
import { executeScript } from './execute-script';
import { injections } from './injections';
import { demoSources } from './demo-sources';
import {
    DemoLaunchService,
    type DemoLaunchStore,
    type DemoTab,
} from './demo-launch-service';

/**
 * Session-scoped launch store over `chrome.storage.session` (Safari 16.4+,
 * Chromium MV3). The polyfill's typings predate the session area, so the
 * `chrome` namespace is used directly, as `execute-script.ts` does for
 * `chrome.scripting`. Without the area the launch is memory-only.
 */
class SessionLaunchStore implements DemoLaunchStore {
    /**
     * Reads the stored launch, or null when none is stored or it is malformed.
     */
    public read = async (): Promise<PersistedDemoLaunch | null> => {
        const session = chrome.storage?.session;
        if (!session) {
            return null;
        }
        const stored = await session.get(DEMO_LAUNCH_SESSION_KEY);
        return toPersistedDemoLaunch(stored[DEMO_LAUNCH_SESSION_KEY]);
    };

    /**
     * Stores the launch, or clears it with null.
     *
     * @param launch Launch to store, or null.
     */
    public write = async (launch: PersistedDemoLaunch | null): Promise<void> => {
        const session = chrome.storage?.session;
        if (!session) {
            return;
        }
        if (launch) {
            await session.set({ [DEMO_LAUNCH_SESSION_KEY]: launch });
        } else {
            await session.remove(DEMO_LAUNCH_SESSION_KEY);
        }
    };
}

export const demoLaunch = new DemoLaunchService({
    shipped: BUILT_IN_DEMO_SHIPPED,
    launchStore: new SessionLaunchStore(),

    /**
     * Opens the demo tab through the shared tab helper.
     *
     * @param url URL to open.
     */
    createTab: (url: string): Promise<DemoTab> => tabs.openTab(url),

    /**
     * Reads a tab, or resolves undefined when it no longer exists.
     *
     * @param tabId Tab identifier.
     */
    getTab: async (tabId: number): Promise<DemoTab | undefined> => {
        try {
            return await browser.tabs.get(tabId);
        } catch {
            return undefined;
        }
    },

    /**
     * Brings the demo tab to the front and loads the target in it.
     *
     * @param tabId Tab identifier.
     * @param url URL to load.
     */
    navigateTab: async (tabId: number, url: string): Promise<void> => {
        await browser.tabs.update(tabId, { active: true, url });
    },

    /**
     * Subscribes to tab removal.
     *
     * @param listener Receives the removed tab identifier.
     */
    onTabRemoved: (listener: (tabId: number) => void): void => {
        browser.tabs.onRemoved.addListener((tabId) => listener(tabId));
    },
    executeScript,

    /**
     * Loads the fixed demo sources.
     */
    loadSources: () => demoSources.load(),

    /**
     * Returns the number of persisted custom rules.
     */
    getRuleCount: (): number => injections.getInjections().length,

    /**
     * Whether injections are globally enabled.
     */
    isAppEnabled: (): boolean => app.enabled,

    /**
     * Whether the user disabled injecting on a site.
     *
     * @param url Document URL.
     */
    isSiteBlocked: (url: string): boolean => injections.isSiteBlacklisted(url),

    /**
     * Wall clock in milliseconds.
     */
    now: (): number => Date.now(),
    waitTimeoutMs: DEMO_WAIT_TIMEOUT_MS,
});

/**
 * @file
 */

import throttle from 'lodash/throttle';
import find from 'lodash/find';

import { nanoid } from 'nanoid';
import { storage } from './storage';
import type {
    CssInjectionCode,
    InjectionRule,
    InjectionsCodeResponse,
    NewInjectionData,
    StoredInjectionsState,
} from '../common/contracts';
import { normalizeStoredInjectionsState } from '../common/contracts';
import { log } from '../common/log';
import { urlUtils } from '../common/url-utils';
import { app } from './app';
import { executeScript } from './execute-script';

/**
 * Manages injection rules, site blocklisting, and code retrieval.
 */
class Injections {
    /**
     * Storage key for persisted injection state.
     */
    STORAGE_KEY = 'injections';

    /**
     * Delay used to throttle storage updates.
     */
    UPDATE_STORAGE_TIMEOUT_MS = 1000;

    /**
     * Configured injection rules.
     */
    injections: InjectionRule[] = [];

    /**
     * Hostnames where injections are disabled.
     */
    blocklist: string[] = [];

    /**
     * Persists the current injection and blocklist state.
     */
    updateStorage = throttle(async (): Promise<void> => {
        await storage.set<StoredInjectionsState>(this.STORAGE_KEY, {
            injections: this.injections,
            blocklist: this.blocklist,
        });
    }, this.UPDATE_STORAGE_TIMEOUT_MS);

    /**
     * Adds a validated injection rule.
     */
    addInjection = (
        injectionData: Partial<NewInjectionData> | null | undefined,
    ): InjectionRule | null => {
        // TODO make possible to add inject only css or only js
        if (!injectionData
            || !injectionData.cssPath
            || !injectionData.jsPath
            || !injectionData.site) {
            return null;
        }
        const { site, jsPath, cssPath } = injectionData;
        const injection: InjectionRule = {
            id: nanoid(),
            site,
            jsPath,
            cssPath,
            enabled: true,
        };
        this.injections.push(injection);
        this.updateStorage();
        return injection;
    };

    /**
     * Removes an injection rule by identifier.
     */
    removeInjection = (id: string): void => {
        const removedInjection = this.injections.find((injection) => injection.id === id);
        if (!removedInjection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }

        const { site } = removedInjection;
        this.injections = this.injections.filter((injection) => injection.id !== id);

        // clear blocklist
        const injectionsForSameSite = this.injections
            .filter((injection) => injection.site === site);
        if (injectionsForSameSite.length === 0) {
            this.blocklist = this.blocklist.filter((blockedSite) => blockedSite !== site);
        }

        this.updateStorage();
    };

    /**
     * Enables an injection rule by identifier.
     */
    enableInjection = (id: string): void => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: true });
        this.updateStorage();
    };

    /**
     * Disables an injection rule by identifier.
     */
    disableInjection = (id: string): void => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: false });
        this.updateStorage();
    };

    /**
     * Returns all configured injection rules.
     */
    getInjections = (): InjectionRule[] => {
        return this.injections;
    };

    /**
     * Returns injection rules matching a URL.
     */
    getInjectionsByUrl = (url: string): InjectionRule[] | null => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname) {
            log.error(`Url: "${url}" does not have hostname`);
            return null;
        }
        // TODO on enter format site input
        // TODO later allow to match exclusions by url
        // example.org, www.example.org, https://example.org, https://example.org
        return this.injections.filter((inj) => inj.site.includes(hostname));
    };

    /**
     * Reads injection source from a local file URL.
     */
    readFile = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            const data = await response.text();
            return data;
        } catch (e) {
            const message = e instanceof Error ? e.message : e;
            log.error(`Failed to get url: ${url}, due to: ${message}`);
            return '';
        }
    }

    /**
     * Returns enabled injection rules allowed for a URL.
     */
    getAllowedInjectionsByUrl = (url: string): InjectionRule[] | null => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname || this.blocklist.includes(hostname)) {
            return null;
        }
        return this.getInjectionsByUrl(url);
    }

    /**
     * Injects matching JavaScript into a browser tab.
     */
    injectJs = async (url: string, tabId?: number): Promise<void> => {
        if (!app.enabled) {
            return;
        }

        const injections = this.getAllowedInjectionsByUrl(url);
        if (!injections) {
            return;
        }

        const enabledInjections = injections.filter((injection) => injection.enabled);
        const promises = enabledInjections.map(async (injection) => {
            const { jsPath } = injection;
            const jsCode = await this.readFile(jsPath);
            await executeScript(jsCode, tabId, jsPath);
        });

        await Promise.all(promises);
    };

    /**
     * Builds CSS injection payloads matching a URL.
     */
    getCssInjection = async (url: string): Promise<InjectionsCodeResponse> => {
        if (!app.enabled) {
            return null;
        }

        const injections = this.getAllowedInjectionsByUrl(url);
        if (!injections) {
            return null;
        }

        const promises: Promise<CssInjectionCode>[] = injections
            .filter((injection) => injection.enabled)
            .map(async (injection) => {
                const { cssPath } = injection;
                const cssCode = await this.readFile(cssPath);
                return {
                    css: { filename: cssPath, code: cssCode },
                };
            });
        return Promise.all(promises);
    };

    /**
     * Enables injections for a site.
     *
     * @param url Site URL to remove from the blocklist.
     */
    enableInjectionsForSite(url: string): void {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname) {
            this.updateStorage();
            return;
        }

        this.blocklist = this.blocklist.filter((item) => item !== hostname);
        this.updateStorage();
    }

    /**
     * Disables injections for a site.
     *
     * @param url Site URL to add to the blocklist.
     */
    disableInjectionsForSite(url: string): void {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname || this.blocklist.includes(hostname)) {
            return;
        }
        this.blocklist.push(hostname);
        this.updateStorage();
    }

    /**
     * Checks whether a site has enabled injection rules.
     */
    hasSiteEnabledInjections = (url: string): boolean => {
        const injections = this.getInjectionsByUrl(url);
        return Boolean(injections?.some((injection) => injection.enabled));
    };

    /**
     * Checks whether a site is blocklisted.
     */
    isSiteBlacklisted = (url: string): boolean => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname) {
            return false;
        }

        return this.blocklist.some((h) => h === hostname);
    };

    /**
     * Restores persisted injection state.
     */
    init = async (): Promise<void> => {
        const storedState = await storage.get<unknown>(this.STORAGE_KEY);
        const { injections, blocklist } = normalizeStoredInjectionsState(storedState);
        this.injections = injections;
        this.blocklist = blocklist;
    };
}

export const injections = new Injections();

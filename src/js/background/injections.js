import throttle from 'lodash/throttle';
import find from 'lodash/find';

import { nanoid } from 'nanoid';
import { storage } from './storage';
import { log } from '../common/log';
import { urlUtils } from '../common/url-utils';
import { app } from './app';
import { executeScript } from './execute-script';

class Injections {
    STORAGE_KEY = 'injections';

    UPDATE_STORAGE_TIMEOUT_MS = 1000;

    injections = [];

    blocklist = [];

    updateStorage = throttle(async () => {
        await storage.set(this.STORAGE_KEY, {
            injections: this.injections,
            blocklist: this.blocklist,
        });
    }, this.UPDATE_STORAGE_TIMEOUT_MS);

    addInjection = (injectionData) => {
        // TODO make possible to add inject only css or only js
        if (!injectionData
            || !injectionData.cssPath
            || !injectionData.jsPath
            || !injectionData.site) {
            return null;
        }
        const injection = { id: nanoid(), ...injectionData, enabled: true };
        this.injections.push(injection);
        this.updateStorage();
        return injection;
    };

    removeInjection = (id) => {
        const removedInjection = this.injections.find((injection) => injection.id === id);
        const { site } = removedInjection;
        this.injections = this.injections.filter((injection) => injection.id !== id);

        // clear blocklist
        const injectionsForSameSite = this.injections
            .filter((injection) => injection.site === site);
        if (injectionsForSameSite.length === 0) {
            this.blocklist.filter((blockedSite) => blockedSite !== site);
        }

        this.updateStorage();
    };

    enableInjection = (id) => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: true });
        this.updateStorage();
    };

    disableInjection = (id) => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: false });
        this.updateStorage();
    };

    getInjections = () => {
        return this.injections;
    };

    getInjectionsByUrl = (url) => {
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

    readFile = async (url) => {
        try {
            const response = await fetch(url);
            const data = await response.text();
            return data;
        } catch (e) {
            log.error(`Failed to get url: ${url}, due to: ${e.message}`);
            return '';
        }
    };

    getAllowedInjectionsByUrl = (url) => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (this.blocklist.includes(hostname)) {
            return null;
        }
        return this.getInjectionsByUrl(url);
    }

    injectJs = async (url, tabId) => {
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

    getCssInjection = async (url) => {
        if (!app.enabled) {
            return null;
        }

        const injections = this.getAllowedInjectionsByUrl(url);
        if (!injections) {
            return null;
        }

        const promises = injections
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

    enableInjectionsForSite(url) {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        this.blocklist = this.blocklist.filter((item) => item !== hostname);
        this.updateStorage();
    }

    disableInjectionsForSite(url) {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (this.blocklist.includes(hostname)) {
            return;
        }
        this.blocklist.push(hostname);
        this.updateStorage();
    }

    hasSiteEnabledInjections = (url) => {
        const injections = this.getInjectionsByUrl(url);
        return injections.some((injection) => injection.enabled);
    };

    isSiteBlacklisted = (url) => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        return this.blocklist.some((h) => h === hostname);
    };

    init = async () => {
        const { injections = [], blocklist = [] } = await storage.get(this.STORAGE_KEY) || {};
        this.injections = injections;
        this.blocklist = blocklist;
    };
}

export const injections = new Injections();

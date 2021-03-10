import browser from 'webextension-polyfill';
import { log } from './log';

class Tabs {
    openSettings = () => {
        return browser.runtime.openOptionsPage();
    }

    openTab = (url) => {
        return browser.tabs.create({ active: true, url });
    }

    getCurrentTab = async () => {
        const [current] = await browser.tabs.query({ active: true, currentWindow: true });
        return current;
    }

    reloadTab = async (tabId) => {
        try {
            await browser.tabs.reload(tabId);
        } catch (e) {
            log.error(e);
        }
    };
}

export const tabs = new Tabs();

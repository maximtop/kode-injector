import browser from 'webextension-polyfill';

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
}

export const tabs = new Tabs();

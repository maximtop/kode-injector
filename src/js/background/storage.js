import browser from 'webextension-polyfill';

class Storage {
    set = async (key, value) => {
        return browser.storage.local.set({ [key]: value });
    }

    get = async (key) => {
        const result = await browser.storage.local.get([key]);
        return result[key];
    }
}

export const storage = new Storage();

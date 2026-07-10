/**
 * @file
 */

import browser from 'webextension-polyfill';

/**
 * Provides typed access to extension local storage.
 */
class Storage {
    /**
     * Persists a value under a storage key.
     */
    set = async <TValue>(key: string, value: TValue): Promise<void> => {
        await browser.storage.local.set({ [key]: value });
    };

    /**
     * Reads a value from a storage key.
     */
    get = async <TValue>(key: string): Promise<TValue | undefined> => {
        const result = await browser.storage.local.get([key]);
        return result[key] as TValue | undefined;
    };
}

export const storage = new Storage();

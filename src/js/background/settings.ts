/**
 * @file
 */

import throttle from 'lodash/throttle';

import type { AppSettings } from '../common/contracts';
import { normalizeAppSettings } from '../common/contracts';
import { SETTINGS, STORAGE_KEYS } from '../common/constants';
import { storage } from './storage';

const DEFAULT_SETTINGS: AppSettings = {
    [SETTINGS.APP_ENABLED]: true,
};

const UPDATE_STORAGE_THROTTLE_TIMEOUT = 500;

/**
 * Manages persisted global application settings.
 */
class Settings {
    /**
     * Current application settings.
     */
    settings: AppSettings = DEFAULT_SETTINGS;

    /**
     * Persists the current application settings.
     */
    updateStorage = throttle(async (): Promise<void> => {
        await storage.set<AppSettings>(STORAGE_KEYS.SETTINGS, this.settings);
    }, UPDATE_STORAGE_THROTTLE_TIMEOUT);

    /**
     * Updates an application setting.
     */
    setSetting = (key: typeof SETTINGS.APP_ENABLED, value: boolean): void => {
        this.settings[key] = value;
        this.updateStorage();
    };

    /**
     * Returns an application setting.
     */
    getSetting = (key: typeof SETTINGS.APP_ENABLED): boolean => {
        return this.settings[key];
    };

    /**
     * Returns all application settings.
     */
    getSettings = (): AppSettings => {
        return this.settings;
    }

    /**
     * Restores persisted application settings.
     */
    init = async (): Promise<void> => {
        const settingsFromStorage = await storage.get<unknown>(STORAGE_KEYS.SETTINGS);
        this.settings = normalizeAppSettings(settingsFromStorage);
    }
}

export const settings = new Settings();

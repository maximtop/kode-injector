import throttle from 'lodash/throttle';

import { SETTINGS, STORAGE_KEYS } from '../common/constants';
import { storage } from './storage';

const DEFAULT_SETTINGS = {
    [SETTINGS.APP_ENABLED]: true,
};

const UPDATE_STORAGE_THROTTLE_TIMEOUT = 500;

class Settings {
    settings = DEFAULT_SETTINGS;

    updateStorage = throttle(async () => {
        await storage.set(STORAGE_KEYS.SETTINGS, this.settings);
    }, UPDATE_STORAGE_THROTTLE_TIMEOUT);

    setSetting = (key, value) => {
        this.settings[key] = value;
        this.updateStorage();
    };

    getSetting = (key) => {
        return this.settings[key];
    };

    getSettings = () => {
        return this.settings;
    }

    init = async () => {
        const settingsFromStorage = await storage.get(STORAGE_KEYS.SETTINGS) || {};
        this.settings = { ...this.settings, ...settingsFromStorage };
    }
}

export const settings = new Settings();

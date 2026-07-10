/**
 * @file
 */

import throttle from 'lodash/throttle';

import type { AppSettings } from '../common/contracts';
import { normalizeAppSettingsWithRepair } from '../common/contracts';
import { SETTINGS, STORAGE_KEYS } from '../common/constants';
import type { LocalePreference } from '../common/locale';

/**
 * Storage contract needed by the settings service.
 */
export interface SettingsStorage {
    /**
     * Reads a storage key.
     */
    get<TValue>(key: string): Promise<TValue | undefined>;

    /**
     * Writes a storage key.
     */
    set<TValue>(key: string, value: TValue): Promise<void>;
}

const UPDATE_STORAGE_THROTTLE_TIMEOUT = 500;

/**
 * Manages persisted global settings and the interface language preference.
 */
export class SettingsService {
    /**
     * Current validated settings.
     */
    public settings: AppSettings = {
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    };

    /**
     * Serialized language writes.
     */
    private languageWrite: Promise<void> = Promise.resolve();

    /**
     * Persistent settings storage.
     */
    private storage: SettingsStorage;

    /**
     * Creates a settings service.
     *
     * @param storage Persistent storage implementation.
     */
    constructor(storage: SettingsStorage) {
        this.storage = storage;
    }

    /**
     * Persists ordinary settings with the existing throttle.
     */
    public updateStorage = throttle(async (): Promise<void> => {
        await this.storage.set<AppSettings>(STORAGE_KEYS.SETTINGS, this.settings);
    }, UPDATE_STORAGE_THROTTLE_TIMEOUT);

    /**
     * Updates the global enabled setting.
     *
     * @param key Setting key.
     * @param value New boolean value.
     */
    public setSetting = (key: typeof SETTINGS.APP_ENABLED, value: boolean): void => {
        this.settings[key] = value;
        this.updateStorage();
    };

    /**
     * Reads the global enabled setting.
     *
     * @param key Setting key.
     *
     * @returns Current boolean value.
     */
    public getSetting = (key: typeof SETTINGS.APP_ENABLED): boolean => {
        return this.settings[key];
    };

    /**
     * Returns all validated settings.
     *
     * @returns Current settings.
     */
    public getSettings = (): AppSettings => {
        return this.settings;
    };

    /**
     * Returns the saved interface language preference.
     *
     * @returns Auto or explicit locale preference.
     */
    public getSelectedLanguage = (): LocalePreference => {
        return this.settings[SETTINGS.SELECTED_LANGUAGE];
    };

    /**
     * Persists a language change in request order.
     *
     * @param language New validated language preference.
     *
     * @returns Promise resolved after durable storage.
     */
    public setSelectedLanguage = (language: LocalePreference): Promise<void> => {
        const nextWrite = this.languageWrite.catch(() => undefined).then(async () => {
            this.settings = {
                ...this.settings,
                [SETTINGS.SELECTED_LANGUAGE]: language,
            };
            await this.storage.set<AppSettings>(STORAGE_KEYS.SETTINGS, this.settings);
        });
        this.languageWrite = nextWrite;
        return nextWrite;
    };

    /**
     * Restores and repairs persisted settings.
     *
     * @returns Promise resolved when settings are ready.
     */
    public init = async (): Promise<void> => {
        const rawSettings = await this.storage.get<unknown>(STORAGE_KEYS.SETTINGS);
        const {
            settings: normalizedSettings,
            shouldRepair,
        } = normalizeAppSettingsWithRepair(rawSettings);
        this.settings = normalizedSettings;

        if (shouldRepair) {
            await this.storage.set<AppSettings>(STORAGE_KEYS.SETTINGS, this.settings);
        }
    };
}

/**
 * @file
 */

import {
    getSupportedLocalSourceAccessMethod,
    LocalSourceAccessMethod,
    normalizeAppSettingsWithRepair,
    type AppSettings,
} from '../common/contracts';
import { SETTINGS, STORAGE_KEYS } from '../common/constants';
import type { LocalePreference } from '../common/locale';
import {
    BrowserTarget,
    getCurrentBrowserTarget,
} from '../common/browser-target';

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

/**
 * Manages persisted global settings and the interface language preference.
 */
export class SettingsService {
    /**
     * Current validated settings.
     */
    public settings: AppSettings;

    /**
     * Serialized settings writes.
     */
    private settingsWrite: Promise<void> = Promise.resolve();

    /**
     * Persistent settings storage.
     */
    private storage: SettingsStorage;

    /**
     * Browser whose capabilities constrain saved settings.
     */
    private browserTarget: BrowserTarget;

    /**
     * Creates a settings service.
     *
     * @param storage Persistent storage implementation.
     * @param browserTarget Browser whose capabilities constrain saved settings.
     */
    constructor(
        storage: SettingsStorage,
        browserTarget: BrowserTarget = getCurrentBrowserTarget(),
    ) {
        this.storage = storage;
        this.browserTarget = browserTarget;
        this.settings = normalizeAppSettingsWithRepair(undefined, browserTarget).settings;
    }

    /**
     * Updates the global enabled setting.
     *
     * @param key Setting key.
     * @param value New boolean value.
     */
    public setSetting = (
        key: typeof SETTINGS.APP_ENABLED,
        value: boolean,
    ): Promise<void> => {
        return this.queueSettingsWrite({
            [key]: value,
        });
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
     * Returns the selected method for reading local sources.
     *
     * @returns Current target-supported access method.
     */
    public getLocalSourceAccessMethod = (): LocalSourceAccessMethod => {
        return this.settings[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD];
    };

    /**
     * Persists a local-source access method in request order.
     *
     * @param method Requested access method.
     *
     * @returns Promise resolved after durable storage.
     */
    public setLocalSourceAccessMethod = (
        method: LocalSourceAccessMethod,
    ): Promise<void> => {
        const supportedMethod = getSupportedLocalSourceAccessMethod(
            method,
            this.browserTarget,
        );

        return this.queueSettingsWrite({
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: supportedMethod,
        });
    };

    /**
     * Persists a language change in request order.
     *
     * @param language New validated language preference.
     *
     * @returns Promise resolved after durable storage.
     */
    public setSelectedLanguage = (language: LocalePreference): Promise<void> => {
        return this.queueSettingsWrite({
            [SETTINGS.SELECTED_LANGUAGE]: language,
        });
    };

    /**
     * Serializes durable settings updates without losing adjacent fields.
     *
     * @param update Settings fields to replace.
     *
     * @returns Promise resolved after durable storage.
     */
    private queueSettingsWrite = (update: Partial<AppSettings>): Promise<void> => {
        const nextWrite = this.settingsWrite.catch(() => undefined).then(async () => {
            const nextSettings = { ...this.settings, ...update };
            await this.storage.set<AppSettings>(STORAGE_KEYS.SETTINGS, nextSettings);
            this.settings = { ...this.settings, ...update };
        });
        this.settingsWrite = nextWrite;
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
        } = normalizeAppSettingsWithRepair(rawSettings, this.browserTarget);
        this.settings = normalizedSettings;

        if (shouldRepair) {
            await this.queueSettingsWrite({});
        }
    };
}

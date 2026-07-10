/**
 * @file
 */

import browser from 'webextension-polyfill';
import type { I18nInterface, Locale } from '@adguard/translate';

import { log } from './log';
import {
    BASE_LOCALE,
    type AvailableLocale,
    type LocalePreference,
    type LocaleStore,
    type MessagesJson,
} from './locale';
import { TranslationService } from './locale/translation-service';

/**
 * Shared internationalization facade for one extension bundle.
 */
class I18n implements I18nInterface {
    /**
     * Stateless catalog service for this bundle.
     */
    private readonly translationService = new TranslationService({
        /**
         * Returns the browser's current UI language.
         */
        getUILanguage: () => browser.i18n.getUILanguage(),

        /**
         * Resolves a resource path within the extension.
         */
        getURL: (path) => browser.runtime.getURL(path),

        /**
         * Fetches and parses a locale catalog.
         */
        fetchJson: async (url): Promise<MessagesJson> => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load locale: ${response.status}`);
            }
            return response.json() as Promise<MessagesJson>;
        },
    });

    /**
     * Whether locale initialization completed.
     */
    private initialized = false;

    /**
     * Connected MobX store for UI contexts.
     */
    private store: LocaleStore | null = null;

    /**
     * Standalone locale used before a UI store is connected.
     */
    private currentLocale: AvailableLocale = BASE_LOCALE;

    /**
     * Connects a MobX locale store used by a UI context.
     *
     * @param StoreClass Locale store constructor.
     *
     * @returns Connected locale store.
     */
    public connectStore<T extends LocaleStore>(
        StoreClass: new (service: TranslationService) => T,
    ): T {
        const store = new StoreClass(this.translationService);
        this.store = store;
        return store;
    }

    /**
     * Initializes locale state.
     *
     * @param preference Saved preference.
     *
     * @returns Promise resolved after initialization.
     */
    public async init(preference?: LocalePreference): Promise<void> {
        try {
            if (this.store) {
                await this.store.init(preference);
                this.currentLocale = this.store.currentLocale;
            } else {
                this.currentLocale = await this.translationService.loadLocaleData(preference);
            }
        } catch (error) {
            log.error('[i18n]: Failed to initialize locale', error);
            this.currentLocale = BASE_LOCALE;
        }

        this.initialized = true;
    }

    /**
     * Applies a changed preference to the current context.
     *
     * @param preference New preference.
     *
     * @returns Promise resolved after the locale is available.
     */
    public async setLocalePreference(preference: LocalePreference): Promise<void> {
        try {
            if (this.store) {
                await this.store.setLocalePreference(preference);
                this.currentLocale = this.store.currentLocale;
            } else {
                this.currentLocale = await this.translationService.loadLocaleData(preference);
            }
        } catch (error) {
            log.error('[i18n]: Failed to set locale', error);
            this.currentLocale = BASE_LOCALE;
        }
    }

    /**
     * Returns the current translated message.
     *
     * @param key Message key.
     *
     * @returns Translated message.
     */
    public getMessage(key: string): string {
        if (!this.initialized) {
            return browser.i18n.getMessage(key);
        }

        const locale = this.store?.currentLocale || this.currentLocale;
        return this.translationService.getMessage(locale, key);
    }

    /**
     * Returns the current translator locale.
     *
     * @returns Translator locale code.
     */
    public getUILanguage(): Locale {
        if (!this.initialized) {
            return browser.i18n.getUILanguage().toLowerCase().replace(/-/g, '_') as Locale;
        }

        const locale = this.store?.currentLocale || this.currentLocale;
        return this.translationService.getUILanguage(locale) as Locale;
    }

    /**
     * Returns an English base message.
     *
     * @param key Message key.
     *
     * @returns English message.
     */
    public getBaseMessage(key: string): string {
        if (!this.initialized) {
            return browser.i18n.getMessage(key);
        }

        return this.translationService.getBaseMessage(key);
    }

    /**
     * Returns the English translator locale.
     *
     * @returns Base locale code.
     */
    public getBaseUILanguage(): Locale {
        return BASE_LOCALE;
    }
}

export const i18n = new I18n();

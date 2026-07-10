/**
 * @file
 */

import {
    AVAILABLE_LOCALES,
    BASE_LOCALE,
    LANGUAGE_AUTO,
    type AvailableLocale,
    type LocalePreference,
} from './locale-constants';
import { checkLocale } from './check-locale';
import type {
    FlattenedMessages,
    MessagesJson,
    TranslationServiceDependencies,
} from './locale-types';

/**
 * Stateless locale loader and message lookup service.
 */
export class TranslationService {
    /**
     * Loaded locale messages.
     */
    private localeCache = new Map<AvailableLocale, FlattenedMessages>();

    /**
     * In-flight loads shared by concurrent callers.
     */
    private localeLoads = new Map<AvailableLocale, Promise<void>>();

    /**
     * Browser and fetch operations.
     */
    private dependencies: TranslationServiceDependencies;

    /**
     * Creates the service.
     *
     * @param dependencies Browser and fetch operations.
     */
    constructor(dependencies: TranslationServiceDependencies) {
        this.dependencies = dependencies;
    }

    /**
     * Flattens messages and discards malformed or empty entries.
     *
     * @param messages Parsed catalog content.
     *
     * @returns Key to message map.
     */
    private flattenMessages(messages: MessagesJson): FlattenedMessages {
        const result: FlattenedMessages = {};

        Object.entries(messages).forEach(([key, entry]) => {
            if (entry && typeof entry.message === 'string' && entry.message.length > 0) {
                result[key] = entry.message;
            }
        });

        return result;
    }

    /**
     * Resolves a preference to a supported concrete locale.
     *
     * @param preference Explicit locale or browser auto mode.
     *
     * @returns Supported locale, falling back to English.
     */
    public resolveLocale(preference: LocalePreference = LANGUAGE_AUTO): AvailableLocale {
        const requested = preference === LANGUAGE_AUTO
            ? this.dependencies.getUILanguage()
            : preference;
        const result = checkLocale(AVAILABLE_LOCALES, requested);

        return result.suitable ? result.locale : BASE_LOCALE;
    }

    /**
     * Loads one locale catalog and caches it.
     *
     * @param locale Locale directory to load.
     *
     * @returns Promise that resolves after the catalog is cached.
     */
    public async loadLocale(locale: AvailableLocale): Promise<void> {
        if (this.localeCache.has(locale)) {
            return;
        }

        const existingLoad = this.localeLoads.get(locale);
        if (existingLoad) {
            await existingLoad;
            return;
        }

        const url = this.dependencies.getURL(`_locales/${locale}/messages.json`);
        const load = this.dependencies.fetchJson(url)
            .then((messages) => {
                this.localeCache.set(locale, this.flattenMessages(messages));
            });
        this.localeLoads.set(locale, load);

        try {
            await load;
        } finally {
            if (this.localeLoads.get(locale) === load) {
                this.localeLoads.delete(locale);
            }
        }
    }

    /**
     * Loads English and the requested locale.
     *
     * @param preference Saved locale preference.
     *
     * @returns Concrete locale that should be rendered.
     */
    public async loadLocaleData(
        preference: LocalePreference = LANGUAGE_AUTO,
    ): Promise<AvailableLocale> {
        await this.loadLocale(BASE_LOCALE);
        const resolved = this.resolveLocale(preference);

        if (resolved !== BASE_LOCALE) {
            await this.loadLocale(resolved);
        }

        return resolved;
    }

    /**
     * Looks up a message for a concrete locale.
     *
     * @param locale Current concrete locale.
     * @param key Message key.
     *
     * @returns Localized message or empty string for translator fallback.
     *
     * @throws When the English catalog has no such key.
     */
    public getMessage(locale: AvailableLocale, key: string): string {
        const baseMessage = this.localeCache.get(BASE_LOCALE)?.[key];
        if (!baseMessage) {
            throw new Error(`There is no such key "${key}" in the messages`);
        }

        if (locale === BASE_LOCALE) {
            return baseMessage;
        }

        return this.localeCache.get(locale)?.[key] || '';
    }

    /**
     * Converts a directory locale into the translator locale format.
     *
     * @param locale Directory locale.
     *
     * @returns Lowercase locale identifier.
     */
    public getUILanguage(locale: AvailableLocale): string {
        return locale.toLowerCase();
    }

    /**
     * Looks up the English source message.
     *
     * @param key Message key.
     *
     * @returns English message or empty string.
     */
    public getBaseMessage(key: string): string {
        return this.localeCache.get(BASE_LOCALE)?.[key] || '';
    }

    /**
     * Returns the source translator locale.
     *
     * @returns English locale code.
     */
    public getBaseUILanguage(): string {
        return BASE_LOCALE;
    }
}

/**
 * @file
 */

import type { AvailableLocale, LocalePreference } from './locale-constants';

/**
 * Supported text directions.
 */
export type TextDirection = 'ltr' | 'rtl';

/**
 * WebExtension placeholder definition.
 */
export interface PlaceholderDefinition {
    /**
     * Placeholder substitution content.
     */
    content: string;
}

/**
 * Result of matching a browser locale against supported locales.
 */
export type CheckLocaleResult =
    | {
        suitable: true;
        locale: AvailableLocale;
    }
    | {
        suitable: false;
        locale: string;
    };

/**
 * Individual WebExtension localization message.
 */
export interface MessageEntry {
    /**
     * Localized message text.
     */
    message: string;

    /**
     * Optional translator context.
     */
    description?: string;

    /**
     * Optional WebExtension placeholder definitions.
     */
    placeholders?: Record<string, PlaceholderDefinition>;
}

/**
 * Parsed messages.json content.
 */
export type MessagesJson = Record<string, MessageEntry>;

/**
 * Flattened locale messages used for synchronous lookup.
 */
export type FlattenedMessages = Record<string, string>;

/**
 * Browser operations needed by the translation service.
 */
export interface TranslationServiceDependencies {
    /**
     * Returns the browser UI locale.
     */
    getUILanguage(): string;

    /**
     * Resolves a packaged extension URL.
     */
    getURL(path: string): string;

    /**
     * Fetches and parses a locale catalog.
     */
    fetchJson(url: string): Promise<MessagesJson>;
}

/**
 * Minimal locale state owner consumed by the i18n facade.
 */
export interface LocaleStore {
    /**
     * Concrete locale currently rendered by the UI.
     */
    readonly currentLocale: AvailableLocale;

    /**
     * Initializes the store from a saved preference.
     */
    init(preference?: LocalePreference): Promise<void>;

    /**
     * Changes the saved locale preference in the current context.
     */
    setLocalePreference(preference: LocalePreference): Promise<void>;
}

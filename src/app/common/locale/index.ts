/**
 * @file
 */

export {
    AVAILABLE_LOCALES,
    BASE_LOCALE,
    LANGUAGE_AUTO,
    LANGUAGE_NAMES,
    RTL_LOCALES,
    localePreferenceSchema,
    localePreferenceValueSchema,
    toLocalePreference,
} from './locale-constants';

export type {
    CheckLocaleResult,
    FlattenedMessages,
    LocaleStore,
    MessageEntry,
    MessagesJson,
    PlaceholderDefinition,
    TextDirection,
    TranslationServiceDependencies,
} from './locale-types';

export type { AvailableLocale, LocalePreference } from './locale-constants';

export { checkLocale } from './check-locale';
export { TranslationService } from './translation-service';
export { TranslationStore } from './translation-store';

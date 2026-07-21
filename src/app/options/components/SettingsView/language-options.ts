/**
 * @file
 */

import {
    AVAILABLE_LOCALES,
    LANGUAGE_AUTO,
    LANGUAGE_NAMES,
    type LocalePreference,
} from '../../../common/locale';

/**
 * Select option shown to the user.
 */
export interface LanguageOption {
    /**
     * Persisted language value.
     */
    value: LocalePreference;

    /**
     * Native visible name.
     */
    label: string;
}

/**
 * Builds selector options in the stable VPN-style order.
 *
 * @param selectedLanguage Current preference.
 * @param browserLanguageLabel Translated auto label.
 *
 * @returns Ordered language options.
 */
export const buildLanguageOptions = (
    selectedLanguage: LocalePreference,
    browserLanguageLabel: string,
): LanguageOption[] => {
    const autoOption: LanguageOption = {
        value: LANGUAGE_AUTO,
        label: browserLanguageLabel,
    };
    const languageOptions = [...AVAILABLE_LOCALES]
        .sort((a, b) => LANGUAGE_NAMES[a].localeCompare(LANGUAGE_NAMES[b]))
        .map((locale) => ({ value: locale, label: LANGUAGE_NAMES[locale] }));

    if (selectedLanguage === LANGUAGE_AUTO) {
        return [autoOption, ...languageOptions];
    }

    const selected = languageOptions.find((option) => option.value === selectedLanguage);
    if (!selected) {
        return [autoOption, ...languageOptions];
    }

    return [
        selected,
        autoOption,
        ...languageOptions.filter((option) => option.value !== selectedLanguage),
    ];
};

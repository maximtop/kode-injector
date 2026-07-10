/**
 * @file
 */

import React, { useContext, useMemo } from 'react';
import { Select } from 'antd';
import { observer } from 'mobx-react';

import { i18n } from '../../../common/i18n';
import type { LocalePreference } from '../../../common/locale';
import { messenger } from '../../../common/messenger';
import { translator } from '../../../common/translator';
import { log } from '../../../common/log';
import { rootStore } from '../../stores/RootStore';

import { buildLanguageOptions } from './language-options';

/**
 * Renders the options-page interface language selector.
 *
 * @returns Language selector element.
 */
export const LanguageSelect = observer(() => {
    const { translationStore } = useContext(rootStore);
    const browserLanguageLabel = translator.getMessage('language_browser');
    const options = useMemo(
        () => buildLanguageOptions(
            translationStore.userLocalePreference,
            browserLanguageLabel,
        ),
        [translationStore.userLocalePreference, browserLanguageLabel],
    );

    /**
     * Persists a newly selected interface language.
     *
     * @param language Selected language preference.
     */
    const handleChange = async (language: LocalePreference): Promise<void> => {
        if (language === translationStore.userLocalePreference) {
            return;
        }

        try {
            const savedLanguage = await messenger.setInterfaceLanguage(language);
            await i18n.setLocalePreference(savedLanguage);
        } catch (error) {
            log.error('[LanguageSelect]: Failed to set interface language', error);
        }
    };

    return (
        <label htmlFor="interface-language">
            <span>{translator.getMessage('language_label')}</span>
            <Select<LocalePreference>
                id="interface-language"
                value={translationStore.userLocalePreference}
                options={options}
                onChange={handleChange}
                dropdownMatchSelectWidth={false}
            />
        </label>
    );
});

/**
 * @file Settings tab: file access, language, and appearance groups.
 */

import React, { useContext, useMemo } from 'react';
import { observer } from 'mobx-react';
import {
    SegmentedControl,
    Select,
    useMantineColorScheme,
} from '@mantine/core';

import { rootStore } from '../../stores/RootStore';
import { COLOR_SCHEMES } from '../../../common/color-scheme';
import type { BrowserTarget } from '../../../common/browser-target';
import {
    LocalSourceAccessMethod,
} from '../../../common/contracts';
import { NativeHostStatus } from '../../../common/native-host-protocol';
import type { NativeHostDownload } from '../../../common/native-host-download';
import { i18n } from '../../../common/i18n';
import { messenger } from '../../../common/messenger';
import { log } from '../../../common/log';
import { translator } from '../../../common/translator';
import type { LocalePreference } from '../../../common/locale';
import { AccessMethodCards } from './AccessMethodCards';
import { MethodStatus } from './MethodStatus';
import { HelperDownloadCard } from './HelperDownloadCard';
import { buildLanguageOptions } from './language-options';

import './settings-view.pcss';

/**
 * SettingsView props.
 */
interface SettingsViewProps {
    /**
     * Browser hosting the extension.
     */
    browserTarget: BrowserTarget;

    /**
     * Resolved helper download destination.
     */
    download: NativeHostDownload;

    /**
     * Applies a user-selected access method.
     */
    onChangeMethod: (method: LocalSourceAccessMethod) => void;

    /**
     * Opens the resolved helper download.
     */
    onDownload: () => void;

    /**
     * Opens the complete helper downloads list.
     */
    onViewAllDownloads: () => void;

    /**
     * Rechecks the selected method.
     */
    onCheckAgain: () => void;

    /**
     * Opens the browser's extension settings, when supported.
     */
    onOpenExtensionSettings: (() => void) | undefined;
}

/**
 * Appearance values shown by the theme switcher.
 */
const THEME_VALUES = [COLOR_SCHEMES.LIGHT, COLOR_SCHEMES.AUTO, COLOR_SCHEMES.DARK] as const;

/**
 * Renders the Settings tab.
 *
 * @param props SettingsView props.
 *
 * @returns Settings tab element.
 */
export const SettingsView = observer(({
    browserTarget,
    download,
    onChangeMethod,
    onDownload,
    onViewAllDownloads,
    onCheckAgain,
    onOpenExtensionSettings,
}: SettingsViewProps): React.JSX.Element => {
    const { injectionsStore, translationStore } = useContext(rootStore);
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    const browserLanguageLabel = translator.getMessage('language_browser');
    const languageOptions = useMemo(
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
    const handleLanguageChange = async (language: string | null): Promise<void> => {
        if (!language || language === translationStore.userLocalePreference) {
            return;
        }

        try {
            const savedLanguage = await messenger.setInterfaceLanguage(
                language as LocalePreference,
            );
            await i18n.setLocalePreference(savedLanguage);
        } catch (error) {
            log.error('[SettingsView]: Failed to set interface language', error);
        }
    };

    const { localSourceAccess } = injectionsStore;
    const showDownloadCard = localSourceAccess.kind === LocalSourceAccessMethod.NativeHost
        && localSourceAccess.permissionGranted
        && (localSourceAccess.host.status === NativeHostStatus.NotInstalled
            || localSourceAccess.host.status === NativeHostStatus.UpdateRequired);

    const themeLabels: Record<typeof THEME_VALUES[number], string> = {
        light: translator.getMessage('theme_light'),
        auto: translator.getMessage('theme_system'),
        dark: translator.getMessage('theme_dark'),
    };

    return (
        <section>
            <div className="setting-group">
                <h2>{translator.getMessage('local_source_method')}</h2>
                <p className="setting-sub">
                    {translator.getMessage('settings_file_access_subtitle')}
                </p>
                <AccessMethodCards
                    browserTarget={browserTarget}
                    method={injectionsStore.localSourceAccessMethod}
                    disabled={injectionsStore.localSourceAccessMethodPending}
                    onChange={onChangeMethod}
                />
                <MethodStatus
                    state={localSourceAccess}
                    browserTarget={browserTarget}
                    disabled={injectionsStore.localSourceAccessMethodPending}
                    methodChangeError={injectionsStore.methodChangeError}
                    onCheckAgain={onCheckAgain}
                    onOpenExtensionSettings={onOpenExtensionSettings}
                    onRequestPermission={() => {
                        onChangeMethod(LocalSourceAccessMethod.NativeHost);
                    }}
                />
                {showDownloadCard && (
                    <HelperDownloadCard
                        download={download}
                        disabled={injectionsStore.localSourceAccessMethodPending}
                        onDownload={onDownload}
                        onViewAllDownloads={onViewAllDownloads}
                    />
                )}
            </div>

            <div className="setting-group">
                <h2>{translator.getMessage('language_label')}</h2>
                <p className="setting-sub">
                    {translator.getMessage('settings_language_subtitle')}
                </p>
                <div className="language-select">
                    <Select
                        value={translationStore.userLocalePreference}
                        data={languageOptions}
                        onChange={handleLanguageChange}
                        aria-label={translator.getMessage('language_label')}
                        allowDeselect={false}
                        comboboxProps={{ withinPortal: true }}
                    />
                </div>
            </div>

            <div className="setting-group">
                <h2>{translator.getMessage('settings_appearance_title')}</h2>
                <p className="setting-sub">
                    {translator.getMessage('settings_appearance_subtitle')}
                </p>
                <SegmentedControl
                    value={colorScheme}
                    onChange={(value) => {
                        setColorScheme(value as typeof THEME_VALUES[number]);
                    }}
                    data={THEME_VALUES.map((value) => ({
                        value,
                        label: themeLabels[value],
                    }))}
                    aria-label={translator.getMessage('settings_appearance_title')}
                />
            </div>
        </section>
    );
});

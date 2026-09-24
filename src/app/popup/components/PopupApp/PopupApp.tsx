/**
 * @file
 */

import { observer } from 'mobx-react';
import React, { useContext, useEffect, useLayoutEffect } from 'react';

import { browserLanguageChannel } from '../../../common/browser-language-channel';
import { AppProviders } from '../../../common/components/AppProviders';
import { applyDocumentLocale } from '../../../common/document-locale';
import { i18n } from '../../../common/i18n';
import { log } from '../../../common/log';
import { translator } from '../../../common/translator';
import { rootStore } from '../../stores/RootStore';
import { AccessBlock } from '../AccessBlock';
import { EmptyCta } from '../EmptyCta';
import { Footer } from '../Footer';
import { Header } from '../Header';
import { PausedStrip } from '../PausedStrip';
import { RulesList } from '../RulesList';
import { SiteBlock } from '../SiteBlock';

import './popup-app.pcss';

export const PopupApp = observer(() => {
    const { settingsStore, translationStore } = useContext(rootStore);

    useEffect(() => {
        settingsStore.getPopupData().catch((error) => log.error(error));
    }, [settingsStore]);

    useEffect(() => {
        return browserLanguageChannel.subscribe((language) => {
            return i18n.setLocalePreference(language);
        });
    }, []);

    useLayoutEffect(() => {
        applyDocumentLocale(
            document,
            translationStore.htmlLanguage,
            translationStore.direction,
            translator.getMessage('popup_title'),
        );
    }, [
        settingsStore.popupDataReady,
        translationStore.currentLocale,
        translationStore.htmlLanguage,
        translationStore.direction,
        translationStore.isLoading,
    ]);

    if (!settingsStore.popupDataReady) {
        return null;
    }

    return (
        <AppProviders direction={translationStore.direction}>
            <div className="popup-app">
                <Header />
                <PausedStrip />
                {settingsStore.isSupportedPage ? (
                    <>
                        <AccessBlock />
                        <SiteBlock />
                        <RulesList />
                        <EmptyCta />
                    </>
                ) : (
                    <p className="unsupported-page" data-testid="popup-unsupported">
                        {translator.getMessage('popup_unsupported_page')}
                    </p>
                )}
                <Footer />
            </div>
        </AppProviders>
    );
});

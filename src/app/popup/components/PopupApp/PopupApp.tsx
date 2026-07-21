/**
 * @file
 */

import React, { useContext, useEffect, useLayoutEffect } from 'react';
import { observer } from 'mobx-react';

import { AppProviders } from '../../../common/components/AppProviders';
import { Header } from '../Header';
import { PausedStrip } from '../PausedStrip';
import { AccessBlock } from '../AccessBlock';
import { SiteBlock } from '../SiteBlock';
import { RulesList } from '../RulesList';
import { EmptyCta } from '../EmptyCta';
import { Footer } from '../Footer';
import { rootStore } from '../../stores/RootStore';
import { browserLanguageChannel } from '../../../common/browser-language-channel';
import { applyDocumentLocale } from '../../../common/document-locale';
import { i18n } from '../../../common/i18n';
import { translator } from '../../../common/translator';

import './popup-app.pcss';

export const PopupApp = observer(() => {
    const { settingsStore, translationStore } = useContext(rootStore);

    useEffect(() => {
        settingsStore.getPopupData();
    }, []);

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

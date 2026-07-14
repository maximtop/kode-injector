/**
 * @file
 */

import React, { useContext, useEffect, useLayoutEffect } from 'react';
import { observer } from 'mobx-react';
import { ConfigProvider, Layout } from 'antd';

import { Header } from '../Header';
import { Main } from '../Main';
import { Footer } from '../Footer';
import { rootStore } from '../../stores/RootStore';
import { browserLanguageChannel } from '../../../common/browser-language-channel';
import { applyDocumentLocale } from '../../../common/document-locale';
import { i18n } from '../../../common/i18n';
import { translator } from '../../../common/translator';

import '../../../common/local-source-access-warning.pcss';
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
        <ConfigProvider direction={translationStore.direction}>
            <Layout className="popup-app">
                <Header />
                <Main />
                <Footer />
            </Layout>
        </ConfigProvider>
    );
});

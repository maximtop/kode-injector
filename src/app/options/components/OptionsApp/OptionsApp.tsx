/**
 * @file
 */

import React, { useContext, useEffect, useLayoutEffect } from 'react';
import { ConfigProvider, Layout } from 'antd';
import { observer } from 'mobx-react';

import { Header } from '../Header';
import { Footer } from '../Footer';
import { InjectionsTable } from '../InjectionsTable';
import { NewInjectionForm } from '../NewInjectionForm';
import { rootStore } from '../../stores/RootStore';
import { browserLanguageChannel } from '../../../common/browser-language-channel';
import { applyDocumentLocale } from '../../../common/document-locale';
import { i18n } from '../../../common/i18n';
import { translator } from '../../../common/translator';
import { LocalSourceAccessWarning } from '../../../common/LocalSourceAccessWarning';
import { log } from '../../../common/log';
import { tabs } from '../../../common/tabs';
import { subscribeLocalSourceAccessRefreshOnFocus } from '../../local-source-access-focus';
import { NATIVE_HOST_INSTALLATION_URL } from '../../../common/constants';

import '../../../common/local-source-access-warning.pcss';
import './options-app.pcss';

export const OptionsApp = observer(() => {
    const { injectionsStore, translationStore } = useContext(rootStore);
    const { getOptionsData, refreshLocalSourceAccess } = injectionsStore;

    /**
     * Opens native-host installation instructions.
     */
    const openNativeHostInstructions = (): void => {
        tabs.openTab(NATIVE_HOST_INSTALLATION_URL).catch(log.error);
    };

    useEffect(() => {
        getOptionsData();
    }, [getOptionsData]);

    useEffect(() => {
        return browserLanguageChannel.subscribe((language) => {
            return i18n.setLocalePreference(language);
        });
    }, []);

    useEffect(() => {
        return subscribeLocalSourceAccessRefreshOnFocus(window, refreshLocalSourceAccess);
    }, [refreshLocalSourceAccess]);

    useLayoutEffect(() => {
        applyDocumentLocale(
            document,
            translationStore.htmlLanguage,
            translationStore.direction,
            translator.getMessage('options_title'),
        );
    }, [
        injectionsStore.optionsDataReady,
        translationStore.currentLocale,
        translationStore.htmlLanguage,
        translationStore.direction,
        translationStore.isLoading,
    ]);

    if (!injectionsStore.optionsDataReady) {
        return null;
    }

    return (
        <ConfigProvider direction={translationStore.direction}>
            <Layout style={{ minHeight: '100vh' }}>
                <Header />
                <Layout.Content className="content">
                    <LocalSourceAccessWarning
                        state={injectionsStore.localSourceAccess}
                        compact={false}
                        onCheckAgain={refreshLocalSourceAccess}
                        onDownload={openNativeHostInstructions}
                    />
                    <NewInjectionForm />
                    <InjectionsTable />
                </Layout.Content>
                <Footer />
            </Layout>
        </ConfigProvider>
    );
});

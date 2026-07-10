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
import {
    BrowserTarget,
    getCurrentBrowserTarget,
} from '../../../common/browser-target';
import { applyDocumentLocale } from '../../../common/document-locale';
import { i18n } from '../../../common/i18n';
import { translator } from '../../../common/translator';
import { FileAccessWarning } from '../../../common/FileAccessWarning';
import { log } from '../../../common/log';
import { tabs } from '../../../common/tabs';
import { subscribeFileAccessRefreshOnFocus } from '../../file-access-focus';

import '../../../common/file-access-warning.pcss';
import './options-app.pcss';

export const OptionsApp = observer(() => {
    const { injectionsStore, translationStore } = useContext(rootStore);
    const { getOptionsData, refreshFileAccess } = injectionsStore;
    const browserTarget = getCurrentBrowserTarget();

    const openBrowserExtensionSettings = browserTarget === BrowserTarget.Firefox
        ? undefined
        : (): void => {
            tabs.openBrowserExtensionSettings(browserTarget).catch(log.error);
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
        return subscribeFileAccessRefreshOnFocus(window, refreshFileAccess);
    }, [refreshFileAccess]);

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
                    <FileAccessWarning
                        allowed={injectionsStore.fileAccessAllowed}
                        browserTarget={browserTarget}
                        compact={false}
                        onCheckAgain={refreshFileAccess}
                        onOpenSettings={openBrowserExtensionSettings}
                    />
                    <NewInjectionForm />
                    <InjectionsTable />
                </Layout.Content>
                <Footer />
            </Layout>
        </ConfigProvider>
    );
});

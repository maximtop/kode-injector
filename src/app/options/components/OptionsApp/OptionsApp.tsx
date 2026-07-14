/**
 * @file
 */

import React, { useContext, useEffect, useLayoutEffect } from 'react';
import { ConfigProvider, Layout, message } from 'antd';
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
import { FileAccessWarning } from '../../../common/FileAccessWarning';
import { log } from '../../../common/log';
import { tabs } from '../../../common/tabs';
import { subscribeLocalSourceAccessRefreshOnFocus } from '../../local-source-access-focus';
import { NATIVE_HOST_INSTALLATION_URL } from '../../../common/constants';
import {
    BrowserTarget,
    getCurrentBrowserTarget,
} from '../../../common/browser-target';
import { LocalSourceAccessMethod } from '../../../common/contracts';
import { nativeMessagingPermission } from '../../../common/native-messaging-permission';
import { applyLocalSourceAccessMethod } from '../../local-source-access-method';
import { LocalSourceAccessMethodSetting } from '../LocalSourceAccessMethodSetting';

import '../../../common/local-source-access-warning.pcss';
import '../../../common/file-access-warning.pcss';
import './options-app.pcss';

export const OptionsApp = observer(() => {
    const { injectionsStore, translationStore } = useContext(rootStore);
    const { getOptionsData, refreshLocalSourceAccess } = injectionsStore;
    const browserTarget = getCurrentBrowserTarget();

    const openBrowserExtensionSettings = browserTarget === BrowserTarget.Firefox
        ? undefined
        : (): void => {
            tabs.openBrowserExtensionSettings(browserTarget).catch(log.error);
        };

    /**
     * Opens native-host installation instructions.
     */
    const openNativeHostInstructions = (): void => {
        tabs.openTab(NATIVE_HOST_INSTALLATION_URL).catch(log.error);
    };

    /**
     * Applies a user-selected local-source access method.
     *
     * Native messaging is requested here, before any other asynchronous work,
     * so Chromium keeps the permission request associated with the click.
     *
     * @param method Selected access method.
     */
    const changeLocalSourceAccessMethod = async (
        method: LocalSourceAccessMethod,
    ): Promise<void> => {
        if (!injectionsStore.beginLocalSourceAccessMethodTransition()) {
            return;
        }

        try {
            await applyLocalSourceAccessMethod(method, {
                permission: nativeMessagingPermission,
                setMethod: injectionsStore.setLocalSourceAccessMethod,

                /**
                 * Shows permission denial without changing the selected method.
                 */
                showPermissionDenied: () => {
                    message.warning(translator.getMessage('native_host_permission_denied'));
                },

                /**
                 * Records optional permission API failures.
                 */
                logPermissionError: (error) => {
                    log.error('Native messaging permission operation failed', error);
                },
            });
        } catch (error) {
            log.error('Failed to change local source access method', error);
            message.error(translator.getMessage('local_source_method_change_failed'));
        } finally {
            injectionsStore.endLocalSourceAccessMethodTransition();
        }
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
                    <LocalSourceAccessMethodSetting
                        browserTarget={browserTarget}
                        method={injectionsStore.localSourceAccessMethod}
                        disabled={injectionsStore.localSourceAccessMethodPending}
                        onChange={changeLocalSourceAccessMethod}
                    />
                    {injectionsStore.localSourceAccess.kind
                        === LocalSourceAccessMethod.Browser ? (
                            <FileAccessWarning
                                allowed={injectionsStore.localSourceAccess.allowed}
                                browserTarget={browserTarget}
                                compact={false}
                                onCheckAgain={refreshLocalSourceAccess}
                                onOpenSettings={openBrowserExtensionSettings}
                            />
                        ) : (
                            <LocalSourceAccessWarning
                                state={injectionsStore.localSourceAccess}
                                compact={false}
                                disabled={injectionsStore.localSourceAccessMethodPending}
                                onCheckAgain={refreshLocalSourceAccess}
                                onDownload={openNativeHostInstructions}
                                onRequestPermission={() => {
                                    return changeLocalSourceAccessMethod(
                                        LocalSourceAccessMethod.NativeHost,
                                    );
                                }}
                            />
                        )}
                    <NewInjectionForm />
                    <InjectionsTable />
                </Layout.Content>
                <Footer />
            </Layout>
        </ConfigProvider>
    );
});

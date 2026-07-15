/**
 * @file
 */

import React, {
    useContext,
    useEffect,
    useLayoutEffect,
    useState,
} from 'react';
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
import { NATIVE_HOST_ALL_DOWNLOADS_URL } from '../../../common/constants';
import {
    BrowserTarget,
    getCurrentBrowserTarget,
} from '../../../common/browser-target';
import { LocalSourceAccessMethod } from '../../../common/contracts';
import { nativeMessagingPermission } from '../../../common/native-messaging-permission';
import { applyLocalSourceAccessMethod } from '../../../common/local-source-access-method';
import { LocalSourceAccessMethodSetting } from '../LocalSourceAccessMethodSetting';
import {
    NativeHostDownload,
    NativeHostDownloadKind,
    resolveCurrentNativeHostDownload,
} from '../../../common/native-host-download';

import '../../../common/local-source-access-warning.pcss';
import '../../../common/file-access-warning.pcss';
import './options-app.pcss';

export const OptionsApp = observer(() => {
    const { injectionsStore, translationStore } = useContext(rootStore);
    const { getOptionsData, refreshLocalSourceAccess } = injectionsStore;
    const browserTarget = getCurrentBrowserTarget();
    const [nativeHostDownload, setNativeHostDownload] = useState<NativeHostDownload>({
        kind: NativeHostDownloadKind.AllDownloads,
        url: NATIVE_HOST_ALL_DOWNLOADS_URL,
    });

    const openBrowserExtensionSettings = browserTarget === BrowserTarget.Firefox
        ? undefined
        : (): void => {
            tabs.openBrowserExtensionSettings(browserTarget).catch(log.error);
        };

    /**
     * Opens native-host installation instructions.
     */
    const openNativeHostInstructions = (): void => {
        tabs.openTab(nativeHostDownload.url).catch(log.error);
    };

    /**
     * Opens every published Helper package.
     */
    const openAllNativeHostDownloads = (): void => {
        tabs.openTab(NATIVE_HOST_ALL_DOWNLOADS_URL).catch(log.error);
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
        let active = true;

        resolveCurrentNativeHostDownload()
            .then((download) => {
                if (active) {
                    setNativeHostDownload(download);
                }
            })
            .catch((error) => {
                log.error('Failed to resolve Kode Injector Helper download', error);
            });

        return () => {
            active = false;
        };
    }, []);

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
                        download={nativeHostDownload}
                        onChange={changeLocalSourceAccessMethod}
                        onDownloadNativeHost={openNativeHostInstructions}
                        onViewAllDownloads={openAllNativeHostDownloads}
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
                                browserTarget={browserTarget}
                                compact={false}
                                disabled={injectionsStore.localSourceAccessMethodPending}
                                download={nativeHostDownload}
                                onCheckAgain={refreshLocalSourceAccess}
                                onDownload={openNativeHostInstructions}
                                onRequestPermission={() => {
                                    return changeLocalSourceAccessMethod(
                                        LocalSourceAccessMethod.NativeHost,
                                    );
                                }}
                                onUseBrowserAccess={undefined}
                                onViewAllDownloads={openAllNativeHostDownloads}
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

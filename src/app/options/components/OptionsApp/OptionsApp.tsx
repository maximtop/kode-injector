/**
 * @file
 */

import { Tabs } from '@mantine/core';
import { observer } from 'mobx-react';
import React, {
    useContext,
    useEffect,
    useLayoutEffect,
    useState,
} from 'react';
import browser from 'webextension-polyfill';

import { getBrowserCapabilities } from '../../../common/browser-capabilities';
import { browserLanguageChannel } from '../../../common/browser-language-channel';
import { getCurrentBrowserTarget } from '../../../common/browser-target';
import { AppProviders } from '../../../common/components/AppProviders';
import {
    InjectionField,
    NATIVE_HOST_ALL_DOWNLOADS_URL,
    OPTIONS_TABS,
} from '../../../common/constants';
import { applyDocumentLocale } from '../../../common/document-locale';
import { i18n } from '../../../common/i18n';
import { applyLocalSourceAccessMethod } from '../../../common/local-source-access-method';
import { log } from '../../../common/log';
import {
    NativeHostDownloadKind,
    resolveCurrentNativeHostDownload,
} from '../../../common/native-host-download';
import {
    NativeErrorCode,
} from '../../../common/native-host-protocol';
import { nativeMessagingPermission } from '../../../common/native-messaging-permission';
import { SafariNativeClient } from '../../../common/safari-native-client';
import { tabs } from '../../../common/tabs';
import { translator } from '../../../common/translator';
import { subscribeLocalSourceAccessRefreshOnFocus } from '../../local-source-access-focus';
import {
    getPrefillSiteFromSearch,
    getRequestedTabFromSearch,
} from '../../options-url-params';
import {
    SafariRuleAuthorizationError,
    saveRuleWithSafariAuthorization,
} from '../../safari-rule-authorization';
import { rootStore } from '../../stores/RootStore';
import { Footer } from '../Footer';
import { InjectionsView } from '../InjectionsView';
import { RuleEditorModal } from '../RuleEditorModal';
import { SettingsView } from '../SettingsView';
import { Topbar } from '../Topbar';

import type { InjectionRule, LocalSourceAccessMethod, NewInjectionData } from '../../../common/contracts';
import type { NativeHostDownload } from '../../../common/native-host-download';

import './options-app.pcss';

/**
 * Rule editor presentation state.
 */
interface EditorState {
    /**
     * Whether the editor modal is open.
     */
    opened: boolean;

    /**
     * Rule being edited, or null when creating.
     */
    rule: InjectionRule | null;

    /**
     * Site prefilled into a new rule, or null.
     */
    prefillSite: string | null;
}

/**
 * Closed editor state.
 */
const EDITOR_CLOSED: EditorState = {
    opened: false,
    rule: null,
    prefillSite: null,
};

let safariNativeClient: SafariNativeClient | undefined;

const safariFolderAuthorizer = {
    /**
     * Requests the native exact-folder grant from the Save event.
     *
     * @param fileUrl Local source URL whose containing folder needs authorization.
     */
    authorizeFolder: (fileUrl: string): Promise<void> => {
        if (!safariNativeClient) {
            safariNativeClient = new SafariNativeClient(
                browser.runtime.sendNativeMessage.bind(browser.runtime),
            );
        }
        return safariNativeClient.authorizeFolder(fileUrl);
    },
};

export const OptionsApp = observer(() => {
    const { injectionsStore, translationStore } = useContext(rootStore);
    const { getOptionsData, refreshLocalSourceAccess } = injectionsStore;
    const browserTarget = getCurrentBrowserTarget();
    const browserCapabilities = getBrowserCapabilities(browserTarget);
    const [activeTab, setActiveTab] = useState<string>(OPTIONS_TABS.INJECTIONS);
    const [editorState, setEditorState] = useState<EditorState>(EDITOR_CLOSED);
    const [editorSaveError, setEditorSaveError] = useState<string | null>(null);
    const [nativeHostDownload, setNativeHostDownload] = useState<NativeHostDownload>({
        kind: NativeHostDownloadKind.AllDownloads,
        url: NATIVE_HOST_ALL_DOWNLOADS_URL,
    });

    const openBrowserExtensionSettings = !browserCapabilities.canOpenFileAccessSettings
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

        injectionsStore.setMethodChangeError(null);

        try {
            await applyLocalSourceAccessMethod(method, {
                permission: nativeMessagingPermission,
                setMethod: injectionsStore.setLocalSourceAccessMethod,

                /**
                 * Shows permission denial without changing the selected method.
                 */
                showPermissionDenied: () => {
                    injectionsStore.setMethodChangeError(
                        translator.getMessage('native_host_permission_denied'),
                    );
                },

                /**
                 * Records optional permission API failures.
                 *
                 * @param error Permission API failure to record.
                 */
                logPermissionError: (error) => {
                    log.error('Native messaging permission operation failed', error);
                },
            });
        } catch (error) {
            log.error('Failed to change local source access method', error);
            injectionsStore.setMethodChangeError(
                translator.getMessage('local_source_method_change_failed'),
            );
        } finally {
            injectionsStore.endLocalSourceAccessMethodTransition();
        }
    };

    /**
     * Persists rule editor values.
     *
     * @param data Validated rule data.
     * @param ruleId Edited rule identifier, or null when creating.
     *
     * @returns Whether saving succeeded.
     */
    const handleEditorSave = async (
        data: NewInjectionData,
        ruleId: string | null,
    ): Promise<boolean> => {
        setEditorSaveError(null);
        try {
            return await saveRuleWithSafariAuthorization(
                browserTarget,
                data,
                safariFolderAuthorizer,
                async () => {
                    if (ruleId) {
                        return Boolean(await injectionsStore.updateInjection(ruleId, data));
                    }
                    return Boolean(await injectionsStore.addInjection(data));
                },
            );
        } catch (error) {
            if (error instanceof SafariRuleAuthorizationError) {
                const file = error.field === InjectionField.JsPath
                    ? translator.getMessage('editor_js_label')
                    : translator.getMessage('editor_css_label');
                if (error.code === NativeErrorCode.AuthorizationCancelled as string) {
                    setEditorSaveError(
                        translator.getMessage('editor_safari_authorization_cancelled'),
                    );
                } else if (error.code === NativeErrorCode.AuthorizationTargetNotFound as string) {
                    setEditorSaveError(translator.getMessage(
                        'editor_safari_folder_not_found',
                        { file },
                    ));
                } else {
                    setEditorSaveError(translator.getMessage(
                        'editor_safari_authorization_failed',
                        { file },
                    ));
                }
                return false;
            }
            throw error;
        }
    };

    useEffect(() => {
        getOptionsData().catch((error) => log.error('Failed to load options data', error));
    }, [getOptionsData]);

    useEffect(() => {
        if (!injectionsStore.optionsDataReady) {
            return;
        }

        const { search, pathname } = window.location;
        const prefillSite = getPrefillSiteFromSearch(search);
        const requestedTab = getRequestedTabFromSearch(search);

        if (requestedTab) {
            setActiveTab(requestedTab);
        }

        if (prefillSite) {
            setActiveTab(OPTIONS_TABS.INJECTIONS);
            setEditorState({ opened: true, rule: null, prefillSite });
        }

        if (prefillSite || requestedTab) {
            window.history.replaceState(null, '', pathname);
        }
    }, [injectionsStore.optionsDataReady]);

    useEffect(() => {
        let active = true;

        if (!browserCapabilities.canDownloadExternalHelper) {
            return undefined;
        }

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
    }, [browserCapabilities.canDownloadExternalHelper]);

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
        <AppProviders direction={translationStore.direction}>
            <div className="app-shell">
                <Topbar
                    localSourceAccess={injectionsStore.localSourceAccess}
                    onOpenSettingsTab={() => setActiveTab(OPTIONS_TABS.SETTINGS)}
                />
                <Tabs
                    value={activeTab}
                    onChange={(value) => setActiveTab(value ?? OPTIONS_TABS.INJECTIONS)}
                    keepMounted={false}
                >
                    <div className="tabs-rail">
                        <div className="tabs-rail-inner">
                            <Tabs.List>
                                <Tabs.Tab value={OPTIONS_TABS.INJECTIONS}>
                                    {translator.getMessage('tab_injections')}
                                </Tabs.Tab>
                                <Tabs.Tab value={OPTIONS_TABS.SETTINGS}>
                                    {translator.getMessage('tab_settings')}
                                </Tabs.Tab>
                            </Tabs.List>
                        </div>
                    </div>
                    <main className="app-main">
                        {!injectionsStore.appEnabled && (
                            <div className="pause-strip" role="status" data-testid="pause-strip">
                                <span>
                                    <strong>{translator.getMessage('pause_strip_text')}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        void injectionsStore.toggleAppEnabled();
                                    }}
                                >
                                    {translator.getMessage('pause_resume')}
                                </button>
                            </div>
                        )}
                        <Tabs.Panel value={OPTIONS_TABS.INJECTIONS}>
                            <InjectionsView
                                onCreate={() => {
                                    setEditorSaveError(null);
                                    setEditorState({ opened: true, rule: null, prefillSite: null });
                                }}
                                onEdit={(rule) => {
                                    setEditorSaveError(null);
                                    setEditorState({ opened: true, rule, prefillSite: null });
                                }}
                                onOpenSettingsTab={() => setActiveTab(OPTIONS_TABS.SETTINGS)}
                            />
                        </Tabs.Panel>
                        <Tabs.Panel value={OPTIONS_TABS.SETTINGS}>
                            <SettingsView
                                browserTarget={browserTarget}
                                download={nativeHostDownload}
                                onChangeMethod={(method) => {
                                    void changeLocalSourceAccessMethod(method);
                                }}
                                onDownload={openNativeHostInstructions}
                                onViewAllDownloads={openAllNativeHostDownloads}
                                onCheckAgain={() => {
                                    void refreshLocalSourceAccess();
                                }}
                                onOpenExtensionSettings={openBrowserExtensionSettings}
                                onOpenDemo={() => setActiveTab(OPTIONS_TABS.INJECTIONS)}
                            />
                        </Tabs.Panel>
                    </main>
                </Tabs>
                <Footer />
                <RuleEditorModal
                    opened={editorState.opened}
                    rule={editorState.rule}
                    prefillSite={editorState.prefillSite}
                    onClose={() => {
                        setEditorSaveError(null);
                        setEditorState(EDITOR_CLOSED);
                    }}
                    onSave={handleEditorSave}
                    saveError={editorSaveError}
                />
            </div>
        </AppProviders>
    );
});

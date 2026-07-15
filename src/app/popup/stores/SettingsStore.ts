/**
 * @file
 */

import {
    computed,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';

import {
    LocalSourceAccessMethod,
    type LocalSourceAccessState,
    type PopupTab,
} from '../../common/contracts';
import { messenger } from '../../common/messenger';
import { log } from '../../common/log';
import { tabs } from '../../common/tabs';
import { urlUtils } from '../../common/url-utils';
import { i18n } from '../../common/i18n';
import { applyLocalSourceAccessMethod } from '../../common/local-source-access-method';
import { nativeMessagingPermission } from '../../common/native-messaging-permission';
import type { RootStoreType } from './RootStore';
import { preparePopupState } from './popup-initialization';

/**
 * Manages popup state and settings actions.
 */
export class SettingsStore {
    /**
     * Parent popup store.
     */
    rootStore: RootStoreType;

    /**
     * Creates a popup settings store.
     *
     * @param rootStore Parent popup store.
     */
    constructor(rootStore: RootStoreType) {
        makeObservable(this);
        this.rootStore = rootStore;
    }

    /**
     * Whether the extension is globally enabled.
     */
    @observable
    appEnabled = true;

    /**
     * Whether popup data has finished loading.
     */
    @observable
    popupDataReady = false;

    /**
     * Whether the browser currently permits local-file access.
     */
    @observable
    localSourceAccess: LocalSourceAccessState = {
        kind: LocalSourceAccessMethod.Browser,
        allowed: true,
    };

    /**
     * Whether an explicit method transition is in progress.
     */
    @observable
    localSourceAccessMethodPending = false;

    /**
     * Active browser tab displayed by the popup.
     */
    @observable
    currentTab: PopupTab = {};

    /**
     * Whether the current site has enabled injection rules.
     */
    @observable
    siteHasEnabledInjections = false;

    /**
     * Whether injections are disabled for the current site.
     */
    @observable
    siteIsBlacklisted = false;

    /**
     * Loads settings and injection state for the popup.
     */
    getPopupData = async (): Promise<void> => {
        const currentTab = await tabs.getCurrentTab();
        const popupData = await messenger.getPopupData(currentTab);
        const state = await preparePopupState(currentTab, popupData, (language) => {
            return i18n.init(language);
        });

        runInAction(() => {
            this.appEnabled = state.appEnabled;
            this.currentTab = state.currentTab;
            this.localSourceAccess = state.localSourceAccess;
            this.siteHasEnabledInjections = state.siteHasEnabledInjections;
            this.siteIsBlacklisted = state.siteIsBlacklisted;
            this.popupDataReady = true;
        });
    }

    /**
     * Explicitly returns Chromium to browser-managed local-file access.
     */
    useBrowserFileAccess = async (): Promise<void> => {
        if (this.localSourceAccessMethodPending) {
            return;
        }

        runInAction(() => {
            this.localSourceAccessMethodPending = true;
        });

        try {
            await applyLocalSourceAccessMethod(LocalSourceAccessMethod.Browser, {
                permission: nativeMessagingPermission,

                /**
                 * Persists browser access and rejects target coercion.
                 */
                setMethod: async (method) => {
                    const selectedMethod = await messenger.setLocalSourceAccessMethod(method);
                    if (selectedMethod !== LocalSourceAccessMethod.Browser) {
                        throw new Error('BROWSER_FILE_ACCESS_NOT_SELECTED');
                    }
                },

                /**
                 * Browser access never requests permission.
                 */
                showPermissionDenied: () => undefined,

                /**
                 * Records cleanup failures without undoing the saved method.
                 */
                logPermissionError: (error) => {
                    log.error('Native messaging permission operation failed', error);
                },
            });

            runInAction(() => {
                this.localSourceAccess = {
                    kind: LocalSourceAccessMethod.Browser,
                    allowed: true,
                };
            });

            const localSourceAccess = await messenger.getLocalSourceAccessStatus();
            if (localSourceAccess.kind === LocalSourceAccessMethod.Browser) {
                runInAction(() => {
                    this.localSourceAccess = localSourceAccess;
                });
            }
        } catch (error) {
            log.error('Failed to use browser file access', error);
        } finally {
            runInAction(() => {
                this.localSourceAccessMethodPending = false;
            });
        }
    };

    /**
     * Disables the extension globally.
     */
    disableApp = async (): Promise<void> => {
        try {
            await messenger.disableApp();
            runInAction(() => {
                this.appEnabled = false;
            });
            await tabs.reloadTab(this.currentTab.id);
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
    }

    /**
     * Enables the extension globally.
     */
    enableApp = async (): Promise<void> => {
        try {
            await messenger.enableApp();
            runInAction(() => {
                this.appEnabled = true;
            });
            await tabs.reloadTab(this.currentTab.id);
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
    }

    /**
     * Returns the active tab hostname.
     *
     * @returns Active tab hostname or an empty string.
     */
    @computed
    get currentTabHostname(): string {
        return urlUtils.getHostname(this.currentTab.url) || '';
    }

    /**
     * Disables injections for the current site.
     */
    disableInjectionsForSite = async (): Promise<void> => {
        const currentTab = await tabs.getCurrentTab();
        await messenger.disableInjectionsForSite(currentTab);
    }

    /**
     * Enables injections for the current site.
     */
    enableInjectionsForSite = async (): Promise<void> => {
        const currentTab = await tabs.getCurrentTab();
        await messenger.enableInjectionsForSite(currentTab);
    }
}

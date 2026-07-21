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
    type InjectionFileField,
    type InjectionRule,
    LocalSourceAccessMethod,
    type LocalSourceAccessState,
    type PopupTab,
} from '../../common/contracts';
import { FILE_ENABLED_FLAGS, isRuleActive } from '../../common/injection-files';
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
     * Injection rules matching the current site.
     */
    @observable
    matchingInjections: InjectionRule[] = [];

    /**
     * Whether injections are disabled for the current site.
     */
    @observable
    siteIsBlacklisted = false;

    /**
     * Whether the current site has enabled injection rules.
     *
     * @returns Whether any matching rule is enabled.
     */
    @computed
    get siteHasEnabledInjections(): boolean {
        return this.matchingInjections.some(isRuleActive);
    }

    /**
     * Number of active rules matching the current site.
     *
     * A rule is active when it is enabled and at least one of its files is
     * both present and enabled.
     *
     * @returns Count of active matching rules.
     */
    @computed
    get activeInjectionCount(): number {
        return this.matchingInjections.filter(isRuleActive).length;
    }

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
            this.matchingInjections = state.matchingInjections;
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
     * Whether the current tab is a page the extension can inject into.
     *
     * Browser-internal pages (chrome://, about:, the new tab) and file
     * URLs have no usable hostname for rules.
     *
     * @returns Whether the current page supports injection rules.
     */
    @computed
    get isSupportedPage(): boolean {
        const { url } = this.currentTab;
        if (!url || !/^https?:/i.test(url)) {
            return false;
        }

        return Boolean(urlUtils.getHostnameWithoutWww(url));
    }

    /**
     * Disables injections for the current site.
     */
    disableInjectionsForSite = async (): Promise<void> => {
        const currentTab = await tabs.getCurrentTab();
        await messenger.disableInjectionsForSite(currentTab);
        runInAction(() => {
            this.siteIsBlacklisted = true;
        });
    }

    /**
     * Enables injections for the current site.
     */
    enableInjectionsForSite = async (): Promise<void> => {
        const currentTab = await tabs.getCurrentTab();
        await messenger.enableInjectionsForSite(currentTab);
        runInAction(() => {
            this.siteIsBlacklisted = false;
        });
    }

    /**
     * Toggles a single file of a matching rule and reloads the current tab.
     *
     * @param id Identifier of the rule.
     * @param field Path field whose file is toggled.
     */
    toggleInjectionFile = async (id: string, field: InjectionFileField): Promise<void> => {
        const injection = this.matchingInjections.find((item) => item.id === id);
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }

        try {
            const updated = await messenger.setInjectionFileEnabled(
                id,
                field,
                !injection[FILE_ENABLED_FLAGS[field]],
            );
            if (!updated) {
                return;
            }
            runInAction(() => {
                this.matchingInjections = this.matchingInjections
                    .map((item) => (item.id === id ? updated : item));
            });
            await tabs.reloadTab(this.currentTab.id);
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
    }

    /**
     * Opens the options page with the rule editor prefilled for this site.
     *
     * Falls back to plainly opening the options page for tabs without
     * a usable hostname.
     */
    openOptionsForCurrentSite = async (): Promise<void> => {
        const site = urlUtils.getHostnameWithoutWww(this.currentTab.url);
        if (!site) {
            await messenger.openSettings();
            return;
        }

        await messenger.openTab(tabs.getOptionsUrlForSite(site));
    }
}

/**
 * @file
 */

import {
    computed,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';

import type { PopupTab } from '../../common/contracts';
import { messenger } from '../../common/messenger';
import { SETTINGS } from '../../common/constants';
import { log } from '../../common/log';
import { tabs } from '../../common/tabs';
import { urlUtils } from '../../common/url-utils';
import type { RootStoreType } from './RootStore';

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
        const {
            settings,
            siteHasEnabledInjections,
            siteIsBlacklisted,
        } = await messenger.getPopupData(currentTab);

        runInAction(() => {
            this.appEnabled = settings[SETTINGS.APP_ENABLED];
            this.currentTab = currentTab;
            this.siteHasEnabledInjections = siteHasEnabledInjections;
            this.siteIsBlacklisted = siteIsBlacklisted;
            this.popupDataReady = true;
        });
    }

    /**
     * Disables the extension globally.
     */
    disableApp = async (): Promise<void> => {
        try {
            await messenger.disableApp();
            runInAction(() => {
                this.appEnabled = false;
            });
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

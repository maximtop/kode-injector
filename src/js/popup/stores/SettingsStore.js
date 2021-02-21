import {
    computed,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';
import browser from 'webextension-polyfill';

import { messenger } from '../../common/messenger';
import { SETTINGS } from '../../common/constants';
import { log } from '../../common/log';
import { tabs } from '../../common/tabs';

export class SettingsStore {
    constructor(rootStore) {
        makeObservable(this);
        this.rootStore = rootStore;
    }

    @observable
    appEnabled = true;

    @observable
    popupDataReady = false;

    @observable
    currentTab = {};

    @observable
    siteHasEnabledInjections = false;

    @observable
    siteIsBlacklisted = false;

    getPopupData = async () => {
        const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true });
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

    disableApp = async () => {
        try {
            await messenger.disableApp();
            runInAction(() => {
                this.appEnabled = false;
            });
        } catch (e) {
            log.error(e.message);
        }
    }

    enableApp = async () => {
        try {
            await messenger.enableApp();
            runInAction(() => {
                this.appEnabled = true;
            });
        } catch (e) {
            log.error(e.message);
        }
    }

    @computed
    get currentTabHostname() {
        if (!this.currentTab) {
            return '';
        }

        const urlObj = new URL(this.currentTab.url);
        return urlObj.hostname;
    }

    disableInjectionsForSite = async () => {
        const currentTab = await tabs.getCurrentTab();
        return messenger.disableInjectionsForSite(currentTab.url);
    }

    enableInjectionsForSite = async () => {
        const currentTab = await tabs.getCurrentTab();
        return messenger.enableInjectionsForSite(currentTab.url);
    }
}

import browser from 'webextension-polyfill';

import { MESSAGE_TYPES } from '../common/constants';
import { injections } from './injections';
import { settings } from './settings';
import { tabs } from '../common/tabs';
import { app } from './app';

class MessageHandler {
    // eslint-disable-next-line consistent-return
    messageHandler = async (message, sender) => {
        const { type, data } = message;

        switch (type) {
            case MESSAGE_TYPES.GET_OPTIONS_DATA: {
                const injectionsData = injections.getInjections();
                return { injections: injectionsData };
            }
            case MESSAGE_TYPES.ADD_INJECTION: {
                const { injectionData } = data;
                return injections.addInjection(injectionData);
            }
            case MESSAGE_TYPES.REMOVE_INJECTION: {
                const { id } = data;
                return injections.removeInjection(id);
            }
            case MESSAGE_TYPES.ENABLE_INJECTION: {
                return injections.enableInjection(data.id);
            }
            case MESSAGE_TYPES.DISABLE_INJECTION: {
                return injections.disableInjection(data.id);
            }
            case MESSAGE_TYPES.GET_POPUP_DATA: {
                const { tab } = data;
                return {
                    settings: settings.getSettings(),
                    siteHasEnabledInjections: injections.hasSiteEnabledInjections(tab.url),
                    siteIsBlacklisted: injections.isSiteBlacklisted(tab.url),
                };
            }
            case MESSAGE_TYPES.DISABLE_APP: {
                return app.disable();
            }
            case MESSAGE_TYPES.ENABLE_APP: {
                return app.enable();
            }
            case MESSAGE_TYPES.OPEN_SETTINGS: {
                return tabs.openSettings();
            }
            case MESSAGE_TYPES.GET_INJECTIONS_CODE: {
                injections.injectJs(sender.url, sender.tab.id);
                return injections.getCssInjection(sender.url, sender.tab.id);
            }
            case MESSAGE_TYPES.ENABLE_INJECTIONS_FOR_SITE: {
                const { tab } = data;
                injections.enableInjectionsForSite(tab.url);
                await tabs.reloadTab(tab.id);
                break;
            }
            case MESSAGE_TYPES.DISABLE_INJECTIONS_FOR_SITE: {
                const { tab } = data;
                injections.disableInjectionsForSite(tab.url);
                await tabs.reloadTab(tab.id);
                break;
            }
            case MESSAGE_TYPES.OPEN_TAB: {
                return tabs.openTab(data.url);
            }
            default: {
                throw new Error(`Unknown message type ${type}`);
            }
        }
    }

    init = () => {
        browser.runtime.onMessage.addListener(this.messageHandler);
    };
}

export const messageHandler = new MessageHandler();

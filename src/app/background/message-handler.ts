/**
 * @file
 */

import browser from 'webextension-polyfill';

import type {
    InjectionRule,
    InjectionsCodeResponse,
    OptionsDataResponse,
    PopupDataResponse,
    RuntimeMessage,
} from '../common/contracts';
import { MESSAGE_TYPES } from '../common/constants';
import { toLocalePreference, type LocalePreference } from '../common/locale';
import { browserLanguageChannel } from '../common/browser-language-channel';
import { log } from '../common/log';
import { injections } from './injections';
import { settings } from './settings';
import { tabs } from '../common/tabs';
import { app } from './app';
import { gateMessageHandler } from './message-readiness';

/**
 * Values returned by background runtime message handlers.
 */
type MessageResponse =
    | OptionsDataResponse
    | InjectionRule
    | PopupDataResponse
    | InjectionsCodeResponse
    | browser.Tabs.Tab
    | LocalePreference
    | null
    | void;

/**
 * Routes runtime messages to background services.
 */
class MessageHandler {
    /**
     * Handles a runtime message and returns its response.
     */
    messageHandler = async (
        message: RuntimeMessage,
        sender: browser.Runtime.MessageSender,
    ): Promise<MessageResponse> => {
        const { type, data } = message;

        switch (type) {
            case MESSAGE_TYPES.GET_OPTIONS_DATA: {
                const injectionsData = injections.getInjections();
                return {
                    injections: injectionsData,
                    selectedLanguage: settings.getSelectedLanguage(),
                };
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
                const tabUrl = tab.url || '';
                const popupData: PopupDataResponse = {
                    settings: settings.getSettings(),
                    siteHasEnabledInjections: injections.hasSiteEnabledInjections(tabUrl),
                    siteIsBlacklisted: injections.isSiteBlacklisted(tabUrl),
                };
                return popupData;
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
                const senderUrl = sender.url || '';
                const senderTabId = sender.tab?.id;
                injections.injectJs(senderUrl, senderTabId);
                return injections.getCssInjection(senderUrl);
            }
            case MESSAGE_TYPES.ENABLE_INJECTIONS_FOR_SITE: {
                const { tab } = data;
                injections.enableInjectionsForSite(tab.url || '');
                await tabs.reloadTab(tab.id);
                break;
            }
            case MESSAGE_TYPES.DISABLE_INJECTIONS_FOR_SITE: {
                const { tab } = data;
                injections.disableInjectionsForSite(tab.url || '');
                await tabs.reloadTab(tab.id);
                break;
            }
            case MESSAGE_TYPES.OPEN_TAB: {
                return tabs.openTab(data.url);
            }
            case MESSAGE_TYPES.SET_INTERFACE_LANGUAGE: {
                const language = toLocalePreference(data.language);
                await settings.setSelectedLanguage(language);
                browserLanguageChannel.publish(language).catch((error) => {
                    log.error('Failed to broadcast language change', error);
                });
                return language;
            }
            case MESSAGE_TYPES.LANGUAGE_CHANGED:
                // The broadcast targets UI contexts, but the background receives it too.
                // No background state change or response is required.
                return undefined;
            default: {
                const unknownMessage = message as { type: string };
                throw new Error(`Unknown message type ${unknownMessage.type}`);
            }
        }

        return undefined;
    }

    /**
     * Registers the runtime message listener.
     *
     * @param backgroundReady Shared background initialization promise.
     */
    init = (backgroundReady: Promise<void>): void => {
        browser.runtime.onMessage.addListener(
            gateMessageHandler(backgroundReady, this.messageHandler),
        );
    };
}

export const messageHandler = new MessageHandler();

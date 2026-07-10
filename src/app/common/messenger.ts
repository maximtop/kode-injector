/**
 * @file
 */

import browser from 'webextension-polyfill';

import type {
    InjectionRule,
    InjectionsCodeResponse,
    NewInjectionData,
    OptionsDataResponse,
    PopupDataResponse,
    PopupTab,
    RuntimeRequest,
} from './contracts';
import { MESSAGE_TYPES } from './constants';

/**
 * Supported runtime message discriminator.
 */
type RuntimeMessageType = RuntimeRequest['type'];

/**
 * Payload associated with a runtime message discriminator.
 */
type RuntimeMessageData<TType extends RuntimeMessageType> =
    Extract<RuntimeRequest, { type: TType }> extends { data: infer TData } ? TData : undefined;

/**
 * Sends typed runtime messages to background services.
 */
class Messenger {
    /**
     * Sends a runtime message and returns its typed response.
     */
    sendMessage = <TResponse, TType extends RuntimeMessageType>(
        type: TType,
        data?: RuntimeMessageData<TType>,
    ): Promise<TResponse> => {
        return browser.runtime.sendMessage({ type, data });
    }

    /**
     * Requests creation of an injection rule.
     */
    addInjection = (injectionData: NewInjectionData): Promise<InjectionRule | null> => {
        return this.sendMessage(MESSAGE_TYPES.ADD_INJECTION, { injectionData });
    }

    /**
     * Requests removal of an injection rule.
     */
    removeInjection = (id: string): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.REMOVE_INJECTION, { id });
    }

    /**
     * Requests enabling an injection rule.
     */
    enableInjection = (id: string): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.ENABLE_INJECTION, { id });
    }

    /**
     * Requests disabling an injection rule.
     */
    disableInjection = (id: string): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.DISABLE_INJECTION, { id });
    }

    /**
     * Requests data required by the options page.
     */
    getOptionsData = (): Promise<OptionsDataResponse> => {
        return this.sendMessage(MESSAGE_TYPES.GET_OPTIONS_DATA);
    }

    /**
     * Requests the browser-owned local-file permission state.
     */
    getFileAccessStatus = (): Promise<boolean> => {
        return this.sendMessage(MESSAGE_TYPES.GET_FILE_ACCESS_STATUS);
    }

    /**
     * Requests data required by the popup.
     */
    getPopupData = (tab: PopupTab): Promise<PopupDataResponse> => {
        return this.sendMessage(MESSAGE_TYPES.GET_POPUP_DATA, { tab });
    }

    /**
     * Requests disabling the extension globally.
     */
    disableApp = (): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.DISABLE_APP);
    }

    /**
     * Requests enabling the extension globally.
     */
    enableApp = (): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.ENABLE_APP);
    }

    /**
     * Requests opening the extension settings page.
     */
    openSettings = (): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.OPEN_SETTINGS);
    }

    /**
     * Requests opening a browser tab.
     */
    openTab = (url: string): Promise<browser.Tabs.Tab> => {
        return this.sendMessage(MESSAGE_TYPES.OPEN_TAB, { url });
    }

    /**
     * Requests injection code for the current page.
     */
    getInjectionsCode = (): Promise<InjectionsCodeResponse> => {
        return this.sendMessage(MESSAGE_TYPES.GET_INJECTIONS_CODE);
    }

    /**
     * Requests disabling injections for a site.
     */
    disableInjectionsForSite = (tab: PopupTab): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.DISABLE_INJECTIONS_FOR_SITE, { tab });
    };

    /**
     * Requests enabling injections for a site.
     */
    enableInjectionsForSite = (tab: PopupTab): Promise<void> => {
        return this.sendMessage(MESSAGE_TYPES.ENABLE_INJECTIONS_FOR_SITE, { tab });
    };

    /**
     * Requests a saved interface language change.
     *
     * @param language New language preference.
     *
     * @returns Normalized persisted preference.
     */
    setInterfaceLanguage = (language: import('./locale').LocalePreference): Promise<import('./locale').LocalePreference> => {
        return this.sendMessage(MESSAGE_TYPES.SET_INTERFACE_LANGUAGE, { language });
    };
}

export const messenger = new Messenger();

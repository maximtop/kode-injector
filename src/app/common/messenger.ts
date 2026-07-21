/**
 * @file
 */

import browser from 'webextension-polyfill';

import type {
    InjectionFileField,
    InjectionFileIssues,
    InjectionRule,
    InjectionsCodeResponse,
    LocalSourceAccessMethod,
    LocalSourceAccessState,
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
     *
     * @param injectionData Injection rule data.
     * @param enabled Initial enabled state of the created rule.
     *
     * @returns The created rule, or null when the data is invalid.
     */
    addInjection = (
        injectionData: NewInjectionData,
        enabled?: boolean,
    ): Promise<InjectionRule | null> => {
        return this.sendMessage(MESSAGE_TYPES.ADD_INJECTION, { injectionData, enabled });
    }

    /**
     * Requests an update of an existing injection rule.
     *
     * @param id Identifier of the rule to update.
     * @param injectionData Replacement rule data.
     *
     * @returns The updated rule, or null when the rule or data is invalid.
     */
    updateInjection = (
        id: string,
        injectionData: NewInjectionData,
    ): Promise<InjectionRule | null> => {
        return this.sendMessage(MESSAGE_TYPES.UPDATE_INJECTION, { id, injectionData });
    }

    /**
     * Requests a readability probe of every configured source file.
     *
     * @returns Unreadable path fields keyed by rule identifier.
     */
    getInjectionFileIssues = (): Promise<InjectionFileIssues> => {
        return this.sendMessage(MESSAGE_TYPES.GET_INJECTION_FILE_ISSUES);
    }

    /**
     * Requests enabling or disabling one source file of a rule.
     *
     * @param id Identifier of the rule.
     * @param field Path field whose file is toggled.
     * @param enabled New enabled state of the file.
     *
     * @returns The updated rule, or null when the rule or file is missing.
     */
    setInjectionFileEnabled = (
        id: string,
        field: InjectionFileField,
        enabled: boolean,
    ): Promise<InjectionRule | null> => {
        return this.sendMessage(
            MESSAGE_TYPES.SET_INJECTION_FILE_ENABLED,
            { id, field, enabled },
        );
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
    getLocalSourceAccessStatus = (): Promise<LocalSourceAccessState> => {
        return this.sendMessage(MESSAGE_TYPES.GET_LOCAL_SOURCE_ACCESS_STATUS);
    }

    /**
     * Persists the selected local-source method and returns its fresh status.
     */
    setLocalSourceAccessMethod = (
        method: LocalSourceAccessMethod,
    ): Promise<LocalSourceAccessMethod> => {
        return this.sendMessage(MESSAGE_TYPES.SET_LOCAL_SOURCE_ACCESS_METHOD, { method });
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

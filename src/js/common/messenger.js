import browser from 'webextension-polyfill';

import { MESSAGE_TYPES } from './constants';

class Messenger {
    sendMessage = (type, data) => {
        const message = { type };

        if (data) {
            message.data = data;
        }

        return browser.runtime.sendMessage({ type, data });
    }

    addInjection = (injectionData) => {
        return this.sendMessage(MESSAGE_TYPES.ADD_INJECTION, { injectionData });
    }

    removeInjection = (id) => {
        return this.sendMessage(MESSAGE_TYPES.REMOVE_INJECTION, { id });
    }

    enableInjection = (id) => {
        return this.sendMessage(MESSAGE_TYPES.ENABLE_INJECTION, { id });
    }

    disableInjection = (id) => {
        return this.sendMessage(MESSAGE_TYPES.DISABLE_INJECTION, { id });
    }

    getOptionsData = () => {
        return this.sendMessage(MESSAGE_TYPES.GET_OPTIONS_DATA);
    }

    getPopupData = (tab) => {
        return this.sendMessage(MESSAGE_TYPES.GET_POPUP_DATA, { tab });
    }

    disableApp = () => {
        return this.sendMessage(MESSAGE_TYPES.DISABLE_APP);
    }

    enableApp = () => {
        return this.sendMessage(MESSAGE_TYPES.ENABLE_APP);
    }

    openSettings = () => {
        return this.sendMessage(MESSAGE_TYPES.OPEN_SETTINGS);
    }

    openTab = (url) => {
        return this.sendMessage(MESSAGE_TYPES.OPEN_TAB, { url });
    }

    getInjectionsCode = () => {
        return this.sendMessage(MESSAGE_TYPES.GET_INJECTIONS_CODE);
    }

    disableInjectionsForSite = (url) => {
        return this.sendMessage(MESSAGE_TYPES.DISABLE_INJECTIONS_FOR_SITE, { url });
    };

    enableInjectionsForSite = (url) => {
        return this.sendMessage(MESSAGE_TYPES.ENABLE_INJECTIONS_FOR_SITE, { url });
    };
}

export const messenger = new Messenger();

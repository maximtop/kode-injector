/**
 * @file
 */

import { MESSAGE_TYPES, SETTINGS } from './constants';

/**
 * User-provided values for a new injection rule.
 */
export interface NewInjectionData {
    /**
     * Hostname matched by the injection rule.
     */
    site: string;

    /**
     * Local JavaScript file path.
     */
    jsPath: string;

    /**
     * Local CSS file path.
     */
    cssPath: string;
}

/**
 * Persisted injection rule with runtime state.
 */
export interface InjectionRule extends NewInjectionData {
    /**
     * Unique injection rule identifier.
     */
    id: string;

    /**
     * Whether the injection rule is enabled.
     */
    enabled: boolean;
}

/**
 * Persisted collection of injection rules and blocked sites.
 */
export interface StoredInjectionsState {
    /**
     * Persisted injection rules.
     */
    injections: InjectionRule[];

    /**
     * Hostnames where injections are disabled.
     */
    blocklist: string[];
}

/**
 * Injection data returned to the options page.
 */
export type OptionsDataResponse = {
    /**
     * Configured injection rules.
     */
    injections: InjectionRule[];
};

/**
 * Persisted global application settings.
 */
export type AppSettings = {
    /**
     * Whether the extension is globally enabled.
     */
    [SETTINGS.APP_ENABLED]: boolean;
};

/**
 * Browser tab data required by popup actions.
 */
export interface PopupTab {
    /**
     * Browser tab identifier.
     */
    id?: number;

    /**
     * Browser tab URL.
     */
    url?: string;
}

/**
 * Extension state returned to the popup.
 */
export type PopupDataResponse = {
    /**
     * Current global application settings.
     */
    settings: AppSettings;

    /**
     * Whether the current site has enabled injection rules.
     */
    siteHasEnabledInjections: boolean;

    /**
     * Whether injections are disabled for the current site.
     */
    siteIsBlacklisted: boolean;
};

/**
 * CSS source prepared for content-script injection.
 */
export type CssInjectionCode = {
    /**
     * CSS filename and source content.
     */
    css: {
        filename: string;
        code: string;
    };
};

/**
 * Injection code returned for the current page.
 */
export type InjectionsCodeResponse = CssInjectionCode[] | null;

/**
 * Data required to execute JavaScript in a browser tab.
 */
export type ExecuteScriptPayload = {
    /**
     * JavaScript source to execute.
     */
    script: string;

    /**
     * Target browser tab identifier.
     */
    tabId?: number;

    /**
     * Source filename used for diagnostic logging.
     */
    filePath: string;
};

/**
 * Runtime messages exchanged with the background service worker.
 */
export type RuntimeMessage =
    | { type: typeof MESSAGE_TYPES.GET_OPTIONS_DATA; data?: undefined }
    | { type: typeof MESSAGE_TYPES.ADD_INJECTION; data: { injectionData: NewInjectionData } }
    | { type: typeof MESSAGE_TYPES.REMOVE_INJECTION; data: { id: string } }
    | { type: typeof MESSAGE_TYPES.ENABLE_INJECTION; data: { id: string } }
    | { type: typeof MESSAGE_TYPES.DISABLE_INJECTION; data: { id: string } }
    | { type: typeof MESSAGE_TYPES.GET_POPUP_DATA; data: { tab: PopupTab } }
    | { type: typeof MESSAGE_TYPES.DISABLE_APP; data?: undefined }
    | { type: typeof MESSAGE_TYPES.ENABLE_APP; data?: undefined }
    | { type: typeof MESSAGE_TYPES.OPEN_SETTINGS; data?: undefined }
    | { type: typeof MESSAGE_TYPES.GET_INJECTIONS_CODE; data?: undefined }
    | { type: typeof MESSAGE_TYPES.OPEN_TAB; data: { url: string } }
    | {
        type: typeof MESSAGE_TYPES.DISABLE_INJECTIONS_FOR_SITE;
        data: { tab: PopupTab };
    }
    | {
        type: typeof MESSAGE_TYPES.ENABLE_INJECTIONS_FOR_SITE;
        data: { tab: PopupTab };
    };

/**
 * Checks whether a value is a non-null object.
 *
 * @param value Value to validate.
 *
 * @returns Whether the value is an object record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object';
};

/**
 * Checks whether a value is a valid injection rule.
 *
 * @param value Value to validate.
 *
 * @returns Whether the value is an injection rule.
 */
export const isInjectionRule = (value: unknown): value is InjectionRule => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.site === 'string'
        && typeof value.jsPath === 'string'
        && typeof value.cssPath === 'string'
        && typeof value.enabled === 'boolean';
};

/**
 * Normalizes persisted application settings.
 *
 * @param value Persisted settings value.
 *
 * @returns Valid application settings with defaults applied.
 */
export const normalizeAppSettings = (value: unknown): AppSettings => {
    const defaultSettings = { [SETTINGS.APP_ENABLED]: true };
    if (!isRecord(value)) {
        return defaultSettings;
    }
    const appEnabled = value[SETTINGS.APP_ENABLED];

    return {
        [SETTINGS.APP_ENABLED]: typeof appEnabled === 'boolean'
            ? appEnabled
            : defaultSettings[SETTINGS.APP_ENABLED],
    };
};

/**
 * Normalizes persisted injection and blocklist data.
 *
 * @param value Persisted injections state.
 *
 * @returns Valid stored state with invalid entries removed.
 */
export const normalizeStoredInjectionsState = (value: unknown): StoredInjectionsState => {
    if (!isRecord(value)) {
        return { injections: [], blocklist: [] };
    }

    return {
        injections: Array.isArray(value.injections)
            ? value.injections.filter(isInjectionRule)
            : [],
        blocklist: Array.isArray(value.blocklist)
            ? value.blocklist.filter((item): item is string => typeof item === 'string')
            : [],
    };
};

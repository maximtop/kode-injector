/**
 * @file
 */

/* eslint-disable jsdoc/require-jsdoc, jsdoc/multiline-blocks */

import {
    boolean,
    fallback,
    object,
    parse,
    safeParse,
    strictObject,
    type InferOutput,
} from 'valibot';

import { InjectionField, MESSAGE_TYPES, SETTINGS } from './constants';
import {
    localePreferenceSchema,
    localePreferenceValueSchema,
    type LocalePreference,
} from './locale';
import type { LanguageChangedMessage } from './language-channel';
import { NativeHostStatus, type NativeErrorCode } from './native-host-protocol';

export enum LocalSourceAccessKind {
    NativeHost = 'nativeHost',
}

export interface NativeHostState {
    status: NativeHostStatus;
    hostVersion?: string;
    errorCode?: NativeErrorCode;
}

export interface LocalSourceAccessState {
    kind: LocalSourceAccessKind.NativeHost;
    host: NativeHostState;
}

/**
 * User-provided values for a new injection rule.
 */
export interface NewInjectionData {
    /**
     * Hostname matched by the injection rule.
     */
    [InjectionField.Site]: string;

    /**
     * Local JavaScript file path.
     */
    [InjectionField.JsPath]: string;

    /**
     * Local CSS file path.
     */
    [InjectionField.CssPath]: string;
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

    /** Native-host state for local source reads. */
    localSourceAccess: LocalSourceAccessState;

    /**
     * Persisted interface language preference.
     */
    selectedLanguage: LocalePreference;
};

/**
 * Strict schema for persisted global application settings.
 */
export const appSettingsSchema = strictObject({
    [SETTINGS.APP_ENABLED]: boolean(),
    [SETTINGS.SELECTED_LANGUAGE]: localePreferenceValueSchema,
});

/**
 * Persisted global application settings.
 */
export type AppSettings = InferOutput<typeof appSettingsSchema>;

/**
 * Default application settings used during field-level recovery.
 */
const DEFAULT_APP_SETTINGS: AppSettings = {
    [SETTINGS.APP_ENABLED]: true,
    [SETTINGS.SELECTED_LANGUAGE]: 'auto',
};

/**
 * Schema that normalizes invalid settings fields independently.
 */
const normalizedAppSettingsSchema = fallback(
    object({
        [SETTINGS.APP_ENABLED]: fallback(boolean(), true),
        [SETTINGS.SELECTED_LANGUAGE]: localePreferenceSchema,
    }),
    () => ({ ...DEFAULT_APP_SETTINGS }),
);

/**
 * Normalized settings and whether persistence needs repair.
 */
export type AppSettingsNormalization = {
    /**
     * Valid settings with field-level fallbacks applied.
     */
    settings: AppSettings;

    /**
     * Whether the persisted input failed strict validation.
     */
    shouldRepair: boolean;
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
    /** Native-host state for local source reads. */
    localSourceAccess: LocalSourceAccessState;

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
    | { type: typeof MESSAGE_TYPES.GET_LOCAL_SOURCE_ACCESS_STATUS; data?: undefined }
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
    }
    | {
        type: typeof MESSAGE_TYPES.SET_INTERFACE_LANGUAGE;
        data: { language: LocalePreference };
    }
    | LanguageChangedMessage;

/**
 * Runtime messages handled as background requests.
 */
export type RuntimeRequest = Exclude<
    RuntimeMessage,
    LanguageChangedMessage
>;

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
 * @returns Valid settings and whether persisted storage needs repair.
 */
export const normalizeAppSettingsWithRepair = (value: unknown): AppSettingsNormalization => {
    const strictResult = safeParse(appSettingsSchema, value);
    if (strictResult.success) {
        return {
            settings: strictResult.output,
            shouldRepair: false,
        };
    }

    return {
        settings: parse(normalizedAppSettingsSchema, value),
        shouldRepair: true,
    };
};

/**
 * Normalizes persisted application settings.
 *
 * @param value Persisted settings value.
 *
 * @returns Valid application settings with defaults applied.
 */
export const normalizeAppSettings = (value: unknown): AppSettings => {
    return normalizeAppSettingsWithRepair(value).settings;
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

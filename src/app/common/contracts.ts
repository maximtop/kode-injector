/**
 * @file
 */

/* eslint-disable jsdoc/require-jsdoc, jsdoc/multiline-blocks */

import {
    boolean,
    fallback,
    object,
    parse,
    picklist,
    safeParse,
    strictObject,
    type InferOutput,
} from 'valibot';

import { BrowserTarget } from './browser-target';
import { InjectionField, MESSAGE_TYPES, SETTINGS } from './constants';
import {
    localePreferenceSchema,
    localePreferenceValueSchema,
    type LocalePreference,
} from './locale';
import type { LanguageChangedMessage } from './language-channel';
import { NativeHostStatus, type NativeErrorCode } from './native-host-protocol';

/**
 * User-selected method for reading local injection sources.
 */
export enum LocalSourceAccessMethod {
    Browser = 'browser',
    NativeHost = 'nativeHost',
}

export interface NativeHostState {
    status: NativeHostStatus;
    hostVersion?: string;
    errorCode?: NativeErrorCode;
}

/**
 * Browser-owned file URL permission state.
 */
export interface BrowserFileAccessState {
    kind: LocalSourceAccessMethod.Browser;
    allowed: boolean;
}

/**
 * Native-host readiness state.
 */
export interface NativeHostAccessState {
    kind: LocalSourceAccessMethod.NativeHost;
    permissionGranted: boolean;
    host: NativeHostState;
}

/**
 * Readiness of the active local-source access method.
 */
export type LocalSourceAccessState = BrowserFileAccessState | NativeHostAccessState;

/**
 * User-provided values for a new injection rule.
 */
export interface NewInjectionData {
    /**
     * Hostname matched by the injection rule.
     */
    [InjectionField.Site]: string;

    /**
     * Local JavaScript file path. Empty string when the rule has no JS source.
     */
    [InjectionField.JsPath]: string;

    /**
     * Local CSS file path. Empty string when the rule has no CSS source.
     */
    [InjectionField.CssPath]: string;
}

/**
 * Checks whether injection data references at least one source file.
 *
 * @param data Injection paths to inspect.
 *
 * @returns Whether a JS or CSS source is present.
 */
export const hasInjectionSource = (
    data: Pick<NewInjectionData, InjectionField.JsPath | InjectionField.CssPath>,
): boolean => {
    return Boolean(data[InjectionField.JsPath] || data[InjectionField.CssPath]);
};

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

    /**
     * Whether the JS source runs while the rule is enabled.
     */
    [InjectionField.JsEnabled]: boolean;

    /**
     * Whether the CSS source applies while the rule is enabled.
     */
    [InjectionField.CssEnabled]: boolean;
}

/**
 * Injection rule as it may exist in storage: per-file flags are optional
 * because rules saved before per-file toggles existed lack them.
 */
export type StoredInjectionRule =
    Omit<InjectionRule, InjectionField.JsEnabled | InjectionField.CssEnabled>
    & Partial<Pick<InjectionRule, InjectionField.JsEnabled | InjectionField.CssEnabled>>;

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
 * Path fields that reference a source file inside a rule.
 */
export type InjectionFileField = InjectionField.JsPath | InjectionField.CssPath;

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

    /** Selected method, independent of an asynchronous readiness probe. */
    localSourceAccessMethod: LocalSourceAccessMethod;

    /**
     * Persisted interface language preference.
     */
    selectedLanguage: LocalePreference;

    /**
     * Whether injections are enabled globally.
     */
    appEnabled: boolean;
};

/**
 * Strict schema for persisted global application settings.
 */
export const appSettingsSchema = strictObject({
    [SETTINGS.APP_ENABLED]: boolean(),
    [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: picklist([
        LocalSourceAccessMethod.Browser,
        LocalSourceAccessMethod.NativeHost,
    ]),
    [SETTINGS.SELECTED_LANGUAGE]: localePreferenceValueSchema,
});

/**
 * Persisted global application settings.
 */
export type AppSettings = InferOutput<typeof appSettingsSchema>;

/**
 * Default application settings used during field-level recovery.
 */
export const getDefaultLocalSourceAccessMethod = (
    browserTarget: BrowserTarget,
): LocalSourceAccessMethod => {
    return browserTarget === BrowserTarget.Firefox
        ? LocalSourceAccessMethod.NativeHost
        : LocalSourceAccessMethod.Browser;
};

/**
 * Applies browser capabilities to a requested local-source access method.
 *
 * @param method Requested access method.
 * @param browserTarget Browser hosting the extension.
 *
 * @returns Access method supported by the target browser.
 */
export const getSupportedLocalSourceAccessMethod = (
    method: LocalSourceAccessMethod,
    browserTarget: BrowserTarget,
): LocalSourceAccessMethod => {
    return browserTarget === BrowserTarget.Firefox
        ? LocalSourceAccessMethod.NativeHost
        : method;
};

/**
 * Creates default application settings for a browser target.
 *
 * @param browserTarget Browser hosting the extension.
 *
 * @returns Target-aware default settings.
 */
const getDefaultAppSettings = (browserTarget: BrowserTarget): AppSettings => {
    return {
        [SETTINGS.APP_ENABLED]: true,
        [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: getDefaultLocalSourceAccessMethod(browserTarget),
        [SETTINGS.SELECTED_LANGUAGE]: 'auto',
    };
};

/**
 * Schema that normalizes invalid settings fields independently.
 */
const getNormalizedAppSettingsSchema = (browserTarget: BrowserTarget) => {
    const defaultSettings = getDefaultAppSettings(browserTarget);

    return fallback(
        object({
            [SETTINGS.APP_ENABLED]: fallback(boolean(), true),
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: fallback(
                picklist([
                    LocalSourceAccessMethod.Browser,
                    LocalSourceAccessMethod.NativeHost,
                ]),
                defaultSettings[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD],
            ),
            [SETTINGS.SELECTED_LANGUAGE]: localePreferenceSchema,
        }),
        () => ({ ...defaultSettings }),
    );
};

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
     * Injection rules matching the current site, regardless of their state.
     */
    matchingInjections: InjectionRule[];

    /**
     * Whether injections are disabled for the current site.
     */
    siteIsBlacklisted: boolean;
};

/**
 * Source paths that could not be read, keyed by rule identifier.
 */
export type InjectionFileIssues = Record<
    string,
    (InjectionField.JsPath | InjectionField.CssPath)[]
>;

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
    | {
        type: typeof MESSAGE_TYPES.SET_LOCAL_SOURCE_ACCESS_METHOD;
        data: { method: LocalSourceAccessMethod };
    }
    | {
        type: typeof MESSAGE_TYPES.ADD_INJECTION;
        data: { injectionData: NewInjectionData; enabled?: boolean };
    }
    | {
        type: typeof MESSAGE_TYPES.UPDATE_INJECTION;
        data: { id: string; injectionData: NewInjectionData };
    }
    | {
        type: typeof MESSAGE_TYPES.SET_INJECTION_FILE_ENABLED;
        data: { id: string; field: InjectionFileField; enabled: boolean };
    }
    | { type: typeof MESSAGE_TYPES.REMOVE_INJECTION; data: { id: string } }
    | { type: typeof MESSAGE_TYPES.GET_INJECTION_FILE_ISSUES; data?: undefined }
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
export const isInjectionRule = (value: unknown): value is StoredInjectionRule => {
    if (!isRecord(value)) {
        return false;
    }

    const isOptionalBoolean = (flag: unknown): boolean => (
        flag === undefined || typeof flag === 'boolean'
    );

    return typeof value.id === 'string'
        && typeof value.site === 'string'
        && typeof value.jsPath === 'string'
        && typeof value.cssPath === 'string'
        && typeof value.enabled === 'boolean'
        && isOptionalBoolean(value[InjectionField.JsEnabled])
        && isOptionalBoolean(value[InjectionField.CssEnabled]);
};

/**
 * Fills in default per-file flags for a stored rule.
 *
 * Rules saved before per-file toggles existed lack the flags; they default
 * to enabled, matching the whole-rule behavior they had.
 *
 * @param rule Stored rule, possibly without per-file flags.
 *
 * @returns Rule with both per-file flags present.
 */
export const normalizeInjectionRule = (rule: StoredInjectionRule): InjectionRule => {
    return {
        ...rule,
        [InjectionField.JsEnabled]: rule[InjectionField.JsEnabled] ?? true,
        [InjectionField.CssEnabled]: rule[InjectionField.CssEnabled] ?? true,
    };
};

/**
 * Normalizes persisted application settings.
 *
 * @param value Persisted settings value.
 *
 * @returns Valid settings and whether persisted storage needs repair.
 */
export const normalizeAppSettingsWithRepair = (
    value: unknown,
    browserTarget: BrowserTarget = BrowserTarget.Chrome,
): AppSettingsNormalization => {
    const strictResult = safeParse(appSettingsSchema, value);
    if (strictResult.success) {
        const supportedMethod = getSupportedLocalSourceAccessMethod(
            strictResult.output[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD],
            browserTarget,
        );

        return {
            settings: {
                ...strictResult.output,
                [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: supportedMethod,
            },
            shouldRepair: supportedMethod
                !== strictResult.output[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD],
        };
    }

    const normalizedSettings = parse(getNormalizedAppSettingsSchema(browserTarget), value);

    return {
        settings: {
            ...normalizedSettings,
            [SETTINGS.LOCAL_SOURCE_ACCESS_METHOD]: getSupportedLocalSourceAccessMethod(
                normalizedSettings[SETTINGS.LOCAL_SOURCE_ACCESS_METHOD],
                browserTarget,
            ),
        },
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
export const normalizeAppSettings = (
    value: unknown,
    browserTarget: BrowserTarget = BrowserTarget.Chrome,
): AppSettings => {
    return normalizeAppSettingsWithRepair(value, browserTarget).settings;
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
            ? value.injections.filter(isInjectionRule).map(normalizeInjectionRule)
            : [],
        blocklist: Array.isArray(value.blocklist)
            ? value.blocklist.filter((item): item is string => typeof item === 'string')
            : [],
    };
};

/**
 * @file
 */

export const MESSAGE_TYPES = {
    ADD_INJECTION: 'add.injection',
    REMOVE_INJECTION: 'remove.injection',
    UPDATE_INJECTION: 'update.injection',
    SET_INJECTION_FILE_ENABLED: 'set.injection.file.enabled',
    GET_INJECTION_FILE_ISSUES: 'get.injection.file.issues',
    ENABLE_INJECTION: 'enable.injection',
    DISABLE_INJECTION: 'disable.injection',
    GET_OPTIONS_DATA: 'get.options.data',
    GET_POPUP_DATA: 'get.popup.data',
    GET_LOCAL_SOURCE_ACCESS_STATUS: 'get.local.source.access.status',
    SET_LOCAL_SOURCE_ACCESS_METHOD: 'set.local.source.access.method',
    DISABLE_APP: 'disable.app',
    ENABLE_APP: 'enable.app',
    OPEN_SETTINGS: 'open.settings',
    GET_INJECTIONS_CODE: 'get.injections.code',
    OPEN_TAB: 'open.tab',
    DISABLE_INJECTIONS_FOR_SITE: 'disable.injections.for.site',
    ENABLE_INJECTIONS_FOR_SITE: 'enable.injections.for.site',
    SET_INTERFACE_LANGUAGE: 'set.interface.language',
    LANGUAGE_CHANGED: 'language.changed',
} as const;

export const PROJECT_REPOSITORY_URL = 'https://github.com/maximtop/kode-injector';

export const PROJECT_NEW_ISSUE_URL = `${PROJECT_REPOSITORY_URL}/issues/new`;

export const NATIVE_HOST_RELEASES_URL = `${PROJECT_REPOSITORY_URL}/releases`;

export const NATIVE_HOST_ALL_DOWNLOADS_URL = NATIVE_HOST_RELEASES_URL;

/**
 * Browser permissions requested or emitted by the extension.
 */
export enum BrowserPermission {
    NativeMessaging = 'nativeMessaging',
}

export const STORAGE_KEYS = {
    SETTINGS: 'settings',
    INJECTIONS: 'injections',
} as const;

export const SETTINGS = {
    APP_ENABLED: 'app.enabled',
    LOCAL_SOURCE_ACCESS_METHOD: 'localSourceAccess.method',
    SELECTED_LANGUAGE: 'language.selected',
} as const;

/**
 * Field names shared by injection forms, tables, and contracts.
 */
export enum InjectionField {
    Site = 'site',
    JsPath = 'jsPath',
    CssPath = 'cssPath',
    JsEnabled = 'jsEnabled',
    CssEnabled = 'cssEnabled',
}

/**
 * Path of the options page inside the extension bundle.
 */
export const OPTIONS_PAGE_PATH = 'options.html';

/**
 * Query parameters recognized by the options page.
 */
export const OPTIONS_QUERY_PARAMS = {
    PREFILL_SITE: 'site',
    TAB: 'tab',
} as const;

/**
 * Identifiers of the options page tabs, also used as deep-link values.
 */
export const OPTIONS_TABS = {
    INJECTIONS: 'injections',
    SETTINGS: 'settings',
} as const;

/**
 * The localStorage key persisting the selected color scheme.
 *
 * Extension pages share one origin, so the popup and the options page
 * read the same value and stay in sync through storage events.
 */
export const COLOR_SCHEME_STORAGE_KEY = 'kode-injector-color-scheme';

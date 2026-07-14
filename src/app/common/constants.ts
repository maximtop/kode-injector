/**
 * @file
 */

export const MESSAGE_TYPES = {
    ADD_INJECTION: 'add.injection',
    REMOVE_INJECTION: 'remove.injection',
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
    DISABLE_INJECTIONS_FOR_SITE: 'enable.injection.for.site',
    ENABLE_INJECTIONS_FOR_SITE: 'disable.injection.for.site',
    SET_INTERFACE_LANGUAGE: 'set.interface.language',
    LANGUAGE_CHANGED: 'language.changed',
} as const;

export const PROJECT_REPOSITORY_URL = 'https://github.com/maximtop/kode-injector';

export const PROJECT_NEW_ISSUE_URL = `${PROJECT_REPOSITORY_URL}/issues/new`;

export const NATIVE_HOST_INSTALLATION_URL = `${PROJECT_REPOSITORY_URL}/releases`;

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
}

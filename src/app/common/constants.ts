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

export const STORAGE_KEYS = {
    SETTINGS: 'settings',
    INJECTIONS: 'injections',
} as const;

export const SETTINGS = {
    APP_ENABLED: 'app.enabled',
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

/**
 * @file Color scheme persistence shared by the options page and the popup.
 */

import { localStorageColorSchemeManager } from '@mantine/core';

import { COLOR_SCHEME_STORAGE_KEY } from './constants';

/**
 * Color scheme values shared with Mantine.
 *
 * An `as const` object instead of a TS enum: enum member types are not
 * assignable to Mantine's `'light' | 'dark' | 'auto'` literal union.
 */
export const COLOR_SCHEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto',
} as const;

/**
 * Attribute Mantine reads the active scheme from.
 */
const COLOR_SCHEME_ATTRIBUTE = 'data-mantine-color-scheme';

/**
 * Persists the selected scheme in localStorage. Extension pages share one
 * origin, so open pages stay in sync through storage events.
 */
export const colorSchemeManager = localStorageColorSchemeManager({
    key: COLOR_SCHEME_STORAGE_KEY,
});

/**
 * Applies the persisted color scheme to the document before React mounts.
 *
 * MV3 pages forbid inline scripts, so Mantine's ColorSchemeScript pattern
 * cannot run from the HTML template; calling this at the top of the page
 * entry prevents a light-scheme flash instead.
 */
export const applyInitialColorScheme = (): void => {
    let stored: string | null = null;
    try {
        stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    } catch {
        stored = null;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const scheme = stored === COLOR_SCHEMES.LIGHT || stored === COLOR_SCHEMES.DARK
        ? stored
        : (prefersDark && COLOR_SCHEMES.DARK) || COLOR_SCHEMES.LIGHT;

    document.documentElement.setAttribute(COLOR_SCHEME_ATTRIBUTE, scheme);
};

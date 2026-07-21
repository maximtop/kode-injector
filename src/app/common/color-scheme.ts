/**
 * @file Color scheme persistence shared by the options page and the popup.
 */

import { localStorageColorSchemeManager } from '@mantine/core';

import { COLOR_SCHEME_STORAGE_KEY } from './constants';

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
    const scheme = stored === 'light' || stored === 'dark'
        ? stored
        : (prefersDark && 'dark') || 'light';

    document.documentElement.setAttribute('data-mantine-color-scheme', scheme);
};

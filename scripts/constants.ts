/**
 * @file
 */

export const CHANNEL_ENVS = {
    DEV: 'dev',
    RELEASE: 'release',
} as const;

/**
 * Supported extension build environment.
 */
export type BuildEnv = typeof CHANNEL_ENVS[keyof typeof CHANNEL_ENVS];

/**
 * Supported browser build targets.
 */
export const BROWSER_TARGETS = {
    CHROME: 'chrome',
    EDGE: 'edge',
    FIREFOX: 'firefox',
    SAFARI: 'safari',
} as const;

/**
 * Supported browser build target.
 */
export type BrowserTarget = typeof BROWSER_TARGETS[keyof typeof BROWSER_TARGETS];

/**
 * Every browser target accepted by the explicit build CLI.
 */
export const ALL_BROWSER_TARGETS: BrowserTarget[] = [
    BROWSER_TARGETS.CHROME,
    BROWSER_TARGETS.EDGE,
    BROWSER_TARGETS.FIREFOX,
    BROWSER_TARGETS.SAFARI,
];

/**
 * Browser targets that remain part of the default cross-browser build.
 *
 * Safari is intentionally explicit because it also requires a macOS app
 * bundle. Building WebExtension resources alone is not a complete Safari
 * artifact.
 */
export const DEFAULT_BROWSER_TARGETS: BrowserTarget[] = [
    BROWSER_TARGETS.CHROME,
    BROWSER_TARGETS.EDGE,
    BROWSER_TARGETS.FIREFOX,
];

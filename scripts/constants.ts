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
} as const;

/**
 * Supported browser build target.
 */
export type BrowserTarget = typeof BROWSER_TARGETS[keyof typeof BROWSER_TARGETS];

/**
 * Browser targets in the order used by all-browser builds.
 */
export const ALL_BROWSER_TARGETS: BrowserTarget[] = [
    BROWSER_TARGETS.CHROME,
    BROWSER_TARGETS.EDGE,
    BROWSER_TARGETS.FIREFOX,
];

/**
 * @file
 */

export const CHANNEL_ENVS = {
    DEV: 'dev',
    PROD: 'prod',
} as const;

/**
 * Supported extension build environment.
 */
export type BuildEnv = typeof CHANNEL_ENVS[keyof typeof CHANNEL_ENVS];

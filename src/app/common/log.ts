/**
 * @file
 */

/* eslint-disable no-console */

/**
 * Generic logging method signature.
 */
type LogMethod = (...args: unknown[]) => void;

/**
 * Logging methods used by extension modules.
 */
interface Logger {
    /**
     * Writes diagnostic messages.
     */
    debug: LogMethod;

    /**
     * Writes error messages.
     */
    error: LogMethod;
}

export const log: Logger = {
    debug: console.log,
    error: console.error,
};

/**
 * @file Text helpers shared by the options page and the popup.
 */

/**
 * Number of leading characters kept by middle truncation.
 */
const TRUNCATE_HEAD_LENGTH = 16;

/**
 * Characters consumed by the head and the ellipsis together.
 */
const TRUNCATE_RESERVED_LENGTH = 18;

/**
 * Default maximum length of middle-truncated values.
 */
const TRUNCATE_DEFAULT_MAX = 42;

/**
 * Truncates long values in the middle, keeping both ends readable.
 *
 * @param value Value to truncate.
 * @param max Maximum length before truncation applies.
 *
 * @returns The value, middle-truncated when longer than the maximum.
 */
export const truncateMiddle = (value: string, max = TRUNCATE_DEFAULT_MAX): string => {
    if (value.length <= max) {
        return value;
    }

    return `${value.slice(0, TRUNCATE_HEAD_LENGTH)}…${value.slice(-(max - TRUNCATE_RESERVED_LENGTH))}`;
};

/**
 * Extracts the trailing file name from a path or URL.
 *
 * @param path Path or URL to inspect.
 *
 * @returns The substring after the last slash, or the input itself.
 */
export const getFileName = (path: string): string => {
    const segments = path.split('/');
    return segments[segments.length - 1] || path;
};

/**
 * Matches the constant file-URL scheme prefix.
 */
const FILE_SCHEME_REGEX = /^file:\/\//i;

/**
 * Prepares a source path for compact display.
 *
 * The constant file:// scheme is stripped so middle truncation spends
 * its budget on the informative parts of the path.
 *
 * @param path Path or URL to display.
 *
 * @returns Display-friendly path without the file scheme.
 */
export const getDisplayPath = (path: string): string => {
    return path.replace(FILE_SCHEME_REGEX, '');
};

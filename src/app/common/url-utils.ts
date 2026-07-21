/**
 * @file
 */

/**
 * Matches hostnames like "example.com" with at least one dot and a TLD.
 */
const HOSTNAME_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Matches file URLs with an explicit triple-slash prefix.
 */
const FILE_URL_REGEX = /^file:\/\/\//i;

/**
 * Hostname of local development servers accepted without a TLD.
 */
const LOCALHOST = 'localhost';

/**
 * Matches a leading "www." hostname label.
 */
const WWW_PREFIX_REGEX = /^www\./;

/**
 * Matches values that already carry a URL scheme.
 */
const URL_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Parses and normalizes hostnames from URLs.
 */
class UrlUtils {
    /**
     * Extracts a hostname from a URL.
     */
    getHostname = (url?: string): string | null => {
        if (!url) {
            return null;
        }

        try {
            return new URL(url).hostname;
        } catch {
            return null;
        }
    };

    /**
     * Extracts a hostname and removes its www prefix.
     */
    getHostnameWithoutWww = (url?: string): string | null => {
        const hostname = this.getHostname(url);
        if (!hostname) {
            return null;
        }

        return hostname.replace(WWW_PREFIX_REGEX, '');
    }

    /**
     * Checks whether a value is a plain hostname usable in a rule.
     *
     * @param value Candidate hostname.
     *
     * @returns Whether the value is a bare hostname or localhost.
     */
    isValidRuleSite = (value: string): boolean => {
        return HOSTNAME_REGEX.test(value) || value === LOCALHOST;
    };

    /**
     * Normalizes user input into a rule hostname.
     *
     * Accepts bare hostnames as well as pasted URLs: the scheme, path,
     * port, and a leading www prefix are stripped and the case is lowered.
     *
     * @param input Raw user input.
     *
     * @returns Normalized hostname, or null when no valid hostname remains.
     */
    normalizeRuleSite = (input: string): string | null => {
        const trimmed = input.trim();
        if (!trimmed) {
            return null;
        }

        let hostname: string;
        try {
            const url = URL_SCHEME_REGEX.test(trimmed)
                ? new URL(trimmed)
                : new URL(`https://${trimmed}`);
            hostname = url.hostname;
        } catch {
            return null;
        }

        const site = hostname.replace(WWW_PREFIX_REGEX, '');
        return this.isValidRuleSite(site) ? site : null;
    };

    /**
     * Checks whether a value is a file URL with a triple-slash prefix.
     *
     * @param value Candidate path.
     *
     * @returns Whether the value starts with file:///.
     */
    isFileUrl = (value: string): boolean => {
        return FILE_URL_REGEX.test(value.trim());
    };

    /**
     * Normalizes user input into a file URL where possible.
     *
     * Plain absolute paths get the file:/// scheme prepended: POSIX
     * ("/Users/me/a.js") and Windows ("C:\\overrides\\a.js" or
     * "C:/overrides/a.js") forms are recognized. Values that already
     * carry a scheme, and anything unrecognized, pass through unchanged
     * for validation to judge.
     *
     * @param input Raw user input.
     *
     * @returns File URL for absolute paths, otherwise the trimmed input.
     */
    normalizeRuleFilePath = (input: string): string => {
        const trimmed = input.trim();
        if (!trimmed || URL_SCHEME_REGEX.test(trimmed) || FILE_URL_REGEX.test(trimmed)) {
            return trimmed;
        }

        if (trimmed.startsWith('/')) {
            return `file://${trimmed}`;
        }

        if (/^[a-z]:[\\/]/i.test(trimmed)) {
            return `file:///${trimmed.replace(/\\/g, '/')}`;
        }

        return trimmed;
    };
}

export const urlUtils = new UrlUtils();

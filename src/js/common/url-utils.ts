/**
 * @file
 */

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

        const wwwRegex = /^www\./;
        return hostname.replace(wwwRegex, '');
    }
}

export const urlUtils = new UrlUtils();

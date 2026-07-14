/**
 * @file
 */

const FIREFOX_EXTENSION_PROTOCOL = 'moz-extension:';
const EDGE_USER_AGENT_PATTERN = /\bEdg\//u;

/**
 * Supported browser build target.
 */
export enum BrowserTarget {
    Chrome = 'chrome',
    Edge = 'edge',
    Firefox = 'firefox',
}

const EXTENSION_SETTINGS_SCHEMES: Partial<Record<BrowserTarget, string>> = {
    [BrowserTarget.Chrome]: BrowserTarget.Chrome,
    [BrowserTarget.Edge]: BrowserTarget.Edge,
};

/**
 * Detects the current browser from extension-page runtime values.
 *
 * @param protocol Extension page protocol.
 * @param userAgent Browser user agent.
 *
 * @returns Supported browser target.
 */
export const detectBrowserTarget = (
    protocol: string,
    userAgent: string,
): BrowserTarget => {
    if (protocol === FIREFOX_EXTENSION_PROTOCOL) {
        return BrowserTarget.Firefox;
    }

    if (EDGE_USER_AGENT_PATTERN.test(userAgent)) {
        return BrowserTarget.Edge;
    }

    return BrowserTarget.Chrome;
};

/**
 * Detects the browser hosting the current extension page.
 *
 * @returns Supported browser target.
 */
export const getCurrentBrowserTarget = (): BrowserTarget => {
    return detectBrowserTarget(
        globalThis.location?.protocol || '',
        globalThis.navigator?.userAgent || '',
    );
};

/**
 * Creates the browser's details URL for the installed extension.
 *
 * Firefox blocks extensions from opening privileged about: pages, so it does
 * not receive a URL.
 *
 * @param target Browser target.
 * @param extensionId Runtime extension identifier.
 *
 * @returns Browser settings URL when it can be opened by the extension.
 */
export const getExtensionSettingsUrl = (
    target: BrowserTarget,
    extensionId: string,
): string | undefined => {
    const scheme = EXTENSION_SETTINGS_SCHEMES[target];
    if (!scheme) {
        return undefined;
    }

    return `${scheme}://extensions/?id=${encodeURIComponent(extensionId)}`;
};

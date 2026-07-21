/**
 * @file Parses deep-link query parameters of the options page.
 */

import { OPTIONS_QUERY_PARAMS, OPTIONS_TABS } from '../common/constants';
import { urlUtils } from '../common/url-utils';

/**
 * Extracts a rule-editor prefill site from an options page query string.
 *
 * @param search Value of window.location.search.
 *
 * @returns Normalized hostname to prefill, or null when absent or invalid.
 */
export const getPrefillSiteFromSearch = (search: string): string | null => {
    const site = new URLSearchParams(search).get(OPTIONS_QUERY_PARAMS.PREFILL_SITE);
    if (!site) {
        return null;
    }

    return urlUtils.normalizeRuleSite(site);
};

/**
 * Extracts a requested options tab from an options page query string.
 *
 * @param search Value of window.location.search.
 *
 * @returns A known tab identifier, or null when absent or unknown.
 */
export const getRequestedTabFromSearch = (search: string): string | null => {
    const tab = new URLSearchParams(search).get(OPTIONS_QUERY_PARAMS.TAB);
    const knownTabs: string[] = Object.values(OPTIONS_TABS);

    return tab && knownTabs.includes(tab) ? tab : null;
};

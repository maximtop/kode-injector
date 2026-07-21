/**
 * @file Derives the popup site status line.
 */

import { BrowserTarget } from '../../../common/browser-target';
import type { LocalSourceAccessState } from '../../../common/contracts';
import { translator } from '../../../common/translator';
import { getAccessBlockState } from '../AccessBlock/access-block-state';

/**
 * Visual tone of the site status line.
 */
export type SiteStatusTone = 'ok' | 'off' | 'warn';

/**
 * Presentation of the site status line.
 */
export interface SiteStatus {
    /**
     * Visual tone controlling the status dot color.
     */
    tone: SiteStatusTone;

    /**
     * Localized status text.
     */
    text: string;
}

/**
 * Inputs of the site status derivation.
 */
export interface SiteStatusInput {
    /**
     * Whether the extension is globally enabled.
     */
    appEnabled: boolean;

    /**
     * Current local-source access state.
     */
    localSourceAccess: LocalSourceAccessState;

    /**
     * Browser hosting the extension.
     */
    browserTarget: BrowserTarget;

    /**
     * Number of rules matching the current site.
     */
    matchingCount: number;

    /**
     * Number of enabled rules matching the current site.
     */
    activeCount: number;

    /**
     * Whether the current site is blocklisted.
     */
    siteIsBlacklisted: boolean;
}

/**
 * Derives the popup site status line.
 *
 * Priority follows the design prototype: paused, unreadable files,
 * no rules, site disabled, all rules off, then the active count.
 *
 * @param input Current popup state.
 *
 * @returns Status line presentation.
 */
export const getSiteStatus = (input: SiteStatusInput): SiteStatus => {
    if (!input.appEnabled) {
        return { tone: 'off', text: translator.getMessage('popup_paused_strip') };
    }

    if (getAccessBlockState(input.localSourceAccess, input.browserTarget)) {
        return { tone: 'warn', text: translator.getMessage('popup_files_unreadable') };
    }

    if (input.matchingCount === 0) {
        return { tone: 'off', text: translator.getMessage('popup_no_rules') };
    }

    if (input.siteIsBlacklisted) {
        return { tone: 'off', text: translator.getMessage('popup_site_disabled') };
    }

    if (input.activeCount === 0) {
        return { tone: 'off', text: translator.getMessage('popup_all_rules_off') };
    }

    return {
        tone: 'ok',
        text: translator.getPlural('popup_rules_active', input.activeCount),
    };
};

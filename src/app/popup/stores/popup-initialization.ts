/**
 * @file
 */

import { SETTINGS } from '../../common/constants';
import type {
    InjectionRule,
    LocalSourceAccessState,
    PopupDataResponse,
    PopupTab,
} from '../../common/contracts';
import type { LocalePreference } from '../../common/locale';

/**
 * Popup state applied after locale initialization.
 */
export interface PopupPresentationState {
    /**
     * Global extension state.
     */
    appEnabled: boolean;

    /**
     * Whether the browser currently permits local-file access.
     */
    localSourceAccess: LocalSourceAccessState;

    /**
     * Active browser tab.
     */
    currentTab: PopupTab;

    /**
     * Injection rules matching the current site.
     */
    matchingInjections: InjectionRule[];

    /**
     * Whether the current site is blocked.
     */
    siteIsBlacklisted: boolean;
}

/**
 * Prepares popup presentation state after locale initialization.
 *
 * @param currentTab Current browser tab.
 * @param popupData Background response.
 * @param initializeLocale Locale initializer.
 *
 * @returns State safe to apply to the observable store.
 */
export const preparePopupState = async (
    currentTab: PopupTab,
    popupData: PopupDataResponse,
    initializeLocale: (preference: LocalePreference) => Promise<void>,
): Promise<PopupPresentationState> => {
    await initializeLocale(popupData.settings[SETTINGS.SELECTED_LANGUAGE]);

    return {
        appEnabled: popupData.settings[SETTINGS.APP_ENABLED],
        currentTab,
        localSourceAccess: popupData.localSourceAccess,
        matchingInjections: popupData.matchingInjections,
        siteIsBlacklisted: popupData.siteIsBlacklisted,
    };
};

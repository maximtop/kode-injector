/**
 * @file Maps local-source access state onto the compact popup notice.
 */

import { BrowserTarget } from '../../../common/browser-target';
import {
    LocalSourceAccessMethod,
    type LocalSourceAccessState,
} from '../../../common/contracts';
import { NativeHostStatus } from '../../../common/native-host-protocol';
import { translator } from '../../../common/translator';

/**
 * Action offered by the compact access notice.
 */
export type AccessBlockAction = 'openSettings' | 'useBrowserAccess';

/**
 * Presentation of the compact access notice.
 */
export interface AccessBlockState {
    /**
     * Localized notice line.
     */
    message: string;

    /**
     * Localized action button label.
     */
    actionLabel: string;

    /**
     * Action performed by the button.
     */
    action: AccessBlockAction;
}

/**
 * Derives the compact popup notice from local-source access state.
 *
 * @param state Current local-source access state.
 * @param browserTarget Browser hosting the extension.
 *
 * @returns Notice presentation, or null when access is healthy.
 */
export const getAccessBlockState = (
    state: LocalSourceAccessState,
    browserTarget: BrowserTarget,
): AccessBlockState | null => {
    if (state.kind === LocalSourceAccessMethod.Browser) {
        if (state.allowed) {
            return null;
        }

        return {
            message: translator.getMessage('popup_file_access_disabled'),
            actionLabel: translator.getMessage('popup_enable_file_access'),
            action: 'openSettings',
        };
    }

    const healthy = state.permissionGranted
        && (state.host.status === NativeHostStatus.Ready
            || state.host.status === NativeHostStatus.Checking);
    if (healthy) {
        return null;
    }

    if (browserTarget === BrowserTarget.Firefox) {
        return {
            message: translator.getMessage('popup_native_host_unavailable'),
            actionLabel: translator.getMessage('popup_install_helper'),
            action: 'openSettings',
        };
    }

    return {
        message: translator.getMessage('popup_native_host_optional_unavailable'),
        actionLabel: translator.getMessage('local_source_method_use_browser'),
        action: 'useBrowserAccess',
    };
};

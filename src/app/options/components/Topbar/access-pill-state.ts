/**
 * @file Maps local-source access state onto the header status pill.
 */

import { LocalSourceAccessMethod, type LocalSourceAccessState } from '../../../common/contracts';
import { NativeHostStatus } from '../../../common/native-host-protocol';
import { translator } from '../../../common/translator';

/**
 * Visual tone of the status pill.
 */
export type AccessPillTone = 'ok' | 'warn' | 'pending';

/**
 * Presentation of the header status pill.
 */
export interface AccessPillState {
    /**
     * Visual tone controlling the pill color.
     */
    tone: AccessPillTone;

    /**
     * Localized pill label.
     */
    label: string;
}

/**
 * Derives the header status pill from local-source access state.
 *
 * @param state Current local-source access state.
 *
 * @returns Pill tone and label.
 */
export const getAccessPillState = (state: LocalSourceAccessState): AccessPillState => {
    if (state.kind === LocalSourceAccessMethod.Browser) {
        return state.allowed
            ? { tone: 'ok', label: translator.getMessage('access_pill_ok') }
            : { tone: 'warn', label: translator.getMessage('access_pill_disabled') };
    }

    if (!state.permissionGranted) {
        return { tone: 'warn', label: translator.getMessage('access_pill_permission') };
    }

    switch (state.host.status) {
        case NativeHostStatus.Ready:
            return { tone: 'ok', label: translator.getMessage('access_pill_ok') };
        case NativeHostStatus.Checking:
            return { tone: 'pending', label: translator.getMessage('access_pill_checking') };
        default:
            return { tone: 'warn', label: translator.getMessage('access_pill_helper') };
    }
};

/**
 * @file
 */

import { SETTINGS } from '../common/constants';
import { settings } from './settings';

/**
 * Controls the extension's global enabled state.
 */
class App {
    /**
     * Returns whether the extension is globally enabled.
     *
     * @returns Current global enabled state.
     */
    get enabled(): boolean {
        return settings.getSetting(SETTINGS.APP_ENABLED);
    }

    /**
     * Enables the extension globally.
     */
    enable(): Promise<void> {
        return settings.setSetting(SETTINGS.APP_ENABLED, true);
    }

    /**
     * Disables the extension globally.
     */
    disable(): Promise<void> {
        return settings.setSetting(SETTINGS.APP_ENABLED, false);
    }
}

export const app = new App();

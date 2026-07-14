/**
 * @file
 */

import browser from 'webextension-polyfill';
import isNil from 'lodash/isNil';
import { app } from './app';
import { injections } from './injections';

const UPDATE_REASON = 'update';

/**
 * Activation state stored by the legacy extension format.
 */
interface LegacyActivationState {
    /**
     * Legacy global activation value.
     */
    isActivated?: unknown;
}

/**
 * Injection rule stored by the legacy extension format.
 */
interface LegacyInjectionData {
    /**
     * Legacy CSS file path.
     */
    cssPath?: unknown;

    /**
     * Legacy JavaScript file path.
     */
    jsPath?: unknown;

    /**
     * Legacy site URL.
     */
    siteUrl?: unknown;

    /**
     * Legacy injection activation state.
     */
    state?: unknown;
}

/**
 * Root storage structure used by legacy extension versions.
 */
interface LegacyStorageData {
    /**
     * Legacy application activation state.
     */
    isActivated?: LegacyActivationState;

    /**
     * Legacy application data container.
     */
    state?: {
        /**
         * Legacy injection rules keyed by identifier.
         */
        injections?: Record<string, LegacyInjectionData>;
    };
}

/**
 * Checks whether a legacy injection contains usable path and site values.
 *
 * @param injectionData Legacy injection data to validate.
 *
 * @returns Whether all required values are strings.
 */
const hasStringInjectionFields = (
    injectionData: LegacyInjectionData,
): injectionData is LegacyInjectionData & {
    cssPath: string;
    jsPath: string;
    siteUrl: string;
} => (
    typeof injectionData.cssPath === 'string'
    && typeof injectionData.jsPath === 'string'
    && typeof injectionData.siteUrl === 'string'
);

/**
 * Migrates persisted data when the extension is updated.
 */
class UpdateService {
    /**
     * Migrates version 1 storage data to version 2.
     */
    updateFrom1To2 = async (): Promise<void> => {
        const storedData = await browser.storage.local.get() as LegacyStorageData;

        const isEnabled = storedData?.isActivated?.isActivated;
        if (!isNil(isEnabled)) {
            if (isEnabled) {
                await app.enable();
            } else {
                await app.disable();
            }
        }

        const oldInjections = storedData?.state?.injections;
        if (!isNil(oldInjections)) {
            const oldInjectionsEntries = Object.values(oldInjections);
            oldInjectionsEntries.forEach((oldInjectionData) => {
                if (!hasStringInjectionFields(oldInjectionData)) {
                    return;
                }

                const injection = injections.addInjection({
                    cssPath: oldInjectionData.cssPath,
                    jsPath: oldInjectionData.jsPath,
                    site: oldInjectionData.siteUrl,
                });
                if (isNil(injection)) {
                    return;
                }

                if (oldInjectionData.state === 'stopped') {
                    injections.disableInjection(injection.id);
                }
            });
        }
    };

    /**
     * Handles extension installation and update events.
     */
    onInstalled = async (
        details: browser.Runtime.OnInstalledDetailsType,
    ): Promise<void> => {
        const { reason, previousVersion } = details;
        if (reason === UPDATE_REASON && previousVersion === '0.6.0') {
            await this.updateFrom1To2();
        }
    };

    /**
     * Registers the installation event listener.
     */
    init = (): void => {
        browser.runtime.onInstalled.addListener(this.onInstalled);
    }
}

export const updateService = new UpdateService();

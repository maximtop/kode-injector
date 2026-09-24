/**
 * @file
 */

import browser from 'webextension-polyfill';

import { BrowserTarget, getCurrentBrowserTarget } from '../common/browser-target';
import { OPTIONS_TABS } from '../common/constants';
import { BUILT_IN_DEMO_SHIPPED } from '../common/demo-contracts';
import { log } from '../common/log';
import { NATIVE_HOST_NAME } from '../common/native-host-protocol';
import { tabs } from '../common/tabs';

import { demoLaunch } from './demo-launch';
import { injections } from './injections';
import { localSourceAccess } from './local-source-access';
import { messageHandler } from './message-handler';
import { subscribeSafariAppMessages } from './safari-app-messages';
import { settings } from './settings';
import { updateService } from './update-service';

/**
 * Initializes background services and persistent stores.
 *
 * @returns A promise that resolves after the stores are initialized.
 */
export const backgroundPage = (): Promise<void> => {
    updateService.init();
    demoLaunch.init();

    // Safari only: the containing app's Try Demo asks the background to open
    // Rules. Chromium would try to spawn the external Helper for this port.
    if (BUILT_IN_DEMO_SHIPPED && getCurrentBrowserTarget() === BrowserTarget.Safari) {
        subscribeSafariAppMessages(
            () => (
                browser.runtime.connectNative(NATIVE_HOST_NAME)
            ),
            () => {
                tabs.openTab(tabs.getOptionsUrlForTab(OPTIONS_TABS.INJECTIONS)).catch(log.error);
            },
        );
    }

    /**
     * Initializes stores that require asynchronous storage access.
     */
    const asyncInit = async (): Promise<void> => {
        await Promise.all([
            injections.init(),
            settings.init(),
        ]);
        await localSourceAccess.getState();
    };

    const backgroundReady = asyncInit();
    messageHandler.init(backgroundReady);
    return backgroundReady;
};

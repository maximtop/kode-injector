/**
 * @file
 */

import { messageHandler } from './message-handler';
import { injections } from './injections';
import { settings } from './settings';
import { updateService } from './update-service';

/**
 * Initializes background services and persistent stores.
 *
 * @returns A promise that resolves after the stores are initialized.
 */
export const backgroundPage = (): Promise<void> => {
    updateService.init();

    /**
     * Initializes stores that require asynchronous storage access.
     */
    const asyncInit = async (): Promise<void> => {
        await injections.init();
        await settings.init();
    };

    const backgroundReady = asyncInit();
    messageHandler.init(backgroundReady);
    return backgroundReady;
};

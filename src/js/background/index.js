import { messageHandler } from './message-handler';
import { injections } from './injections';
import { settings } from './settings';
import { updateService } from './update-service';

export const backgroundPage = async () => {
    updateService.init();
    messageHandler.init();

    await injections.init();
    await settings.init();
};

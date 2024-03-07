import { messageHandler } from './message-handler';
import { injections } from './injections';
import { settings } from './settings';
import { updateService } from './update-service';

export const backgroundPage = () => {
    updateService.init();
    messageHandler.init();

    const asyncInit = async () => {
        await injections.init();
        await settings.init();
    };

    return asyncInit();
};

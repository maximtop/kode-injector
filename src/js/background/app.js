/* eslint-disable class-methods-use-this */
import { SETTINGS } from '../common/constants';
import { settings } from './settings';

class App {
    get enabled() {
        return settings.getSetting(SETTINGS.APP_ENABLED);
    }

    enable() {
        settings.setSetting(SETTINGS.APP_ENABLED, true);
    }

    disable() {
        settings.setSetting(SETTINGS.APP_ENABLED, false);
    }
}

export const app = new App();

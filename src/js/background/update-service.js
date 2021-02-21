import browser from 'webextension-polyfill';
import isNil from 'lodash/isNil';
import { app } from './app';
import { injections } from './injections';

const UPDATE_REASON = 'update';
class UpdateService {
    updateFrom1To2 = async () => {
        const storedData = await browser.storage.local.get();

        const isEnabled = storedData?.isActivated?.isActivated;
        if (!isNil(isEnabled)) {
            if (isEnabled) {
                app.enable();
            } else {
                app.disable();
            }
        }

        const oldInjections = storedData?.state?.injections;
        if (!isNil(oldInjections)) {
            const oldInjectionsEntries = Object.values(oldInjections);
            oldInjectionsEntries.forEach((oldInjectionData) => {
                const {
                    cssPath,
                    jsPath,
                    siteUrl: site,
                    state,
                } = oldInjectionData;

                const injection = injections.addInjection({ cssPath, jsPath, site });
                if (state === 'stopped') {
                    injections.disableInjection(injection.id);
                }
            });
        }
    };

    onInstalled = async (details) => {
        const { reason, previousVersion } = details;
        if (reason === UPDATE_REASON && previousVersion === '0.6.0') {
            await this.updateFrom1To2();
        }
    };

    init = () => {
        browser.runtime.onInstalled.addListener(this.onInstalled);
    }
}

export const updateService = new UpdateService();

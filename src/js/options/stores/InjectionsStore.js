import {
    makeObservable,
    observable,
    runInAction,
} from 'mobx';
import find from 'lodash/find';

import { messenger } from '../../common/messenger';
import { log } from '../../common/log';

export class InjectionsStore {
    constructor(rootStore) {
        makeObservable(this);
        this.rootStore = rootStore;
    }

    @observable
    injections = [];

    @observable
    optionsDataReady = false;

    getOptionsData = async () => {
        const { injections } = await messenger.getOptionsData();
        runInAction(() => {
            this.injections = injections;
            this.optionsDataReady = true;
        });
    }

    addInjection = async (injectionData) => {
        try {
            const injection = await messenger.addInjection(injectionData);
            if (!injection) {
                return;
            }
            runInAction(() => {
                this.injections.push(injection);
            });
        } catch (e) {
            log.error(e);
        }
    }

    removeInjection = async (id) => {
        try {
            await messenger.removeInjection(id);
            runInAction(() => {
                this.injections = this.injections.filter((injection) => injection.id !== id);
            });
        } catch (e) {
            log.error(e.message);
        }
    }

    toggleInjection = async (id) => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }

        try {
            if (injection.enabled) {
                await messenger.disableInjection(id);
            } else {
                await messenger.enableInjection(id);
            }
            runInAction(() => {
                this.injections = this.injections
                    .map((inj) => (inj.id === id ? { ...inj, enabled: !inj.enabled } : inj));
            });
        } catch (e) {
            log.error(e.message);
        }
    }
}

/**
 * @file
 */

import {
    makeObservable,
    observable,
    runInAction,
} from 'mobx';
import find from 'lodash/find';

import {
    LocalSourceAccessKind,
    type InjectionRule,
    type LocalSourceAccessState,
    type NewInjectionData,
} from '../../common/contracts';
import { NativeHostStatus } from '../../common/native-host-protocol';
import { messenger } from '../../common/messenger';
import { log } from '../../common/log';
import { i18n } from '../../common/i18n';
import type { RootStoreType } from './RootStore';

/**
 * Manages options-page injection state and actions.
 */
export class InjectionsStore {
    /**
     * Parent options-page store.
     */
    rootStore: RootStoreType;

    /**
     * Creates an options-page injection store.
     *
     * @param rootStore Parent options-page store.
     */
    constructor(rootStore: RootStoreType) {
        makeObservable(this);
        this.rootStore = rootStore;
    }

    /**
     * Injection rules displayed by the options page.
     */
    @observable
    injections: InjectionRule[] = [];

    /**
     * Whether options data is being loaded.
     */
    @observable
    optionsDataReady = false;

    /**
     * Whether the browser currently permits local-file access.
     */
    @observable
    localSourceAccess: LocalSourceAccessState = {
        kind: LocalSourceAccessKind.NativeHost,
        host: { status: NativeHostStatus.Checking },
    };

    /**
     * Loads injection data for the options page.
     */
    getOptionsData = async (): Promise<void> => {
        const {
            localSourceAccess,
            injections,
            selectedLanguage,
        } = await messenger.getOptionsData();
        await i18n.init(selectedLanguage);
        runInAction(() => {
            this.localSourceAccess = localSourceAccess;
            this.injections = injections;
            this.optionsDataReady = true;
        });
    }

    /**
     * Refreshes browser-owned local-file permission state.
     */
    refreshLocalSourceAccess = async (): Promise<void> => {
        try {
            const localSourceAccess = await messenger.getLocalSourceAccessStatus();
            runInAction(() => {
                this.localSourceAccess = localSourceAccess;
            });
        } catch (error) {
            log.error(error instanceof Error ? error.message : error);
        }
    };

    /**
     * Adds an injection rule and refreshes options data.
     */
    addInjection = async (injectionData: NewInjectionData): Promise<void> => {
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

    /**
     * Removes an injection rule and refreshes options data.
     */
    removeInjection = async (id: string): Promise<void> => {
        try {
            await messenger.removeInjection(id);
            runInAction(() => {
                this.injections = this.injections.filter((injection) => injection.id !== id);
            });
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
    }

    /**
     * Toggles an injection rule and refreshes options data.
     */
    toggleInjection = async (id: string): Promise<void> => {
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
            log.error(e instanceof Error ? e.message : e);
        }
    }
}

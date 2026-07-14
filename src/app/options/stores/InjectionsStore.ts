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
    type InjectionRule,
    LocalSourceAccessMethod,
    type LocalSourceAccessState,
    type NewInjectionData,
} from '../../common/contracts';
import { messenger } from '../../common/messenger';
import { log } from '../../common/log';
import { i18n } from '../../common/i18n';
import { NativeHostStatus } from '../../common/native-host-protocol';
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
        kind: LocalSourceAccessMethod.Browser,
        allowed: true,
    };

    /**
     * Authoritative persisted method, independent of readiness probes.
     */
    @observable
    localSourceAccessMethod = LocalSourceAccessMethod.Browser;

    /**
     * Whether a method transition is waiting for background persistence.
     */
    @observable
    localSourceAccessMethodPending = false;

    /**
     * Monotonic generation used to discard stale readiness responses.
     */
    private localSourceAccessRequest = 0;

    /**
     * Starts an outer local-source method transition unless one is active.
     *
     * @returns Whether the caller acquired the transition guard.
     */
    beginLocalSourceAccessMethodTransition = (): boolean => {
        if (this.localSourceAccessMethodPending) {
            return false;
        }

        runInAction(() => {
            this.localSourceAccessMethodPending = true;
        });
        return true;
    };

    /**
     * Releases the local-source method transition guard.
     */
    endLocalSourceAccessMethodTransition = (): void => {
        runInAction(() => {
            this.localSourceAccessMethodPending = false;
        });
    };

    /**
     * Loads injection data for the options page.
     */
    getOptionsData = async (): Promise<void> => {
        const {
            localSourceAccess,
            localSourceAccessMethod,
            injections,
            selectedLanguage,
        } = await messenger.getOptionsData();
        await i18n.init(selectedLanguage);
        runInAction(() => {
            this.localSourceAccess = localSourceAccess;
            this.localSourceAccessMethod = localSourceAccessMethod;
            this.injections = injections;
            this.optionsDataReady = true;
        });
    }

    /**
     * Refreshes browser-owned local-file permission state.
     */
    refreshLocalSourceAccess = async (): Promise<void> => {
        this.localSourceAccessRequest += 1;
        const request = this.localSourceAccessRequest;
        try {
            const localSourceAccess = await messenger.getLocalSourceAccessStatus();
            runInAction(() => {
                if (request === this.localSourceAccessRequest
                    && localSourceAccess.kind === this.localSourceAccessMethod) {
                    this.localSourceAccess = localSourceAccess;
                }
            });
        } catch (error) {
            log.error(error instanceof Error ? error.message : error);
        }
    };

    /**
     * Persists and activates a local-source access method.
     *
     * @param method Selected method.
     */
    setLocalSourceAccessMethod = async (
        method: LocalSourceAccessMethod,
    ): Promise<void> => {
        const ownsTransition = this.beginLocalSourceAccessMethodTransition();
        this.localSourceAccessRequest += 1;

        try {
            const selectedMethod = await messenger.setLocalSourceAccessMethod(method);
            this.localSourceAccessRequest += 1;
            runInAction(() => {
                this.localSourceAccessMethod = selectedMethod;
                this.localSourceAccess = getCheckingAccessState(selectedMethod);
            });
            await this.refreshLocalSourceAccess();
        } finally {
            if (ownsTransition) {
                this.endLocalSourceAccessMethodTransition();
            }
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

/**
 * Creates the immediate status shown while the selected method is probed.
 *
 * @param method Selected local-source method.
 *
 * @returns Method-specific checking state.
 */
const getCheckingAccessState = (
    method: LocalSourceAccessMethod,
): LocalSourceAccessState => {
    if (method === LocalSourceAccessMethod.Browser) {
        return {
            kind: LocalSourceAccessMethod.Browser,
            allowed: true,
        };
    }

    return {
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.Checking },
    };
};

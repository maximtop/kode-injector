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
    type InjectionFileField,
    type InjectionFileIssues,
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
     * Whether injections are enabled globally.
     */
    @observable
    appEnabled = true;

    /**
     * Message describing the last failed access-method change, if any.
     */
    @observable
    methodChangeError: string | null = null;

    /**
     * Unreadable source-path fields keyed by rule identifier.
     */
    @observable
    fileIssues: InjectionFileIssues = {};

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
            appEnabled,
        } = await messenger.getOptionsData();
        await i18n.init(selectedLanguage);
        runInAction(() => {
            this.localSourceAccess = localSourceAccess;
            this.localSourceAccessMethod = localSourceAccessMethod;
            this.injections = injections;
            this.appEnabled = appEnabled;
            this.optionsDataReady = true;
        });
        this.refreshFileIssues();
    }

    /**
     * Re-probes source-file readability for every rule.
     */
    refreshFileIssues = async (): Promise<void> => {
        try {
            const fileIssues = await messenger.getInjectionFileIssues();
            runInAction(() => {
                this.fileIssues = fileIssues;
            });
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
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
     *
     * @param injectionData New rule data.
     *
     * @returns The created rule, or null when creation failed.
     */
    addInjection = async (injectionData: NewInjectionData): Promise<InjectionRule | null> => {
        try {
            const injection = await messenger.addInjection(injectionData);
            if (!injection) {
                return null;
            }
            runInAction(() => {
                this.injections.push(injection);
            });
            this.refreshFileIssues();
            return injection;
        } catch (e) {
            log.error(e);
            return null;
        }
    }

    /**
     * Updates an injection rule in place.
     *
     * @param id Identifier of the rule to update.
     * @param injectionData Replacement rule data.
     *
     * @returns The updated rule, or null when the update failed.
     */
    updateInjection = async (
        id: string,
        injectionData: NewInjectionData,
    ): Promise<InjectionRule | null> => {
        try {
            const updated = await messenger.updateInjection(id, injectionData);
            if (!updated) {
                return null;
            }
            runInAction(() => {
                this.injections = this.injections
                    .map((inj) => (inj.id === id ? updated : inj));
            });
            this.refreshFileIssues();
            return updated;
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
            return null;
        }
    }

    /**
     * Enables or disables one file of a rule.
     *
     * @param id Identifier of the rule.
     * @param field Path field whose file is toggled.
     * @param enabled New enabled state of the file.
     */
    setInjectionFileEnabled = async (
        id: string,
        field: InjectionFileField,
        enabled: boolean,
    ): Promise<void> => {
        try {
            const updated = await messenger.setInjectionFileEnabled(id, field, enabled);
            if (!updated) {
                return;
            }
            runInAction(() => {
                this.injections = this.injections
                    .map((inj) => (inj.id === id ? updated : inj));
            });
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
    }

    /**
     * Duplicates an injection rule as a disabled copy.
     *
     * The copy starts with both files enabled and the rule disabled, so the
     * user turns it on deliberately after adjusting it.
     *
     * @param id Identifier of the rule to duplicate.
     */
    duplicateInjection = async (id: string): Promise<void> => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }

        const { site, jsPath, cssPath } = injection;
        try {
            const copy = await messenger.addInjection({ site, jsPath, cssPath }, false);
            if (!copy) {
                return;
            }
            runInAction(() => {
                this.injections.push(copy);
            });
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
    }

    /**
     * Toggles the global injections switch.
     */
    toggleAppEnabled = async (): Promise<void> => {
        const nextEnabled = !this.appEnabled;
        try {
            if (nextEnabled) {
                await messenger.enableApp();
            } else {
                await messenger.disableApp();
            }
            runInAction(() => {
                this.appEnabled = nextEnabled;
            });
        } catch (e) {
            log.error(e instanceof Error ? e.message : e);
        }
    }

    /**
     * Records a failed access-method change for inline display.
     *
     * @param message Localized failure description, or null to clear.
     */
    setMethodChangeError = (message: string | null): void => {
        runInAction(() => {
            this.methodChangeError = message;
        });
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

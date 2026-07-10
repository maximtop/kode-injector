/**
 * @file
 */

import {
    computed,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';

import { log } from '../log';
import {
    BASE_LOCALE,
    LANGUAGE_AUTO,
    RTL_LOCALES,
    type AvailableLocale,
    type LocalePreference,
} from './locale-constants';
import type { TextDirection } from './locale-types';
import { TranslationService } from './translation-service';

/**
 * Owns the observable locale state for one UI bundle.
 */
export class TranslationStore {
    /**
     * User-selected preference.
     */
    @observable
    userLocalePreference: LocalePreference = LANGUAGE_AUTO;

    /**
     * Concrete locale currently rendered.
     */
    @observable
    currentLocale: AvailableLocale = BASE_LOCALE;

    /**
     * Whether a catalog load is in progress.
     */
    @observable
    isLoading = false;

    /**
     * Whether the first locale load has completed.
     */
    private initialized = false;

    /**
     * Creates a locale store.
     *
     * @param service Catalog service.
     */
    constructor(private service: Pick<TranslationService, 'loadLocaleData'>) {
        makeObservable(this);
    }

    /**
     * Returns the page direction for the active locale.
     *
     * @returns Text direction.
     */
    @computed get direction(): TextDirection {
        return RTL_LOCALES.has(this.currentLocale) ? 'rtl' : 'ltr';
    }

    /**
     * Returns the active locale in HTML notation.
     *
     * @returns BCP 47-like language tag.
     */
    @computed get htmlLanguage(): string {
        return this.currentLocale.replace('_', '-');
    }

    /**
     * Initializes the store.
     *
     * @param preference Saved preference.
     *
     * @returns Promise resolved after locale state is ready.
     */
    public init = async (preference: LocalePreference = LANGUAGE_AUTO): Promise<void> => {
        await this.setLocalePreference(preference, true);
    };

    /**
     * Changes the locale in this UI context.
     *
     * @param preference New saved preference.
     * @param force Whether initialization should always load.
     *
     * @returns Promise resolved after locale state is ready.
     */
    public setLocalePreference = async (
        preference: LocalePreference,
        force = false,
    ): Promise<void> => {
        if (!force
            && this.initialized
            && !this.isLoading
            && preference === this.userLocalePreference) {
            return;
        }

        runInAction(() => {
            this.isLoading = true;
            this.userLocalePreference = preference;
        });

        try {
            const resolved = await this.service.loadLocaleData(preference);
            runInAction(() => {
                this.currentLocale = resolved;
                this.isLoading = false;
                this.initialized = true;
            });
        } catch (error) {
            log.error('[locale]: Failed to load locale', error);
            runInAction(() => {
                this.currentLocale = BASE_LOCALE;
                this.isLoading = false;
                this.initialized = true;
            });
        }
    };
}

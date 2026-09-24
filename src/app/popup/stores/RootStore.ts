/**
 * @file
 */

import { configure } from 'mobx';
import { createContext } from 'react';

import { i18n } from '../../common/i18n';
import { TranslationStore } from '../../common/locale';

import { SettingsStore } from './SettingsStore';

// Do not allow property change outside of store actions
configure({ enforceActions: 'observed' });

/**
 * Composes stores used by the popup.
 */
class RootStore {
    /**
     * Popup settings store.
     */
    settingsStore: SettingsStore;

    /**
     * Popup locale state.
     */
    translationStore: TranslationStore;

    /**
     * Creates the popup store graph.
     */
    constructor() {
        this.translationStore = i18n.connectStore(TranslationStore);
        this.settingsStore = new SettingsStore(this);
    }
}

/**
 * Popup root store instance type.
 */
export type RootStoreType = RootStore;

export const rootStore = createContext(new RootStore());

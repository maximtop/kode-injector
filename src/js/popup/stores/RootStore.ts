/**
 * @file
 */

import { createContext } from 'react';
import { configure } from 'mobx';

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
     * Creates the popup store graph.
     */
    constructor() {
        this.settingsStore = new SettingsStore(this);
    }
}

/**
 * Popup root store instance type.
 */
export type RootStoreType = RootStore;

export const rootStore = createContext(new RootStore());

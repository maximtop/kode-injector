/**
 * @file
 */

import { configure } from 'mobx';
import { createContext } from 'react';

import { i18n } from '../../common/i18n';
import { TranslationStore } from '../../common/locale';
import { messenger } from '../../common/messenger';

import { DemoStore, windowSchedule } from './DemoStore';
import { InjectionsStore } from './InjectionsStore';

// Do not allow property change outside of store actions
configure({ enforceActions: 'observed' });

/**
 * Composes stores used by the options page.
 */
class RootStore {
    /**
     * Options-page injection store.
     */
    injectionsStore: InjectionsStore;

    /**
     * Safari built-in demo store.
     */
    demoStore: DemoStore;

    /**
     * Options-page locale state.
     */
    translationStore: TranslationStore;

    /**
     * Creates the options-page store graph.
     */
    constructor() {
        this.translationStore = i18n.connectStore(TranslationStore);
        this.injectionsStore = new InjectionsStore(this);
        this.demoStore = new DemoStore({
            runDemo: messenger.runDemo,
            getDemoLaunchState: messenger.getDemoLaunchState,
            schedule: windowSchedule,
        });
    }
}

/**
 * Options page root store instance type.
 */
export type RootStoreType = RootStore;

export const rootStore = createContext(new RootStore());

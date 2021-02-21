import { createContext } from 'react';
import { configure } from 'mobx';

import { InjectionsStore } from './InjectionsStore';

// Do not allow property change outside of store actions
configure({ enforceActions: 'observed' });

class RootStore {
    constructor() {
        this.injectionsStore = new InjectionsStore(this);
    }
}

export const rootStore = createContext(new RootStore());

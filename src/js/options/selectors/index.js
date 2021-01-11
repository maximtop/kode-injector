import { createSelector } from 'reselect';

export const getInjections = state => state.injections;
export const injectionsSelector = createSelector(
    getInjections,
    injections => Object.values(injections),
);

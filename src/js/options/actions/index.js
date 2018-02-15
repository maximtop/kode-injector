import { createAction } from 'redux-actions';

export const addInjection = createAction('INJECTION_ADD', injection => ({
  injection: {
    ...injection,
    state: 'active',
  },
}));
export const removeInjection = createAction('INJECTION_REMOVE');

export const toggleInjectionState = createAction('INJECTION_STATE_TOGGLE');

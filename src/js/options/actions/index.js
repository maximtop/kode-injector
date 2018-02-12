import { createAction } from 'redux-actions';
import nanoid from 'nanoid';

export const addInjection = createAction('INJECTION_ADD', injection => ({
  injection: {
    ...injection,
    state: 'active',
    id: nanoid(),
  },
}));
export const removeInjection = createAction('INJECTION_REMOVE');

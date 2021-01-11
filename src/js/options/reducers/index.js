import _ from 'lodash';
import { combineReducers } from 'redux';
import { handleActions } from 'redux-actions';
import { reducer as formReducer } from 'redux-form';
import * as actions from '../actions';

const injections = handleActions({
    [actions.addInjection](state, { payload: { injection } }) {
        const ids = Object.keys(state);
        const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
        return { ...state, [nextId]: { ...injection, id: nextId } };
    },
    [actions.removeInjection](state, { payload: { id } }) {
        return _.omit(state, id);
    },
    [actions.toggleInjectionState](state, { payload: { id } }) {
        const injection = state[id];
        const newState = injection.state === 'active' ? 'stopped' : 'active';
        const newInjection = { ...injection, state: newState };
        return { ...state, [injection.id]: newInjection };
    },
}, {});

export default combineReducers({
    form: formReducer,
    injections,
});

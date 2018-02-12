import _ from 'lodash';
import { combineReducers } from 'redux';
import { handleActions } from 'redux-actions';
import { reducer as formReducer } from 'redux-form';
import * as actions from '../actions';

const injections = handleActions({
  [actions.addInjection](state, { payload: { injection } }) {
    return { ...state, [injection.id]: injection };
  },
  [actions.removeInjection](state, { payload: { id } }) {
    return _.omit(state, id);
  },
}, {});

export default combineReducers({
  form: formReducer,
  injections,
});

import 'bootstrap/dist/css/bootstrap.min.css';
// import 'font-awesome/css/font-awesome.min.css'; // TODO resolve font-awesome including in webpack
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import throttle from 'lodash/throttle';
import reducers from './options/reducers';
import App from './options/index';
import { saveState, getState } from './helpers/chromeStorage';
import '../css/options.css';

// eslint-disable-next-line no-underscore-dangle
const reduxDevTools = window.__REDUX_DEVTOOLS_EXTENSION__;

getState().then((persistedState) => {
  const store = createStore(
    reducers,
    persistedState,
    reduxDevTools && reduxDevTools(),
  );

  store.subscribe(throttle(async () => {
    await saveState({ injections: store.getState().injections });
  }, 1000));

  render(
    <Provider store={store}>
      <App/>
    </Provider>,
    document.getElementById('container'),
  );
});


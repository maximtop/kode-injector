import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import { render } from 'react-dom';
import '../css/popup.css';
import PopUp from './popup/PopUp';
import { getState, setState } from './helpers/chromeStorage';

const toggleExtensionState = async (isActivated) => {
    await setState('isActivated', { isActivated }).then(msg => console.log(msg));
};

getState('isActivated').then(({ isActivated }) => {
    render(
        <PopUp toggleExtensionState={toggleExtensionState} isActivated={isActivated}/>,
        window.document.getElementById('app-container'),
    );
});

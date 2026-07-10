/**
 * @file
 */

import React from 'react';
import ReactDOM from 'react-dom';

import 'antd/dist/antd.css';

import { PopupApp } from './components/PopupApp';

/**
 * Mounts the popup application into the page.
 */
export const popupPage = () => {
    const root = document.getElementById('root');

    if (root) {
        ReactDOM.render(
            <PopupApp />,
            root,
        );
    }
};

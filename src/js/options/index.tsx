/**
 * @file
 */

import React from 'react';
import ReactDOM from 'react-dom';

import 'antd/dist/antd.css';

import { OptionsApp } from './components/OptionsApp';

/**
 * Mounts the options application into the page.
 */
export const optionsPage = () => {
    document.title = 'Kode Injector settings';

    const root = document.getElementById('root');

    if (root) {
        ReactDOM.render(
            <OptionsApp />,
            root,
        );
    }
};

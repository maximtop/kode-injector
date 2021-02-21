import React from 'react';
import ReactDOM from 'react-dom';

import 'antd/dist/antd.css';

import { OptionsApp } from './components/OptionsApp';

export const optionsPage = () => {
    document.title = 'Kode Injector settings';

    ReactDOM.render(
        <OptionsApp />,
        document.getElementById('root'),
    );
};

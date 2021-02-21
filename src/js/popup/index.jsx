import React from 'react';
import ReactDOM from 'react-dom';

import 'antd/dist/antd.css';

import { PopupApp } from './components/PopupApp';

export const popupPage = () => {
    document.title = 'Kode Injector popup';

    ReactDOM.render(
        <PopupApp />,
        document.getElementById('root'),
    );
};

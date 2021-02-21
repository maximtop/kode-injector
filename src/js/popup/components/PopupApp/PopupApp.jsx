import React, { useContext, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Layout } from 'antd';

import { Header } from '../Header';
import { Main } from '../Main';
import { Footer } from '../Footer';
import { rootStore } from '../../stores/RootStore';

import './popup-app.pcss';

export const PopupApp = observer(() => {
    const { settingsStore } = useContext(rootStore);

    useEffect(() => {
        settingsStore.getPopupData();
    }, []);

    if (!settingsStore.popupDataReady) {
        return null;
    }

    return (
        <Layout className="popup-app">
            <Header />
            <Main />
            <Footer />
        </Layout>
    );
});

import React, { useEffect, useContext } from 'react';
import { Layout } from 'antd';
import { observer } from 'mobx-react';

import { Header } from '../Header';
import { Footer } from '../Footer';
import { InjectionsTable } from '../InjectionsTable';
import { NewInjectionForm } from '../NewInjectionForm';
import { rootStore } from '../../stores/RootStore';

import './options-app.pcss';

export const OptionsApp = observer(() => {
    const { injectionsStore } = useContext(rootStore);

    useEffect(() => {
        injectionsStore.getOptionsData();
    }, []);

    if (!injectionsStore.optionsDataReady) {
        return null;
    }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header />
            <Layout.Content className="content">
                <NewInjectionForm />
                <InjectionsTable />
            </Layout.Content>
            <Footer />
        </Layout>
    );
});

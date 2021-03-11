import React, { useEffect, useContext } from 'react';
import { Layout, Menu } from 'antd';
import { observer } from 'mobx-react';
import { HashRouter, Switch, Route } from 'react-router-dom';

import { Header } from '../Header';
import { Footer } from '../Footer';
import { rootStore } from '../../stores/RootStore';

import './options-app.pcss';
import { Injections } from '../Injections';
import { About } from '../About';
import { Faq } from '../Faq';
import { Sider } from '../Sider';

export const OptionsApp = observer(() => {
    const { injectionsStore } = useContext(rootStore);

    useEffect(() => {
        injectionsStore.getOptionsData();
    }, []);

    if (!injectionsStore.optionsDataReady) {
        return null;
    }

    return (
        <HashRouter hashType="noslash">
            <Layout style={{ minHeight: '100vh' }}>
                <Header />
                <Layout>
                    <Sider />
                    <Layout>
                        <Layout.Content className="content">
                            <Switch>
                                <Route path="/" exact component={Injections} />
                                <Route path="/faq" component={Faq} />
                                <Route path="/about" component={About} />
                                <Route />
                            </Switch>
                        </Layout.Content>
                    </Layout>
                </Layout>
                <Footer />
            </Layout>
        </HashRouter>

    );
});

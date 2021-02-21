import React from 'react';
import { Layout } from 'antd';

import './header.pcss';

// TODO translate page title
export const Header = () => (
    <Layout.Header className="header">
        <div>
            <h1>Kode Injector</h1>
        </div>
    </Layout.Header>
);

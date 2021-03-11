import { Layout, Menu } from 'antd';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Sider = () => {
    const { pathname } = useLocation();
    return (
        <Layout.Sider width={200}>
            <Menu
                mode="inline"
                style={{ height: '100%' }}
                selectedKeys={[pathname]}
            >
                <Menu.Item key="/">
                    <Link to="/">
                        Injections
                    </Link>
                </Menu.Item>
                <Menu.Item key="faq">
                    <Link to="/faq">
                        FAQ
                    </Link>
                </Menu.Item>
                <Menu.Item key="/about">
                    <Link to="/about">
                        About
                    </Link>
                </Menu.Item>
            </Menu>
        </Layout.Sider>
    );
};

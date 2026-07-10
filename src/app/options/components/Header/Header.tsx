/**
 * @file
 */

import React from 'react';
import { Layout } from 'antd';

import { LanguageSelect } from '../LanguageSelect';

import './header.pcss';

/**
 * Renders the options page header.
 *
 * @returns Options page header element.
 */
export const Header = () => (
    <Layout.Header className="header">
        <div className="header-content">
            <h1>Kode Injector</h1>
            <LanguageSelect />
        </div>
    </Layout.Header>
);

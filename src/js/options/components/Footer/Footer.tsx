/**
 * @file
 */

import React from 'react';
import { Layout, Row } from 'antd';

/**
 * Renders the options page footer.
 *
 * @returns Options page footer element.
 */
export const Footer = () => {
    return (
        <Layout.Footer>
            <Row justify="space-between">
                <div className="copyright">
                    © maximtop, 2017-
                    {new Date().getFullYear()}
                </div>
                <div className="links">
                    <a
                        href="https://gitlab.com/maximtop/kode-injector"
                        className="github"
                        title="To fill in an issue or view source code"
                    >
                        SourceCode
                    </a>
                </div>
            </Row>
        </Layout.Footer>
    );
};

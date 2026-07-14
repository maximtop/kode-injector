/**
 * @file
 */

import React from 'react';
import { Layout, Row } from 'antd';
import { observer } from 'mobx-react';

import { PROJECT_REPOSITORY_URL } from '../../../common/constants';
import { translator } from '../../../common/translator';

/**
 * Renders the options page footer.
 *
 * @returns Options page footer element.
 */
export const Footer = observer(() => {
    return (
        <Layout.Footer>
            <Row justify="space-between">
                <div className="copyright">
                    © maximtop, 2017-
                    {new Date().getFullYear()}
                </div>
                <div className="links">
                    <a
                        href={PROJECT_REPOSITORY_URL}
                        className="github"
                        title={translator.getMessage('source_code_title')}
                    >
                        {translator.getMessage('source_code')}
                    </a>
                </div>
            </Row>
        </Layout.Footer>
    );
});

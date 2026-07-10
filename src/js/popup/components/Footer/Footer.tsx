/**
 * @file
 */

import React from 'react';
import {
    Button,
    Col,
    Layout,
    Row,
} from 'antd';
import { DislikeOutlined } from '@ant-design/icons';

import { messenger } from '../../../common/messenger';

// TODO translate

/**
 * Renders the popup footer and issue-report action.
 *
 * @returns Popup footer element.
 */
export const Footer = (): JSX.Element => {
    /**
     * Opens the issue reporting page.
     */
    const handleReportClick = (): void => {
        messenger.openTab('https://gitlab.com/maximtop/kode-injector/issues/new');
    };

    return (
        <Layout.Footer className="footer">
            <Row justify="center">
                <Col>
                    <Button
                        icon={<DislikeOutlined />}
                        onClick={handleReportClick}
                        title="Report an issue on GitLab"
                    >
                        Report an issue
                    </Button>
                </Col>
            </Row>
        </Layout.Footer>
    );
};

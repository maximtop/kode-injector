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
import { observer } from 'mobx-react';

import { messenger } from '../../../common/messenger';
import { translator } from '../../../common/translator';

/**
 * Renders the popup footer and issue-report action.
 *
 * @returns Popup footer element.
 */
export const Footer = observer((): JSX.Element => {
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
                        title={translator.getMessage('popup_report_issue_title')}
                    >
                        {translator.getMessage('popup_report_issue')}
                    </Button>
                </Col>
            </Row>
        </Layout.Footer>
    );
});

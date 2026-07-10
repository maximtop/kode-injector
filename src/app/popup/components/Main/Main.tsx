/**
 * @file
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import {
    Col,
    Layout,
    Row,
    Switch,
} from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

import { rootStore } from '../../stores/RootStore';
import { translator } from '../../../common/translator';

export const Main = observer(() => {
    const { settingsStore } = useContext(rootStore);

    /**
     * Updates injection availability for the current site.
     *
     * @param enable Whether injections should be enabled.
     */
    const handleSwitchChange = async (enable: boolean): Promise<void> => {
        if (enable) {
            await settingsStore.enableInjectionsForSite();
        } else {
            await settingsStore.disableInjectionsForSite();
        }
    };

    /**
     * Renders injection controls for the current tab.
     *
     * @returns Current-tab injection controls.
     */
    const renderSwitchForCurrentTab = (): JSX.Element => {
        // TODO button to add injection for current tab
        if (!settingsStore.siteHasEnabledInjections) {
            return (
                <div>{translator.getMessage('popup_no_injections')}</div>
            );
        }

        const enabled = !settingsStore.siteIsBlacklisted;
        return (
            <Switch
                checkedChildren={<CheckOutlined />}
                unCheckedChildren={<CloseOutlined />}
                defaultChecked={enabled}
                title={enabled
                    ? translator.getMessage('popup_disable_site')
                    : translator.getMessage('popup_enable_site')}
                onChange={handleSwitchChange}
            />
        );
    };

    return (
        <Layout.Content>
            <Row align="middle" justify="center" style={{ height: '100%' }}>
                <Col span={20} style={{ overflow: 'hidden' }}>
                    <Row justify="center">
                        <Col>
                            <h3 className="technical-value" dir="ltr">{settingsStore.currentTabHostname}</h3>
                        </Col>
                    </Row>
                    <Row justify="center">
                        <Col>
                            {renderSwitchForCurrentTab()}
                        </Col>
                    </Row>
                </Col>
            </Row>
        </Layout.Content>
    );
});

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
                <div>No injections</div>
            );
        }

        const enabled = !settingsStore.siteIsBlacklisted;
        // TODO translate messages for title
        return (
            <Switch
                checkedChildren={<CheckOutlined />}
                unCheckedChildren={<CloseOutlined />}
                defaultChecked={enabled}
                title={enabled ? 'Disable injecting for current site' : 'Enable injecting for current site'}
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
                            <h3>{settingsStore.currentTabHostname}</h3>
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

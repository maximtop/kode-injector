/**
 * @file
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import {
    Button,
    Col,
    Layout,
    Row,
} from 'antd';
import { PauseCircleOutlined, SettingOutlined, PlayCircleOutlined } from '@ant-design/icons';

import { messenger } from '../../../common/messenger';
import { rootStore } from '../../stores/RootStore';

export const Header = observer(() => {
    const { settingsStore } = useContext(rootStore);

    /**
     * Opens the extension settings page.
     */
    const handleOpenSettingsClick = (): void => {
        messenger.openSettings();
    };

    /**
     * Disables the extension globally.
     */
    const handlePauseClick = (): void => {
        settingsStore.disableApp();
    };

    /**
     * Enables the extension globally.
     */
    const handleEnableClick = (): void => {
        settingsStore.enableApp();
    };

    return (
        <Layout.Header className="header">
            <Row justify="space-between">
                <Col>
                    <h1>Kode Injector</h1>
                </Col>
                <Col>
                    {
                        settingsStore.appEnabled
                            ? (
                                <Button
                                    type="text"
                                    icon={<PauseCircleOutlined />}
                                    title="Pause injecting for all sites."
                                    onClick={handlePauseClick}
                                />
                            )
                            : (
                                <Button
                                    type="text"
                                    icon={<PlayCircleOutlined />}
                                    title="Enable injecting for all sites"
                                    onClick={handleEnableClick}
                                />
                            )
                    }

                    <Button
                        type="text"
                        icon={<SettingOutlined />}
                        title="Open settings"
                        onClick={handleOpenSettingsClick}
                    />
                </Col>
            </Row>
        </Layout.Header>
    );
});

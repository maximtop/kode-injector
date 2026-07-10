/**
 * @file
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import {
    Button,
    Layout,
} from 'antd';
import { PauseCircleOutlined, SettingOutlined, PlayCircleOutlined } from '@ant-design/icons';

import { messenger } from '../../../common/messenger';
import { rootStore } from '../../stores/RootStore';

export const Header = observer(() => {
    const { settingsStore } = useContext(rootStore);

    /**
     * Opens the extension settings page.
     */
    const handleOpenSettingsClick = async (): Promise<void> => {
        await messenger.openSettings();
    };

    /**
     * Disables the extension globally.
     */
    const handlePauseClick = async (): Promise<void> => {
        await settingsStore.disableApp();
    };

    /**
     * Enables the extension globally.
     */
    const handleEnableClick = async (): Promise<void> => {
        await settingsStore.enableApp();
    };

    return (
        <Layout.Header className="header">
            <div className="header-content">
                <h1>Kode Injector</h1>
                <div className="header-actions">
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
                </div>
            </div>
        </Layout.Header>
    );
});

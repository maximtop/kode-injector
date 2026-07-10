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
import { translator } from '../../../common/translator';
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
                                    title={translator.getMessage('popup_pause_all')}
                                    onClick={handlePauseClick}
                                />
                            )
                            : (
                                <Button
                                    type="text"
                                    icon={<PlayCircleOutlined />}
                                    title={translator.getMessage('popup_enable_all')}
                                    onClick={handleEnableClick}
                                />
                            )
                    }

                    <Button
                        type="text"
                        icon={<SettingOutlined />}
                        title={translator.getMessage('popup_open_settings')}
                        onClick={handleOpenSettingsClick}
                    />
                </div>
            </div>
        </Layout.Header>
    );
});

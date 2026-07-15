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
import { LocalSourceAccessWarning } from '../../../common/LocalSourceAccessWarning';
import { FileAccessWarning } from '../../../common/FileAccessWarning';
import { getCurrentBrowserTarget } from '../../../common/browser-target';
import { LocalSourceAccessMethod } from '../../../common/contracts';

export const Main = observer(() => {
    const { settingsStore } = useContext(rootStore);
    const browserTarget = getCurrentBrowserTarget();

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
        <Layout.Content className="popup-main">
            {settingsStore.localSourceAccess.kind === LocalSourceAccessMethod.Browser ? (
                <FileAccessWarning
                    allowed={settingsStore.localSourceAccess.allowed}
                    browserTarget={browserTarget}
                    compact
                    onCheckAgain={undefined}
                    onOpenSettings={undefined}
                />
            ) : (
                <LocalSourceAccessWarning
                    state={settingsStore.localSourceAccess}
                    compact
                    disabled={false}
                    download={undefined}
                    onCheckAgain={undefined}
                    onDownload={undefined}
                    onRequestPermission={undefined}
                    onViewAllDownloads={undefined}
                />
            )}
            <Row className="popup-main-controls" align="middle" justify="center">
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

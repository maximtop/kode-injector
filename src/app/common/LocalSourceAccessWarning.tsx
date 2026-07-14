/**
 * @file Native-host availability warning shared by Options and popup.
 */

/* eslint-disable jsdoc/require-jsdoc */

import React from 'react';
import { Alert, Button } from 'antd';

import type { LocalSourceAccessState } from './contracts';
import { NativeHostStatus } from './native-host-protocol';
import { translator } from './translator';

interface LocalSourceAccessWarningProps {
    state: LocalSourceAccessState;
    compact: boolean;
    onCheckAgain: (() => void | Promise<void>) | undefined;
    onDownload: (() => void | Promise<void>) | undefined;
}

export const LocalSourceAccessWarning = ({
    state,
    compact,
    onCheckAgain,
    onDownload,
}: LocalSourceAccessWarningProps): JSX.Element | null => {
    const statusMessages: Record<NativeHostStatus, string> = {
        [NativeHostStatus.Checking]: translator.getMessage('native_host_status_checking'),
        [NativeHostStatus.NotInstalled]: translator.getMessage('native_host_status_not_installed'),
        [NativeHostStatus.UpdateRequired]: translator.getMessage('native_host_status_update_required'),
        [NativeHostStatus.Ready]: translator.getMessage('native_host_status_ready'),
        [NativeHostStatus.Disconnected]: translator.getMessage('native_host_status_disconnected'),
        [NativeHostStatus.ReadFailed]: translator.getMessage('native_host_status_read_failed'),
    };
    const { host } = state;
    if (host.status === NativeHostStatus.Ready) {
        return null;
    }
    if (compact) {
        return (
            <Alert
                className="local-source-access-warning local-source-access-warning-compact"
                type="warning"
                showIcon
                message={translator.getMessage('popup_native_host_unavailable')}
            />
        );
    }
    return (
        <Alert
            className="local-source-access-warning"
            type="warning"
            showIcon
            message={translator.getMessage('native_host_required_title')}
            description={(
                <div className="local-source-access-warning-content">
                    <div>{translator.getMessage('native_host_explanation')}</div>
                    <div>{translator.getMessage('native_host_read_only')}</div>
                    <div>
                        {statusMessages[host.status]}
                        {host.hostVersion && (
                            <span className="technical-value" dir="ltr">
                                {' '}
                                {host.hostVersion}
                            </span>
                        )}
                    </div>
                    <div>{translator.getMessage('native_host_install_instructions')}</div>
                    <div className="local-source-access-warning-actions">
                        {onDownload && (
                            <Button size="small" type="primary" onClick={() => { onDownload(); }}>
                                {translator.getMessage('native_host_download')}
                            </Button>
                        )}
                        {onCheckAgain && (
                            <Button size="small" onClick={() => { onCheckAgain(); }}>
                                {translator.getMessage('native_host_check_again')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        />
    );
};

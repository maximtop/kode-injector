/**
 * @file Native-host availability warning shared by Options and popup.
 */

/* eslint-disable jsdoc/require-jsdoc */

import React from 'react';
import { Alert, Button } from 'antd';

import type { NativeHostAccessState } from './contracts';
import { NativeHostStatus } from './native-host-protocol';
import { translator } from './translator';

interface LocalSourceAccessWarningProps {
    state: NativeHostAccessState;
    compact: boolean;
    disabled: boolean;
    onCheckAgain: (() => void | Promise<void>) | undefined;
    onDownload: (() => void | Promise<void>) | undefined;
    onRequestPermission: (() => void | Promise<void>) | undefined;
}

export const LocalSourceAccessWarning = ({
    state,
    compact,
    disabled,
    onCheckAgain,
    onDownload,
    onRequestPermission,
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
    if (state.permissionGranted && host.status === NativeHostStatus.Ready) {
        return null;
    }
    if (host.status === NativeHostStatus.Checking) {
        return (
            <Alert
                className={compact
                    ? 'local-source-access-warning local-source-access-warning-compact'
                    : 'local-source-access-warning'}
                type="warning"
                showIcon
                message={statusMessages[NativeHostStatus.Checking]}
            />
        );
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
                    {!state.permissionGranted ? (
                        <div>{translator.getMessage('native_host_permission_required')}</div>
                    ) : (
                        <>
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
                        </>
                    )}
                    <div className="local-source-access-warning-actions">
                        {!state.permissionGranted && onRequestPermission && (
                            <Button
                                size="small"
                                type="primary"
                                disabled={disabled}
                                onClick={() => { onRequestPermission(); }}
                            >
                                {translator.getMessage('native_host_enable_permission')}
                            </Button>
                        )}
                        {state.permissionGranted && onDownload && (
                            <Button
                                size="small"
                                type="primary"
                                disabled={disabled}
                                onClick={() => { onDownload(); }}
                            >
                                {translator.getMessage('native_host_download')}
                            </Button>
                        )}
                        {onCheckAgain && (
                            <Button
                                size="small"
                                disabled={disabled}
                                onClick={() => { onCheckAgain(); }}
                            >
                                {translator.getMessage('native_host_check_again')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        />
    );
};

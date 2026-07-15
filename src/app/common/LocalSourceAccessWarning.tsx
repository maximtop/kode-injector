/**
 * @file Native-host availability warning shared by Options and popup.
 */

/* eslint-disable jsdoc/require-jsdoc */

import React from 'react';
import { Alert, Button } from 'antd';

import { BrowserTarget } from './browser-target';
import type { NativeHostAccessState } from './contracts';
import type { NativeHostDownload } from './native-host-download';
import { NativeHostStatus } from './native-host-protocol';
import { NativeHostDownloadActions } from './NativeHostDownloadActions';
import { translator } from './translator';

interface LocalSourceAccessWarningProps {
    state: NativeHostAccessState;
    browserTarget?: BrowserTarget;
    compact: boolean;
    disabled: boolean;
    download: NativeHostDownload | undefined;
    onCheckAgain: (() => void | Promise<void>) | undefined;
    onDownload: (() => void | Promise<void>) | undefined;
    onRequestPermission: (() => void | Promise<void>) | undefined;
    onUseBrowserAccess?: (() => void | Promise<void>) | undefined;
    onViewAllDownloads: (() => void | Promise<void>) | undefined;
}

export const LocalSourceAccessWarning = ({
    state,
    browserTarget = BrowserTarget.Firefox,
    compact,
    disabled,
    download,
    onCheckAgain,
    onDownload,
    onRequestPermission,
    onUseBrowserAccess,
    onViewAllDownloads,
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
    const downloadIsPrimary = state.permissionGranted
        && (host.status === NativeHostStatus.NotInstalled
            || host.status === NativeHostStatus.UpdateRequired);
    const checkAgainIsPrimary = state.permissionGranted
        && (host.status === NativeHostStatus.Disconnected
            || host.status === NativeHostStatus.ReadFailed);
    const showInstallInstructions = host.status === NativeHostStatus.NotInstalled
        || host.status === NativeHostStatus.UpdateRequired
        || host.status === NativeHostStatus.Disconnected;
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
        const canUseBrowserAccess = browserTarget !== BrowserTarget.Firefox
            && Boolean(onUseBrowserAccess);
        const compactMessage = canUseBrowserAccess
            ? translator.getMessage('popup_native_host_optional_unavailable')
            : translator.getMessage('popup_native_host_unavailable');
        return (
            <Alert
                className="local-source-access-warning local-source-access-warning-compact"
                type="warning"
                showIcon
                message={(
                    <div className="local-source-access-warning-compact-content">
                        <span>
                            {compactMessage}
                        </span>
                        {canUseBrowserAccess && (
                            <Button
                                size="small"
                                disabled={disabled}
                                onClick={() => { onUseBrowserAccess?.(); }}
                            >
                                {translator.getMessage('local_source_method_use_browser')}
                            </Button>
                        )}
                    </div>
                )}
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
                            {showInstallInstructions && (
                                <div>
                                    {translator.getMessage('native_host_install_instructions')}
                                </div>
                            )}
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
                        {download && (
                            <NativeHostDownloadActions
                                download={download}
                                disabled={disabled}
                                primary={downloadIsPrimary}
                                onDownload={onDownload}
                                onViewAllDownloads={onViewAllDownloads}
                            />
                        )}
                        {onCheckAgain && (
                            <Button
                                size="small"
                                type={checkAgainIsPrimary ? 'primary' : 'default'}
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

LocalSourceAccessWarning.defaultProps = {
    browserTarget: BrowserTarget.Firefox,
    onUseBrowserAccess: undefined,
};

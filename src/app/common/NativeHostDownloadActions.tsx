/**
 * @file Shared Kode Injector Helper download controls.
 */

/* eslint-disable jsdoc/require-jsdoc */

import React from 'react';
import { Button } from 'antd';

import {
    NativeHostDownload,
    NativeHostDownloadKind,
    NativeHostPackageTarget,
} from './native-host-download';
import { translator } from './translator';

interface NativeHostDownloadActionsProps {
    download: NativeHostDownload;
    disabled: boolean;
    primary: boolean;
    onDownload: (() => void | Promise<void>) | undefined;
    onViewAllDownloads: (() => void | Promise<void>) | undefined;
}

const getTargetMessage = (target: NativeHostPackageTarget): string => {
    switch (target) {
        case NativeHostPackageTarget.MacOSAppleSilicon:
            return translator.getMessage('native_helper_target_macos_apple_silicon');
        case NativeHostPackageTarget.MacOSIntel:
            return translator.getMessage('native_helper_target_macos_intel');
        case NativeHostPackageTarget.WindowsArm64:
            return translator.getMessage('native_helper_target_windows_arm64');
        case NativeHostPackageTarget.WindowsX8664:
            return translator.getMessage('native_helper_target_windows_x86_64');
        case NativeHostPackageTarget.LinuxArm64:
            return translator.getMessage('native_helper_target_linux_arm64');
        case NativeHostPackageTarget.LinuxX8664:
            return translator.getMessage('native_helper_target_linux_x86_64');
        default:
            throw new Error(`Unsupported Kode Injector Helper target: ${target}`);
    }
};

export const NativeHostDownloadActions = ({
    download,
    disabled,
    primary,
    onDownload,
    onViewAllDownloads,
}: NativeHostDownloadActionsProps): JSX.Element | null => {
    if (!onDownload && !onViewAllDownloads) {
        return null;
    }

    const { target } = download;
    const isDirect = download.kind === NativeHostDownloadKind.Direct
        && target !== undefined;
    const targetMessage = isDirect
        ? getTargetMessage(target)
        : translator.getMessage('native_helper_download_unsupported');
    const primaryActionMessage = isDirect
        ? translator.getMessage('native_helper_download_or_update')
        : translator.getMessage('native_helper_view_all_downloads');

    return (
        <div className="native-helper-download-actions">
            <span className="native-helper-download-target">{targetMessage}</span>
            <div className="native-helper-download-buttons">
                {onDownload && (
                    <Button
                        size="small"
                        type={primary ? 'primary' : 'default'}
                        disabled={disabled}
                        onClick={() => { onDownload(); }}
                    >
                        {primaryActionMessage}
                    </Button>
                )}
                {isDirect && onViewAllDownloads && (
                    <Button
                        size="small"
                        disabled={disabled}
                        onClick={() => { onViewAllDownloads(); }}
                    >
                        {translator.getMessage('native_helper_view_all_downloads')}
                    </Button>
                )}
            </div>
        </div>
    );
};

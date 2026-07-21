/**
 * @file Card offering the platform-matched Kode Injector Helper download.
 */

import React from 'react';
import { Button } from '@mantine/core';

import {
    NativeHostDownloadKind,
    NativeHostPackageTarget,
    type NativeHostDownload,
} from '../../../common/native-host-download';
import { translator } from '../../../common/translator';

/**
 * Maps helper package targets to their translated labels.
 *
 * @param target Package target.
 *
 * @returns Translated package label.
 */
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
            return translator.getMessage('native_helper_download_or_update');
    }
};

/**
 * HelperDownloadCard props.
 */
interface HelperDownloadCardProps {
    /**
     * Resolved helper download destination.
     */
    download: NativeHostDownload;

    /**
     * Whether actions are temporarily disabled.
     */
    disabled: boolean;

    /**
     * Opens the resolved download.
     */
    onDownload: () => void;

    /**
     * Opens the complete downloads list.
     */
    onViewAllDownloads: () => void;
}

/**
 * Renders the helper download card.
 *
 * @param props HelperDownloadCard props.
 *
 * @returns Download card element.
 */
export const HelperDownloadCard = ({
    download,
    disabled,
    onDownload,
    onViewAllDownloads,
}: HelperDownloadCardProps): React.JSX.Element => {
    const isDirect = download.kind === NativeHostDownloadKind.Direct && download.target;
    const title = isDirect && download.target
        ? getTargetMessage(download.target)
        : translator.getMessage('native_helper_download_or_update');
    const description = isDirect
        ? translator.getMessage('native_host_read_only')
        : translator.getMessage('native_helper_download_unsupported');

    return (
        <div className="download-card" data-testid="helper-download-card">
            <span className="download-card-body">
                <span className="download-card-title">{title}</span>
                <span className="download-card-desc">{description}</span>
            </span>
            <Button
                variant="filled"
                size="xs"
                disabled={disabled}
                onClick={onDownload}
            >
                {translator.getMessage('helper_download')}
            </Button>
            <button
                type="button"
                className="link-btn"
                disabled={disabled}
                onClick={onViewAllDownloads}
            >
                {translator.getMessage('native_helper_view_all_downloads')}
            </button>
        </div>
    );
};

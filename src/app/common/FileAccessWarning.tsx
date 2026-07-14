/**
 * @file
 */

import React from 'react';
import { Alert, Button } from 'antd';

import { BrowserTarget } from './browser-target';
import { translator } from './translator';

const FILE_ACCESS_IMAGES: Record<BrowserTarget, string> = {
    [BrowserTarget.Chrome]: 'assets/img/chrome-local-file-access.png',
    [BrowserTarget.Edge]: 'assets/img/edge-local-file-access.png',
    [BrowserTarget.Firefox]: 'assets/img/firefox-local-file-access.png',
};

/**
 * Local-file permission warning properties.
 */
interface FileAccessWarningProps {
    /**
     * Whether local-file access is currently allowed.
     */
    allowed: boolean;

    /**
     * Browser receiving the relevant instructions.
     */
    browserTarget: BrowserTarget;

    /**
     * Whether to use the compact popup presentation.
     */
    compact: boolean;

    /**
     * Rechecks browser permission from the full warning.
     */
    onCheckAgain: (() => void | Promise<void>) | undefined;

    /**
     * Opens the browser's extension settings when supported.
     */
    onOpenSettings: (() => void | Promise<void>) | undefined;
}

/**
 * Renders guidance when browser local-file access is disabled.
 *
 * @param props Warning presentation properties.
 *
 * @returns Permission warning or null when access is allowed.
 */
export const FileAccessWarning = ({
    allowed,
    browserTarget,
    compact,
    onCheckAgain,
    onOpenSettings,
}: FileAccessWarningProps): JSX.Element | null => {
    if (allowed) {
        return null;
    }

    if (compact) {
        return (
            <Alert
                className="file-access-warning file-access-warning-compact"
                type="warning"
                showIcon
                message={translator.getMessage('popup_file_access_disabled')}
            />
        );
    }

    return (
        <Alert
            className="file-access-warning"
            type="warning"
            showIcon
            message={translator.getMessage('file_access_disabled')}
            description={(
                <div className="file-access-warning-instructions">
                    <div className="file-access-warning-guidance">
                        <div>{translator.getMessage('file_access_instructions')}</div>
                        <div className="file-access-warning-actions">
                            {onOpenSettings && (
                                <Button size="small" onClick={() => { onOpenSettings(); }}>
                                    {translator.getMessage('file_access_open_extension_settings')}
                                </Button>
                            )}
                            {onCheckAgain && (
                                <Button size="small" onClick={() => { onCheckAgain(); }}>
                                    {translator.getMessage('file_access_check_again')}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className={`file-access-warning-image-frame file-access-warning-image-frame-${browserTarget}`}>
                        <img
                            className={`file-access-warning-image file-access-warning-image-${browserTarget}`}
                            src={FILE_ACCESS_IMAGES[browserTarget]}
                            alt={translator.getMessage('file_access_instructions')}
                        />
                    </div>
                </div>
            )}
        />
    );
};

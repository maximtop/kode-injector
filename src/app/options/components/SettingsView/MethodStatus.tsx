/**
 * @file Status of the selected local-file access method.
 */

import React from 'react';
import classNames from 'classnames';
import { Button } from '@mantine/core';

import { BrowserTarget } from '../../../common/browser-target';
import {
    LocalSourceAccessMethod,
    type LocalSourceAccessState,
} from '../../../common/contracts';
import { NativeHostStatus } from '../../../common/native-host-protocol';
import { translator } from '../../../common/translator';

/**
 * Screenshots explaining the browser file-URL toggle per browser.
 */
const FILE_ACCESS_IMAGES: Record<BrowserTarget, string> = {
    [BrowserTarget.Chrome]: 'assets/img/chrome-local-file-access.png',
    [BrowserTarget.Edge]: 'assets/img/edge-local-file-access.png',
    [BrowserTarget.Firefox]: 'assets/img/firefox-local-file-access.png',
};

/**
 * MethodStatus props.
 */
interface MethodStatusProps {
    /**
     * Current local-source access state.
     */
    state: LocalSourceAccessState;

    /**
     * Browser hosting the extension.
     */
    browserTarget: BrowserTarget;

    /**
     * Whether a method transition is in progress.
     */
    disabled: boolean;

    /**
     * Inline description of the last failed method change, if any.
     */
    methodChangeError: string | null;

    /**
     * Rechecks the selected method.
     */
    onCheckAgain: () => void;

    /**
     * Opens the browser's extension settings, when supported.
     */
    onOpenExtensionSettings: (() => void) | undefined;

    /**
     * Requests the optional native-messaging permission.
     */
    onRequestPermission: () => void;
}

/**
 * Visual tone of the method status box.
 */
type StatusTone = 'ok' | 'warn' | 'pending';

/**
 * Derives the status line for the current method.
 *
 * @param state Current local-source access state.
 *
 * @returns Tone and localized status text.
 */
const getStatusPresentation = (state: LocalSourceAccessState): {
    tone: StatusTone;
    text: string;
    hostVersion?: string;
} => {
    if (state.kind === LocalSourceAccessMethod.Browser) {
        return state.allowed
            ? { tone: 'ok', text: translator.getMessage('settings_browser_access_ok') }
            : { tone: 'warn', text: translator.getMessage('settings_browser_access_off') };
    }

    if (!state.permissionGranted) {
        return { tone: 'warn', text: translator.getMessage('native_host_permission_required') };
    }

    const statusMessages: Record<NativeHostStatus, string> = {
        [NativeHostStatus.Checking]: translator.getMessage('native_host_status_checking'),
        [NativeHostStatus.NotInstalled]: translator.getMessage('native_host_status_not_installed'),
        [NativeHostStatus.UpdateRequired]: translator.getMessage('native_host_status_update_required'),
        [NativeHostStatus.Ready]: translator.getMessage('native_host_status_ready'),
        [NativeHostStatus.Disconnected]: translator.getMessage('native_host_status_disconnected'),
        [NativeHostStatus.ReadFailed]: translator.getMessage('native_host_status_read_failed'),
    };

    const tones: Partial<Record<NativeHostStatus, StatusTone>> = {
        [NativeHostStatus.Ready]: 'ok',
        [NativeHostStatus.Checking]: 'pending',
    };

    return {
        tone: tones[state.host.status] ?? 'warn',
        text: statusMessages[state.host.status],
        hostVersion: state.host.hostVersion,
    };
};

/**
 * Renders the status box of the selected access method.
 *
 * @param props MethodStatus props.
 *
 * @returns Method status element.
 */
export const MethodStatus = ({
    state,
    browserTarget,
    disabled,
    methodChangeError,
    onCheckAgain,
    onOpenExtensionSettings,
    onRequestPermission,
}: MethodStatusProps): React.JSX.Element => {
    const presentation = getStatusPresentation(state);
    const isBrowserBlocked = state.kind === LocalSourceAccessMethod.Browser && !state.allowed;
    const needsPermission = state.kind === LocalSourceAccessMethod.NativeHost
        && !state.permissionGranted;

    return (
        <div>
            <div
                className={classNames('method-status', {
                    warn: presentation.tone === 'warn',
                    pending: presentation.tone === 'pending',
                })}
                data-testid="method-status"
            >
                <span className="method-status-dot" />
                <span className="method-status-text">
                    {presentation.text}
                    {presentation.hostVersion && (
                        <span className="mono">
                            {' '}
                            {presentation.hostVersion}
                        </span>
                    )}
                </span>
                {needsPermission && (
                    <Button
                        variant="filled"
                        size="xs"
                        disabled={disabled}
                        onClick={onRequestPermission}
                    >
                        {translator.getMessage('native_host_enable_permission')}
                    </Button>
                )}
                {isBrowserBlocked && onOpenExtensionSettings && (
                    <Button
                        variant="filled"
                        size="xs"
                        disabled={disabled}
                        onClick={onOpenExtensionSettings}
                    >
                        {translator.getMessage('file_access_open_extension_settings')}
                    </Button>
                )}
                <Button
                    variant="default"
                    size="xs"
                    disabled={disabled}
                    onClick={onCheckAgain}
                >
                    {translator.getMessage('native_host_check_again')}
                </Button>
            </div>
            {methodChangeError && (
                <p className="method-status-error" role="alert">{methodChangeError}</p>
            )}
            {isBrowserBlocked && (
                <details className="method-status-details">
                    <summary>{translator.getMessage('settings_show_me_where')}</summary>
                    <div className="method-status-instructions">
                        <span>{translator.getMessage('file_access_instructions')}</span>
                        <img
                            src={FILE_ACCESS_IMAGES[browserTarget]}
                            alt={translator.getMessage('file_access_instructions')}
                        />
                    </div>
                </details>
            )}
        </div>
    );
};

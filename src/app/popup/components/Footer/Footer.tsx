/**
 * @file
 */

import React from 'react';
import browser from 'webextension-polyfill';

import { messenger } from '../../../common/messenger';
import { translator } from '../../../common/translator';
import { IconGear } from '../../../common/components/icons';

/**
 * Renders the popup footer with the options link and version.
 *
 * @returns Popup footer element.
 */
export const Footer = (): React.JSX.Element => {
    const { version } = browser.runtime.getManifest();

    /**
     * Opens the extension settings page.
     */
    const handleOpenSettingsClick = async (): Promise<void> => {
        await messenger.openSettings();
    };

    return (
        <footer className="p-foot">
            <button
                type="button"
                onClick={handleOpenSettingsClick}
                title={translator.getMessage('popup_open_settings')}
            >
                <IconGear size={13} />
                {translator.getMessage('popup_options')}
            </button>
            <span>{`v${version}`}</span>
        </footer>
    );
};

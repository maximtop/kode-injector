/**
 * @file
 */

import React from 'react';
import browser from 'webextension-polyfill';

import { PROJECT_REPOSITORY_URL } from '../../../common/constants';
import { translator } from '../../../common/translator';

/**
 * Renders the options page footer.
 *
 * @returns Options page footer element.
 */
export const Footer = (): React.JSX.Element => {
    const { version } = browser.runtime.getManifest();

    return (
        <footer className="page-foot">
            <span>
                {`Kode Injector v${version}`}
            </span>
            <a
                href={PROJECT_REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                title={translator.getMessage('source_code_title')}
            >
                {translator.getMessage('source_code')}
            </a>
        </footer>
    );
};

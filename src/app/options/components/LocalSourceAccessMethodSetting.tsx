/**
 * @file Local-source access method selector for the options page.
 */

import React from 'react';
import { Radio } from 'antd';

import { BrowserTarget } from '../../common/browser-target';
import { LocalSourceAccessMethod } from '../../common/contracts';
import { NativeHostDownload } from '../../common/native-host-download';
import { NativeHostDownloadActions } from '../../common/NativeHostDownloadActions';
import { translator } from '../../common/translator';

/**
 * Local-source access setting properties.
 */
interface LocalSourceAccessMethodSettingProps {
    /**
     * Browser hosting the options page.
     */
    browserTarget: BrowserTarget;

    /**
     * Currently selected source access method.
     */
    method: LocalSourceAccessMethod;

    /**
     * Whether a method transition is being persisted.
     */
    disabled: boolean;

    /**
     * Helper download selected for the current platform.
     */
    download: NativeHostDownload;

    /**
     * Updates the selected method in Chromium.
     */
    onChange(method: LocalSourceAccessMethod): void | Promise<void>;

    /**
     * Opens the selected Helper package.
     */
    onDownloadNativeHost(): void | Promise<void>;

    /**
     * Opens the complete list of Helper packages.
     */
    onViewAllDownloads(): void | Promise<void>;
}

/**
 * Renders a Chromium choice or Firefox's fixed native-host method.
 *
 * @param props Setting state and action.
 *
 * @returns Local-source access method setting.
 */
export const LocalSourceAccessMethodSetting = ({
    browserTarget,
    method,
    disabled,
    download,
    onChange,
    onDownloadNativeHost,
    onViewAllDownloads,
}: LocalSourceAccessMethodSettingProps): JSX.Element => {
    const title = translator.getMessage('local_source_method');
    const downloadActions = (
        <NativeHostDownloadActions
            download={download}
            disabled={disabled}
            primary={false}
            onDownload={onDownloadNativeHost}
            onViewAllDownloads={onViewAllDownloads}
        />
    );

    if (browserTarget === BrowserTarget.Firefox) {
        return (
            <section className="local-source-method-setting" aria-label={title}>
                <div className="local-source-method-setting-control">
                    <strong>{title}</strong>
                    <span>{translator.getMessage('local_source_method_native_host')}</span>
                </div>
                <div className="local-source-method-setting-description">
                    {translator.getMessage('native_host_explanation')}
                </div>
                {downloadActions}
            </section>
        );
    }

    return (
        <section className="local-source-method-setting" aria-label={title}>
            <div className="local-source-method-setting-control">
                <strong>{title}</strong>
                <Radio.Group
                    aria-label={title}
                    disabled={disabled}
                    value={method}
                    onChange={(event) => {
                        onChange(event.target.value as LocalSourceAccessMethod);
                    }}
                >
                    <Radio value={LocalSourceAccessMethod.Browser}>
                        {translator.getMessage('local_source_method_browser')}
                    </Radio>
                    <Radio value={LocalSourceAccessMethod.NativeHost}>
                        {translator.getMessage('local_source_method_native_host')}
                    </Radio>
                </Radio.Group>
            </div>
            <div className="local-source-method-setting-description">
                {method === LocalSourceAccessMethod.Browser
                    ? translator.getMessage('local_source_method_browser_description')
                    : translator.getMessage('local_source_method_native_host_description')}
            </div>
            {method === LocalSourceAccessMethod.NativeHost && downloadActions}
        </section>
    );
};

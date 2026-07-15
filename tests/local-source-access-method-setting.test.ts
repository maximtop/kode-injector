/**
 * @file
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { BrowserTarget } from '../src/app/common/browser-target';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import {
    NativeHostDownloadKind,
    NativeHostPackageTarget,
} from '../src/app/common/native-host-download';
import { LocalSourceAccessMethodSetting } from '../src/app/options/components/LocalSourceAccessMethodSetting';

vi.mock('../src/app/common/translator', () => ({
    translator: { getMessage: (key: string) => key },
}));

vi.mock('webextension-polyfill', () => ({
    default: { runtime: {} },
}));

const directDownload = {
    kind: NativeHostDownloadKind.Direct,
    url: 'https://example.test/helper.dmg',
    target: NativeHostPackageTarget.MacOSAppleSilicon,
};

const renderMethodSetting = (
    browserTarget: BrowserTarget,
    method: LocalSourceAccessMethod,
): string => renderToStaticMarkup(React.createElement(
    LocalSourceAccessMethodSetting,
    {
        browserTarget,
        method,
        disabled: false,
        download: directDownload,
        onChange: vi.fn(),
        onDownloadNativeHost: vi.fn(),
        onViewAllDownloads: vi.fn(),
    },
));

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    '%s keeps browser access primary and hides Native Host in Advanced',
    (browserTarget) => {
        const html = renderToStaticMarkup(React.createElement(
            LocalSourceAccessMethodSetting,
            {
                browserTarget,
                method: LocalSourceAccessMethod.Browser,
                disabled: false,
                download: directDownload,
                onChange: vi.fn(),
                onDownloadNativeHost: vi.fn(),
                onViewAllDownloads: vi.fn(),
            },
        ));

        expect(html).toContain('local_source_method');
        expect(html).toContain('local_source_method_browser');
        expect(html).toContain('local_source_method_browser_description');
        expect(html).toContain('local_source_method_advanced');
        expect(html).toContain('local_source_method_native_host_description');
        expect(html).toContain('local_source_method_use_native_host');
        expect(html).toMatch(/<details[^>]*class="local-source-method-setting-advanced"/u);
        expect(html).not.toMatch(/<details[^>]*open=""/u);
        expect(html).not.toContain('ant-radio-group');
        expect(html).toContain('aria-label="local_source_method"');
    },
);

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    '%s expands Advanced and offers browser access when Native Host is selected',
    (browserTarget) => {
        const html = renderToStaticMarkup(React.createElement(
            LocalSourceAccessMethodSetting,
            {
                browserTarget,
                method: LocalSourceAccessMethod.NativeHost,
                disabled: false,
                download: directDownload,
                onChange: vi.fn(),
                onDownloadNativeHost: vi.fn(),
                onViewAllDownloads: vi.fn(),
            },
        ));

        expect(html).toContain('local_source_method_native_host_description');
        expect(html).not.toContain('local_source_method_browser_description');
        expect(html).toContain('local_source_method_use_browser');
        expect(html).toMatch(/<details[^>]*class="local-source-method-setting-advanced"[^>]*open=""/u);
    },
);

test('Firefox renders native-host mode without a selector', () => {
    const html = renderToStaticMarkup(React.createElement(
        LocalSourceAccessMethodSetting,
        {
            browserTarget: BrowserTarget.Firefox,
            method: LocalSourceAccessMethod.NativeHost,
            disabled: false,
            download: directDownload,
            onChange: vi.fn(),
            onDownloadNativeHost: vi.fn(),
            onViewAllDownloads: vi.fn(),
        },
    ));

    expect(html).toContain('local_source_method_native_host');
    expect(html).toContain('native_host_explanation');
    expect(html).not.toContain('local_source_method_native_host_description');
    expect(html).not.toContain('local_source_method_browser');
    expect(html).not.toContain('local_source_method_advanced');
    expect(html).not.toContain('ant-radio-group');
});

test('Firefox retains helper management actions', () => {
    const html = renderMethodSetting(
        BrowserTarget.Firefox,
        LocalSourceAccessMethod.NativeHost,
    );

    expect(html).toContain('native_helper_download_or_update');
    expect(html).toContain('native_helper_view_all_downloads');
});

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    '%s browser-file mode hides helper actions',
    (browserTarget) => {
        const html = renderMethodSetting(
            browserTarget,
            LocalSourceAccessMethod.Browser,
        );

        expect(html).not.toContain('native_helper_download_or_update');
        expect(html).not.toContain('native_helper_view_all_downloads');
    },
);

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    '%s native-host mode retains helper management actions',
    (browserTarget) => {
        const html = renderMethodSetting(
            browserTarget,
            LocalSourceAccessMethod.NativeHost,
        );

        expect(html).toContain('native_helper_download_or_update');
        expect(html).toContain('native_helper_view_all_downloads');
    },
);

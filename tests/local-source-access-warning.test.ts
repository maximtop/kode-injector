/**
 * @file
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { LocalSourceAccessWarning } from '../src/app/common/LocalSourceAccessWarning';
import { BrowserTarget } from '../src/app/common/browser-target';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import {
    NativeHostDownloadKind,
    NativeHostPackageTarget,
} from '../src/app/common/native-host-download';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

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

const allDownloads = {
    kind: NativeHostDownloadKind.AllDownloads,
    url: 'https://example.test/releases',
};

test('ready native host renders no warning', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
        },
        compact: false,
        disabled: false,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));
    expect(html).toBe('');
});

test('full warning explains and offers download and recheck actions', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.NotInstalled },
        },
        compact: false,
        disabled: false,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));
    expect(html).toContain('native_host_required_title');
    expect(html).toContain('native_host_explanation');
    expect(html).toContain('native_host_read_only');
    expect(html).toContain('native_helper_download_or_update');
    expect(html).toContain('native_helper_view_all_downloads');
    expect(html).toContain('native_helper_target_macos_apple_silicon');
    expect(html).toContain('native_host_check_again');
    expect(html).not.toContain('local-file-access.png');
});

test('compact warning keeps actions out of the popup', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.Disconnected },
        },
        compact: true,
        disabled: false,
        download: directDownload,
        onCheckAgain: undefined,
        onDownload: undefined,
        onRequestPermission: undefined,
        onViewAllDownloads: undefined,
    }));
    expect(html).toContain('popup_native_host_unavailable');
    expect(html).not.toContain('native_host_download');
    expect(html).not.toContain('native_host_check_again');
});

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    '%s compact warning offers an explicit return to browser access',
    (browserTarget) => {
        const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
            state: {
                kind: LocalSourceAccessMethod.NativeHost,
                permissionGranted: true,
                host: { status: NativeHostStatus.NotInstalled },
            },
            browserTarget,
            compact: true,
            disabled: false,
            download: undefined,
            onCheckAgain: undefined,
            onDownload: undefined,
            onRequestPermission: undefined,
            onUseBrowserAccess: vi.fn(),
            onViewAllDownloads: undefined,
        }));

        expect(html).toContain('popup_native_host_optional_unavailable');
        expect(html).toContain('local_source_method_use_browser');
        expect(html).not.toContain('popup_native_host_unavailable');
    },
);

test('Firefox compact warning does not offer browser access', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.NotInstalled },
        },
        browserTarget: BrowserTarget.Firefox,
        compact: true,
        disabled: false,
        download: undefined,
        onCheckAgain: undefined,
        onDownload: undefined,
        onRequestPermission: undefined,
        onUseBrowserAccess: undefined,
        onViewAllDownloads: undefined,
    }));

    expect(html).toContain('popup_native_host_unavailable');
    expect(html).not.toContain('local_source_method_use_browser');
});

test.each([false, true])(
    'checking state renders only its status when compact is %s',
    (compact) => {
        const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
            state: {
                kind: LocalSourceAccessMethod.NativeHost,
                permissionGranted: true,
                host: { status: NativeHostStatus.Checking },
            },
            compact,
            disabled: false,
            download: directDownload,
            onCheckAgain: vi.fn(),
            onDownload: vi.fn(),
            onRequestPermission: vi.fn(),
            onViewAllDownloads: vi.fn(),
        }));

        expect(html).toContain('native_host_status_checking');
        expect(html).not.toContain('native_host_required_title');
        expect(html).not.toContain('native_host_explanation');
        expect(html).not.toContain('native_host_read_only');
        expect(html).not.toContain('native_host_install_instructions');
        expect(html).not.toContain('native_helper_download_or_update');
        expect(html).not.toContain('native_host_check_again');
        expect(html).not.toContain('native_host_enable_permission');
    },
);

test('update warning includes the detected host version', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.UpdateRequired, hostVersion: '0.7.0' },
        },
        compact: false,
        disabled: false,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));
    expect(html).toContain('native_host_status_update_required');
    expect(html).toContain('0.7.0');
});

test('missing optional permission offers a direct permission action', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: false,
            host: { status: NativeHostStatus.NotInstalled },
        },
        compact: false,
        disabled: false,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));

    expect(html).toContain('native_host_permission_required');
    expect(html).toContain('native_host_enable_permission');
    expect(html).toContain('native_helper_download_or_update');
    expect(html).toContain('native_helper_view_all_downloads');
});

test('pending transition disables the optional permission action', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: false,
            host: { status: NativeHostStatus.NotInstalled },
        },
        compact: false,
        disabled: true,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));

    expect(html).toContain('native_host_enable_permission');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*native_host_enable_permission/su);
});

test('not-installed state prioritizes the download action', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.NotInstalled },
        },
        compact: false,
        disabled: false,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));

    expect(html).toMatch(
        /<button[^>]*ant-btn-primary[^>]*><span>native_helper_download_or_update/su,
    );
    expect(html).not.toMatch(
        /<button[^>]*ant-btn-primary[^>]*><span>native_host_check_again/su,
    );
});

test('fallback download keeps a single primary path to all downloads', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.NotInstalled },
        },
        compact: false,
        disabled: false,
        download: allDownloads,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));

    expect(html).toContain('native_helper_download_unsupported');
    expect(html).toMatch(
        /<button[^>]*ant-btn-primary[^>]*><span>native_helper_view_all_downloads/su,
    );
    expect(html.match(/native_helper_view_all_downloads/gu)).toHaveLength(1);
});

test('disconnected state prioritizes retry and keeps download secondary', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.Disconnected },
        },
        compact: false,
        disabled: false,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));

    expect(html).toMatch(
        /<button[^>]*ant-btn-primary[^>]*><span>native_host_check_again/su,
    );
    expect(html).not.toMatch(
        /<button[^>]*ant-btn-primary[^>]*><span>native_helper_download_or_update/su,
    );
});

test('read failure emphasizes the file problem rather than install instructions', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.ReadFailed },
        },
        compact: false,
        disabled: false,
        download: directDownload,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
        onViewAllDownloads: vi.fn(),
    }));

    expect(html).toContain('native_host_status_read_failed');
    expect(html).not.toContain('native_host_install_instructions');
});

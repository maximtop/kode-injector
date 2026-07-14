/**
 * @file
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { LocalSourceAccessWarning } from '../src/app/common/LocalSourceAccessWarning';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

vi.mock('../src/app/common/translator', () => ({
    translator: { getMessage: (key: string) => key },
}));

test('ready native host renders no warning', () => {
    const html = renderToStaticMarkup(React.createElement(LocalSourceAccessWarning, {
        state: {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
        },
        compact: false,
        disabled: false,
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
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
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
    }));
    expect(html).toContain('native_host_required_title');
    expect(html).toContain('native_host_explanation');
    expect(html).toContain('native_host_read_only');
    expect(html).toContain('native_host_download');
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
        onCheckAgain: undefined,
        onDownload: undefined,
        onRequestPermission: undefined,
    }));
    expect(html).toContain('popup_native_host_unavailable');
    expect(html).not.toContain('native_host_download');
    expect(html).not.toContain('native_host_check_again');
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
            onCheckAgain: vi.fn(),
            onDownload: vi.fn(),
            onRequestPermission: vi.fn(),
        }));

        expect(html).toContain('native_host_status_checking');
        expect(html).not.toContain('native_host_required_title');
        expect(html).not.toContain('native_host_explanation');
        expect(html).not.toContain('native_host_read_only');
        expect(html).not.toContain('native_host_install_instructions');
        expect(html).not.toContain('native_host_download');
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
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
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
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
    }));

    expect(html).toContain('native_host_permission_required');
    expect(html).toContain('native_host_enable_permission');
    expect(html).not.toContain('native_host_download');
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
        onCheckAgain: vi.fn(),
        onDownload: vi.fn(),
        onRequestPermission: vi.fn(),
    }));

    expect(html).toContain('native_host_enable_permission');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*native_host_enable_permission/su);
});

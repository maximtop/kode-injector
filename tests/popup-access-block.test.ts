/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { BrowserTarget } from '../src/app/common/browser-target';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';
import { getAccessBlockState } from '../src/app/popup/components/AccessBlock/access-block-state';

vi.mock('../src/app/common/translator', () => ({
    translator: { getMessage: (key: string) => key },
}));

const browserAllowed = {
    kind: LocalSourceAccessMethod.Browser,
    allowed: true,
} as const;

const browserBlocked = {
    kind: LocalSourceAccessMethod.Browser,
    allowed: false,
} as const;

const nativeState = (status: NativeHostStatus, permissionGranted = true) => ({
    kind: LocalSourceAccessMethod.NativeHost,
    permissionGranted,
    host: { status },
} as const);

test('healthy browser access renders no notice', () => {
    expect(getAccessBlockState(browserAllowed, BrowserTarget.Chrome)).toBeNull();
});

test('blocked browser access offers opening settings', () => {
    expect(getAccessBlockState(browserBlocked, BrowserTarget.Chrome)).toEqual({
        message: 'popup_file_access_disabled',
        actionLabel: 'popup_enable_file_access',
        action: 'openSettings',
    });
});

test.each([
    NativeHostStatus.Ready,
    NativeHostStatus.Checking,
])('native host %s renders no notice', (status) => {
    expect(getAccessBlockState(nativeState(status), BrowserTarget.Chrome)).toBeNull();
});

test.each([
    NativeHostStatus.NotInstalled,
    NativeHostStatus.UpdateRequired,
    NativeHostStatus.Disconnected,
    NativeHostStatus.ReadFailed,
])('broken native host %s offers browser access on Chromium', (status) => {
    expect(getAccessBlockState(nativeState(status), BrowserTarget.Chrome)).toEqual({
        message: 'popup_native_host_optional_unavailable',
        actionLabel: 'local_source_method_use_browser',
        action: 'useBrowserAccess',
    });
});

test('broken native host offers helper installation on Firefox', () => {
    expect(getAccessBlockState(
        nativeState(NativeHostStatus.NotInstalled),
        BrowserTarget.Firefox,
    )).toEqual({
        message: 'popup_native_host_unavailable',
        actionLabel: 'popup_install_helper',
        action: 'openSettings',
    });
});

test('missing native permission renders a notice even when the host is ready', () => {
    expect(getAccessBlockState(
        nativeState(NativeHostStatus.Ready, false),
        BrowserTarget.Chrome,
    )).not.toBeNull();
});

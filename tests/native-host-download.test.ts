/**
 * @file
 */

import { afterEach, expect, test, vi } from 'vitest';

import { NATIVE_HOST_ALL_DOWNLOADS_URL } from '../src/app/common/constants';
import { getNativeHostPublishedAsset } from '../src/app/common/native-host-artifacts';
import {
    NativeHostDownloadKind,
    NativeHostPackageTarget,
    resolveCurrentNativeHostDownload,
    resolveNativeHostDownload,
} from '../src/app/common/native-host-download';

vi.mock('webextension-polyfill', () => ({
    default: {
        runtime: {
            getManifest: vi.fn(),
            getPlatformInfo: vi.fn(),
        },
    },
}));

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

test.each([
    [
        'mac',
        'arm64',
        NativeHostPackageTarget.MacOSAppleSilicon,
    ],
    [
        'mac',
        'x86-64',
        NativeHostPackageTarget.MacOSIntel,
    ],
    [
        'win',
        'arm64',
        NativeHostPackageTarget.WindowsArm64,
    ],
    [
        'win',
        'x86-64',
        NativeHostPackageTarget.WindowsX8664,
    ],
    [
        'linux',
        'arm64',
        NativeHostPackageTarget.LinuxArm64,
    ],
    [
        'linux',
        'x86-64',
        NativeHostPackageTarget.LinuxX8664,
    ],
] as const)('%s/%s resolves its published asset', (os, arch, target) => {
    const assetName = getNativeHostPublishedAsset(target).name;
    expect(resolveNativeHostDownload('0.8.2', { os, arch })).toEqual({
        kind: NativeHostDownloadKind.Direct,
        url: `https://github.com/maximtop/kode-injector/releases/download/v0.8.2/${assetName}`,
        target,
    });
});

test.each([
    '',
    '0.8',
    'v0.8.2',
    '0.8.2-beta.1',
    '0.8.2.0',
    ' 0.8.2 ',
])('falls back for invalid version %j', (version) => {
    expect(resolveNativeHostDownload(version, { os: 'mac', arch: 'arm64' })).toEqual({
        kind: NativeHostDownloadKind.AllDownloads,
        url: NATIVE_HOST_ALL_DOWNLOADS_URL,
    });
});

test.each([
    [{ os: 'android', arch: 'arm64' }],
    [{ os: 'cros', arch: 'x86-64' }],
    [{ os: 'mac', arch: 'arm' }],
    [{ os: 'linux', arch: 'mips64' }],
] as const)('falls back for unsupported platform $0', (platform) => {
    expect(resolveNativeHostDownload('0.8.2', platform)).toEqual({
        kind: NativeHostDownloadKind.AllDownloads,
        url: NATIVE_HOST_ALL_DOWNLOADS_URL,
    });
});

test('reads the installed version and platform exactly once', async () => {
    const { runtime } = (await import('webextension-polyfill')).default;
    const getManifest = vi.mocked(runtime.getManifest)
        .mockReturnValue({ version: '0.8.2' });
    const getPlatformInfo = vi.mocked(runtime.getPlatformInfo)
        .mockResolvedValue({ os: 'mac', arch: 'arm64', nacl_arch: 'arm64' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(resolveCurrentNativeHostDownload()).resolves.toEqual({
        kind: NativeHostDownloadKind.Direct,
        url: `https://github.com/maximtop/kode-injector/releases/download/v0.8.2/${
            getNativeHostPublishedAsset(
                NativeHostPackageTarget.MacOSAppleSilicon,
            ).name
        }`,
        target: NativeHostPackageTarget.MacOSAppleSilicon,
    });
    expect(getManifest).toHaveBeenCalledTimes(1);
    expect(getPlatformInfo).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
});

test('falls back when platform detection rejects without making a network request', async () => {
    const { runtime } = (await import('webextension-polyfill')).default;
    const getManifest = vi.mocked(runtime.getManifest)
        .mockReturnValue({ version: '0.8.2' });
    const getPlatformInfo = vi.mocked(runtime.getPlatformInfo)
        .mockRejectedValue(new Error('platform unavailable'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(resolveCurrentNativeHostDownload()).resolves.toEqual({
        kind: NativeHostDownloadKind.AllDownloads,
        url: NATIVE_HOST_ALL_DOWNLOADS_URL,
    });
    expect(getManifest).toHaveBeenCalledTimes(1);
    expect(getPlatformInfo).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
});

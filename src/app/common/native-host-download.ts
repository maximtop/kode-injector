/**
 * @file
 */

import browser from 'webextension-polyfill';

import {
    NATIVE_HOST_ALL_DOWNLOADS_URL,
    NATIVE_HOST_RELEASES_URL,
} from './constants';
import {
    findNativeHostPublishedAsset,
    NativeHostPackageTarget,
} from './native-host-artifacts';

export {
    NativeHostPackageTarget,
    RuntimeArchitecture,
    RuntimeOS,
} from './native-host-artifacts';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

/**
 * How specifically a native-host download could be resolved.
 */
export enum NativeHostDownloadKind {
    Direct = 'direct',
    AllDownloads = 'allDownloads',
}

/**
 * User-facing native-host download destination.
 */
export interface NativeHostDownload {
    /**
     * Whether this URL is platform-specific or the complete list.
     */
    kind: NativeHostDownloadKind;

    /**
     * Download destination.
     */
    url: string;

    /**
     * Exact package selected for a direct download.
     */
    target?: NativeHostPackageTarget;
}

/**
 * Platform fields used to choose a published package.
 */
export interface RuntimePlatform {
    /**
     * Browser runtime operating-system identifier.
     */
    os: string;

    /**
     * Browser runtime processor-architecture identifier.
     */
    arch: string;
}

/**
 * Creates the safe fallback download destination.
 *
 * @returns Complete releases-page destination.
 */
const allDownloads = (): NativeHostDownload => ({
    kind: NativeHostDownloadKind.AllDownloads,
    url: NATIVE_HOST_ALL_DOWNLOADS_URL,
});

/**
 * Resolves a version-matched package for a supported runtime platform.
 *
 * @param version Installed extension version.
 * @param platform Browser runtime platform information.
 *
 * @returns Direct package download or the complete releases page.
 */
export const resolveNativeHostDownload = (
    version: string,
    platform: RuntimePlatform,
): NativeHostDownload => {
    if (!VERSION_PATTERN.test(version)) {
        return allDownloads();
    }
    const asset = findNativeHostPublishedAsset(platform.os, platform.arch);
    if (!asset) {
        return allDownloads();
    }

    return {
        kind: NativeHostDownloadKind.Direct,
        url: `${NATIVE_HOST_RELEASES_URL}/download/v${version}/${asset.name}`,
        target: asset.target,
    };
};

/**
 * Resolves the native-host download for the currently running extension.
 *
 * Runtime failures fall back to the complete releases page so an unsupported
 * or unavailable platform is never guessed.
 *
 * @returns Direct package download or the complete releases page.
 */
export const resolveCurrentNativeHostDownload = async (): Promise<NativeHostDownload> => {
    try {
        const { version } = browser.runtime.getManifest();
        const platform = await browser.runtime.getPlatformInfo();

        return resolveNativeHostDownload(version, platform);
    } catch {
        return allDownloads();
    }
};

/**
 * @file Browser-specific product capabilities.
 */

import { BrowserTarget } from './browser-target';

/**
 * Product capabilities that vary between supported browsers.
 */
export interface BrowserCapabilities {
    /**
     * Whether Native Host is the default persisted method.
     */
    nativeHostIsDefault: boolean;

    /**
     * Whether users may switch the local-source method.
     */
    localSourceAccessMethodIsFixed: boolean;

    /**
     * Whether the browser app extension contains its native host.
     */
    usesEmbeddedNativeHost: boolean;

    /**
     * Whether extension settings can enable browser file access.
     */
    canOpenFileAccessSettings: boolean;

    /**
     * Whether Settings may offer the separately installed Helper.
     */
    canDownloadExternalHelper: boolean;

    /**
     * Whether nativeMessaging is requested as an optional permission.
     */
    nativeMessagingPermissionIsOptional: boolean;
}

/**
 * Exhaustive browser capability map.
 */
export const BROWSER_CAPABILITIES: Record<BrowserTarget, BrowserCapabilities> = {
    [BrowserTarget.Chrome]: {
        nativeHostIsDefault: false,
        localSourceAccessMethodIsFixed: false,
        usesEmbeddedNativeHost: false,
        canOpenFileAccessSettings: true,
        canDownloadExternalHelper: true,
        nativeMessagingPermissionIsOptional: true,
    },
    [BrowserTarget.Edge]: {
        nativeHostIsDefault: false,
        localSourceAccessMethodIsFixed: false,
        usesEmbeddedNativeHost: false,
        canOpenFileAccessSettings: true,
        canDownloadExternalHelper: true,
        nativeMessagingPermissionIsOptional: true,
    },
    [BrowserTarget.Firefox]: {
        nativeHostIsDefault: true,
        localSourceAccessMethodIsFixed: true,
        usesEmbeddedNativeHost: false,
        canOpenFileAccessSettings: false,
        canDownloadExternalHelper: true,
        nativeMessagingPermissionIsOptional: false,
    },
    [BrowserTarget.Safari]: {
        nativeHostIsDefault: true,
        localSourceAccessMethodIsFixed: true,
        usesEmbeddedNativeHost: true,
        canOpenFileAccessSettings: false,
        canDownloadExternalHelper: false,
        nativeMessagingPermissionIsOptional: false,
    },
};

/**
 * Returns capabilities for a browser target.
 *
 * @param target Browser target.
 *
 * @returns Target capabilities.
 */
export const getBrowserCapabilities = (
    target: BrowserTarget,
): BrowserCapabilities => BROWSER_CAPABILITIES[target];

/**
 * @file Optional native-messaging permission operations.
 */

import browser from 'webextension-polyfill';

import { BrowserPermission } from './constants';

/**
 * Permission request accepted by the browser API.
 */
interface BrowserPermissionRequest {
    /**
     * Permission names to query, request, or remove.
     */
    permissions: string[];
}

/**
 * Browser permissions API surface used by extension contexts.
 */
export interface NativeMessagingPermissionsApi {
    /**
     * Checks whether an extension permission is granted.
     */
    contains(permissions: BrowserPermissionRequest): Promise<boolean>;

    /**
     * Requests an optional extension permission.
     */
    request(permissions: BrowserPermissionRequest): Promise<boolean>;

    /**
     * Removes an optional extension permission.
     */
    remove(permissions: BrowserPermissionRequest): Promise<boolean>;
}

/**
 * Queries, requests, and removes the native-messaging permission.
 */
export class NativeMessagingPermissionService {
    /**
     * Browser permissions API.
     */
    private api: NativeMessagingPermissionsApi;

    /**
     * Creates the permission service.
     *
     * @param api Browser permissions API.
     */
    constructor(api: NativeMessagingPermissionsApi) {
        this.api = api;
    }

    /**
     * Checks whether native messaging is currently granted.
     *
     * @returns Whether the permission is granted.
     */
    public contains = (): Promise<boolean> => {
        return this.api.contains({
            permissions: [BrowserPermission.NativeMessaging],
        });
    };

    /**
     * Requests native messaging directly from the UI event handler.
     *
     * @returns Whether the user granted the permission.
     */
    public request = (): Promise<boolean> => {
        return this.api.request({
            permissions: [BrowserPermission.NativeMessaging],
        });
    };

    /**
     * Removes native messaging after switching back to browser file access.
     *
     * @returns Whether the permission was removed.
     */
    public remove = (): Promise<boolean> => {
        return this.api.remove({
            permissions: [BrowserPermission.NativeMessaging],
        });
    };
}

export const nativeMessagingPermission = new NativeMessagingPermissionService(
    browser.permissions,
);

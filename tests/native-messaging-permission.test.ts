/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { BrowserPermission } from '../src/app/common/constants';
import { NativeMessagingPermissionService } from '../src/app/common/native-messaging-permission';

vi.mock('webextension-polyfill', () => ({
    default: {
        permissions: {
            contains: vi.fn(),
            request: vi.fn(),
            remove: vi.fn(),
        },
    },
}));

test('requests only the optional native-messaging permission', async () => {
    const request = vi.fn().mockResolvedValue(true);
    const service = new NativeMessagingPermissionService({
        contains: vi.fn(),
        request,
        remove: vi.fn(),
    });

    await expect(service.request()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({
        permissions: [BrowserPermission.NativeMessaging],
    });
});

test('removes only the optional native-messaging permission', async () => {
    const remove = vi.fn().mockResolvedValue(true);
    const service = new NativeMessagingPermissionService({
        contains: vi.fn(),
        request: vi.fn(),
        remove,
    });

    await expect(service.remove()).resolves.toBe(true);
    expect(remove).toHaveBeenCalledWith({
        permissions: [BrowserPermission.NativeMessaging],
    });
});

test('checks only the native-messaging permission', async () => {
    const contains = vi.fn().mockResolvedValue(true);
    const service = new NativeMessagingPermissionService({
        contains,
        request: vi.fn(),
        remove: vi.fn(),
    });

    await expect(service.contains()).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({
        permissions: [BrowserPermission.NativeMessaging],
    });
});

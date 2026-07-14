/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { applyLocalSourceAccessMethod } from '../src/app/options/local-source-access-method';

const createActions = () => ({
    permission: {
        contains: vi.fn().mockResolvedValue(false),
        request: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(true),
    },
    setMethod: vi.fn().mockResolvedValue(undefined),
    showPermissionDenied: vi.fn(),
    logPermissionError: vi.fn(),
});

test('requests optional permission before activating native-host mode', async () => {
    const actions = createActions();

    await expect(applyLocalSourceAccessMethod(
        LocalSourceAccessMethod.NativeHost,
        actions,
    )).resolves.toBe(true);

    expect(actions.permission.request).toHaveBeenCalledOnce();
    expect(actions.setMethod).toHaveBeenCalledWith(LocalSourceAccessMethod.NativeHost);
    expect(actions.permission.request.mock.invocationCallOrder[0])
        .toBeLessThan(actions.setMethod.mock.invocationCallOrder[0] as number);
});

test('keeps browser mode selected when optional permission is denied', async () => {
    const actions = createActions();
    actions.permission.request.mockResolvedValue(false);

    await expect(applyLocalSourceAccessMethod(
        LocalSourceAccessMethod.NativeHost,
        actions,
    )).resolves.toBe(false);

    expect(actions.setMethod).not.toHaveBeenCalled();
    expect(actions.showPermissionDenied).toHaveBeenCalledOnce();
});

test('reports permission request failures without changing methods', async () => {
    const actions = createActions();
    const error = new Error('request failed');
    actions.permission.request.mockRejectedValue(error);

    await expect(applyLocalSourceAccessMethod(
        LocalSourceAccessMethod.NativeHost,
        actions,
    )).resolves.toBe(false);

    expect(actions.logPermissionError).toHaveBeenCalledWith(error);
    expect(actions.showPermissionDenied).toHaveBeenCalledOnce();
    expect(actions.setMethod).not.toHaveBeenCalled();
});

test('activates browser mode before removing optional native messaging', async () => {
    const actions = createActions();

    await expect(applyLocalSourceAccessMethod(
        LocalSourceAccessMethod.Browser,
        actions,
    )).resolves.toBe(true);

    expect(actions.setMethod).toHaveBeenCalledWith(LocalSourceAccessMethod.Browser);
    expect(actions.permission.remove).toHaveBeenCalledOnce();
    expect(actions.setMethod.mock.invocationCallOrder[0])
        .toBeLessThan(actions.permission.remove.mock.invocationCallOrder[0] as number);
});

test('reports an optional permission that remains granted after removal', async () => {
    const actions = createActions();
    actions.permission.remove.mockResolvedValue(false);
    actions.permission.contains.mockResolvedValue(true);

    await applyLocalSourceAccessMethod(LocalSourceAccessMethod.Browser, actions);

    expect(actions.permission.contains).toHaveBeenCalledOnce();
    expect(actions.logPermissionError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'NATIVE_MESSAGING_PERMISSION_NOT_REMOVED',
    }));
});

test('rolls back newly granted permission when native mode cannot be saved', async () => {
    const actions = createActions();
    const error = new Error('save failed');
    actions.setMethod.mockRejectedValue(error);

    await expect(applyLocalSourceAccessMethod(
        LocalSourceAccessMethod.NativeHost,
        actions,
    )).rejects.toThrow(error);

    expect(actions.permission.remove).toHaveBeenCalledOnce();
});

/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { FileAccessService } from '../src/app/background/file-access-service';

test.each([true, false])('returns browser file-access state %s', async (allowed) => {
    const api = {
        isAllowedFileSchemeAccess: vi.fn().mockResolvedValue(allowed),
    };
    const logger = { error: vi.fn() };
    const service = new FileAccessService(api, logger);

    await expect(service.isAllowed()).resolves.toBe(allowed);
    expect(api.isAllowedFileSchemeAccess).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
});

test('treats file-access API failures as denied', async () => {
    const failure = new Error('permission API failed');
    const api = {
        isAllowedFileSchemeAccess: vi.fn().mockRejectedValue(failure),
    };
    const logger = { error: vi.fn() };
    const service = new FileAccessService(api, logger);

    await expect(service.isAllowed()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
        'Failed to check local file access',
        failure,
    );
});

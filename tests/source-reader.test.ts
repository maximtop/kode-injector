/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { SourceReader, SourceReadErrorCode } from '../src/app/background/source-reader';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { NativeErrorCode } from '../src/app/common/native-host-protocol';

test('routes file URLs through the native host in native-host mode', async () => {
    const readFile = vi.fn().mockResolvedValue('local content');
    const fetchSource = vi.fn();
    const reader = new SourceReader(
        { readFile },
        fetchSource,
        () => LocalSourceAccessMethod.NativeHost,
    );

    await expect(reader.read('file:///tmp/a.js')).resolves.toEqual({
        ok: true,
        content: 'local content',
    });
    expect(readFile).toHaveBeenCalledWith('file:///tmp/a.js');
    expect(fetchSource).not.toHaveBeenCalled();
});

test('routes file URLs through fetch in browser mode', async () => {
    const readFile = vi.fn();
    const fetchSource = vi.fn().mockResolvedValue({ text: async () => 'local content' });
    const reader = new SourceReader(
        { readFile },
        fetchSource,
        () => LocalSourceAccessMethod.Browser,
    );

    await expect(reader.read('file:///tmp/a.js')).resolves.toEqual({
        ok: true,
        content: 'local content',
    });
    expect(fetchSource).toHaveBeenCalledWith('file:///tmp/a.js');
    expect(readFile).not.toHaveBeenCalled();
});

test('routes network URLs through fetch', async () => {
    const readFile = vi.fn();
    const fetchSource = vi.fn().mockResolvedValue({ text: async () => 'network content' });
    const reader = new SourceReader(
        { readFile },
        fetchSource,
        () => LocalSourceAccessMethod.NativeHost,
    );

    await expect(reader.read('https://localhost/a.js')).resolves.toEqual({
        ok: true,
        content: 'network content',
    });
    expect(readFile).not.toHaveBeenCalled();
});

test('keeps empty successful content distinct from failures', async () => {
    const allowed = new SourceReader(
        { readFile: vi.fn().mockResolvedValue('') },
        vi.fn(),
        () => LocalSourceAccessMethod.NativeHost,
    );
    await expect(allowed.read('file:///tmp/empty.js')).resolves.toEqual({
        ok: true,
        content: '',
    });

    const denied = new SourceReader({
        readFile: vi.fn().mockRejectedValue(new Error(NativeErrorCode.FileNotFound)),
    }, vi.fn(), () => LocalSourceAccessMethod.NativeHost);
    await expect(denied.read('file:///tmp/missing.js')).resolves.toEqual({
        ok: false,
        errorCode: NativeErrorCode.FileNotFound,
    });
});

test('maps fetch failures without returning content', async () => {
    const reader = new SourceReader(
        { readFile: vi.fn() },
        vi.fn().mockRejectedValue(new Error('network details')),
        () => LocalSourceAccessMethod.Browser,
    );
    await expect(reader.read('https://localhost/a.js')).resolves.toEqual({
        ok: false,
        errorCode: SourceReadErrorCode.FetchFailed,
    });
});

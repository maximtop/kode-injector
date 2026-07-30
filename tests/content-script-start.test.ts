/**
 * @file
 */

import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from 'vitest';

import { contentScript } from '../src/app/content-script';
import { messenger } from '../src/app/common/messenger';

vi.mock('../src/app/common/messenger', () => ({
    messenger: { getInjectionsCode: vi.fn() },
}));

vi.mock('../src/app/common/log', () => ({
    log: { debug: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(messenger.getInjectionsCode).mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal('document', {
        readyState: 'loading',
        documentElement: { setAttribute: vi.fn(), getAttribute: vi.fn() },
        getElementsByTagName: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

test('starts loading sources at document_start instead of waiting for interactive state', () => {
    contentScript.init();

    expect(messenger.getInjectionsCode).toHaveBeenCalledOnce();
});

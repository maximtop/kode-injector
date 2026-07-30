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

import { executeScript } from '../src/app/background/execute-script';

type CapturedInjection = {
    func: (
        script: string,
        documentToken: string,
        documentTokenAttribute: string,
    ) => void;
    args: [string, string, string];
};

const currentDocumentToken = '00112233445566778899aabbccddeeff';
const staleDocumentToken = 'ffeeddccbbaa99887766554433221100';

let capturedInjection: CapturedInjection | undefined;
let appendChild: ReturnType<typeof vi.fn>;

beforeEach(() => {
    capturedInjection = undefined;
    appendChild = vi.fn();
    vi.stubGlobal('chrome', {
        runtime: { lastError: undefined },
        scripting: {
            executeScript: vi.fn(async (injection: CapturedInjection) => {
                capturedInjection = injection;
            }),
        },
    });

    vi.stubGlobal('document', {
        documentElement: {
            getAttribute: vi.fn(() => currentDocumentToken),
            appendChild,
        },
        head: { appendChild },
        createElement: vi.fn(() => ({
            setAttribute: vi.fn(),
            textContent: '',
            parentNode: { removeChild: vi.fn() },
        })),
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test('does not execute JavaScript from a stale document after navigation', async () => {
    await executeScript(
        'window.injected = true;',
        7,
        staleDocumentToken,
    );

    expect(capturedInjection).toBeDefined();
    capturedInjection!.func(...capturedInjection!.args);

    expect(appendChild).not.toHaveBeenCalled();
});

test('executes JavaScript when the request still belongs to the current document', async () => {
    await executeScript(
        'window.injected = true;',
        7,
        currentDocumentToken,
    );

    expect(capturedInjection).toBeDefined();
    capturedInjection!.func(...capturedInjection!.args);

    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(expect.objectContaining({
        textContent: 'window.injected = true;',
    }));
});

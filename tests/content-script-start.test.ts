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

import { messenger } from '../src/app/common/messenger';
import { contentScript } from '../src/app/content-script';

vi.mock('../src/app/common/messenger', () => ({
    messenger: { getInjectionsCode: vi.fn() },
}));

vi.mock('../src/app/common/log', () => ({
    log: { debug: vi.fn(), error: vi.fn() },
}));

interface FakeStyleElement {
    setAttribute: ReturnType<typeof vi.fn>;
    appendChild: ReturnType<typeof vi.fn>;
}

interface FakeNode {
    appendChild: ReturnType<typeof vi.fn>;
}

interface FakeDocument {
    readyState: DocumentReadyState;
    documentElement: {
        setAttribute: (name: string, value: string) => void;
        getAttribute: ReturnType<typeof vi.fn>;
    } | null;
    head: FakeNode | null;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    createElement: ReturnType<typeof vi.fn>;
    createTextNode: ReturnType<typeof vi.fn>;
    getElementsByTagName: ReturnType<typeof vi.fn>;
}

let fakeDocument: FakeDocument;
let eventHandlers: Record<string, () => void>;
let createdStyles: FakeStyleElement[];

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
};

/**
 * Creates a root element whose getAttribute reflects whatever setAttribute
 * last stored, so the stale-document guard can be forced independently of
 * the module's real (unpredictable) document token.
 */
const createFakeRoot = () => {
    let storedToken: string | null = null;
    return {
        setAttribute: vi.fn((_name: string, value: string) => {
            storedToken = value;
        }),
        getAttribute: vi.fn(() => storedToken),
    };
};

beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers = {};
    createdStyles = [];

    fakeDocument = {
        readyState: 'complete',
        documentElement: createFakeRoot(),
        head: { appendChild: vi.fn() },
        addEventListener: vi.fn((event: string, handler: () => void) => {
            eventHandlers[event] = handler;
        }),
        removeEventListener: vi.fn((event: string) => {
            delete eventHandlers[event];
        }),
        createElement: vi.fn(() => {
            const style: FakeStyleElement = { setAttribute: vi.fn(), appendChild: vi.fn() };
            createdStyles.push(style);
            return style;
        }),
        createTextNode: vi.fn((text: string) => ({ text })),
        getElementsByTagName: vi.fn(() => []),
    };
    vi.stubGlobal('document', fakeDocument);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

test('starts loading sources at document_start instead of waiting for interactive state', () => {
    vi.mocked(messenger.getInjectionsCode).mockReturnValue(new Promise(() => {}));

    contentScript.init();

    expect(messenger.getInjectionsCode).toHaveBeenCalledOnce();
});

test('injects returned CSS into the document head', async () => {
    vi.mocked(messenger.getInjectionsCode).mockResolvedValue([
        { css: { code: ':root { color: red; }' } },
    ]);

    contentScript.init();

    await vi.waitFor(() => {
        expect(fakeDocument.head!.appendChild).toHaveBeenCalledOnce();
    });
    expect(createdStyles).toHaveLength(1);
    expect(createdStyles[0]!.setAttribute).toHaveBeenCalledWith('data-source', 'Kode Injector');
    expect(createdStyles[0]!.appendChild).toHaveBeenCalledWith({ text: ':root { color: red; }' });
    expect(fakeDocument.head!.appendChild).toHaveBeenCalledWith(createdStyles[0]);
});

test('skips injecting a rule whose CSS code is empty', async () => {
    vi.mocked(messenger.getInjectionsCode).mockResolvedValue([{ css: { code: '' } }]);

    contentScript.init();

    await vi.waitFor(() => {
        expect(messenger.getInjectionsCode).toHaveBeenCalledOnce();
    });
    expect(fakeDocument.createElement).not.toHaveBeenCalled();
    expect(fakeDocument.head!.appendChild).not.toHaveBeenCalled();
});

test('does nothing when the background reports no matching rules', async () => {
    vi.mocked(messenger.getInjectionsCode).mockResolvedValue(null);

    contentScript.init();

    await vi.waitFor(() => {
        expect(messenger.getInjectionsCode).toHaveBeenCalledOnce();
    });
    expect(fakeDocument.createElement).not.toHaveBeenCalled();
});

test('does nothing when the background reports an empty rule list', async () => {
    vi.mocked(messenger.getInjectionsCode).mockResolvedValue([]);

    contentScript.init();

    await vi.waitFor(() => {
        expect(messenger.getInjectionsCode).toHaveBeenCalledOnce();
    });
    expect(fakeDocument.createElement).not.toHaveBeenCalled();
});

test('drops a stale response after the document token changed before sources arrived', async () => {
    const sourcesResponse = deferred<{ css: { code: string } }[]>();
    vi.mocked(messenger.getInjectionsCode).mockReturnValue(sourcesResponse.promise);

    contentScript.init();
    // Simulate a navigation/re-init overwriting the token attribute while
    // the background request was still in flight.
    fakeDocument.documentElement!.setAttribute('data-kode-injector-document', 'a-different-token');
    sourcesResponse.resolve([{ css: { code: ':root { color: red; }' } }]);

    await sourcesResponse.promise;
    await vi.waitFor(() => {
        expect(fakeDocument.createElement).not.toHaveBeenCalled();
    });
});

test('waits for the head element to become available before inserting CSS', async () => {
    fakeDocument.head = null;
    fakeDocument.readyState = 'loading';
    vi.mocked(messenger.getInjectionsCode).mockResolvedValue([
        { css: { code: '.a { color: blue; }' } },
    ]);

    contentScript.init();

    await vi.waitFor(() => {
        expect(eventHandlers.DOMContentLoaded).toBeDefined();
    });
    expect(fakeDocument.createElement).not.toHaveBeenCalled();

    const head: FakeNode = { appendChild: vi.fn() };
    fakeDocument.head = head;
    eventHandlers.DOMContentLoaded!();

    await vi.waitFor(() => {
        expect(head.appendChild).toHaveBeenCalledOnce();
    });
});

test('falls back to the document root when no head ever appears outside the loading state', async () => {
    fakeDocument.head = null;
    fakeDocument.readyState = 'interactive';
    vi.mocked(messenger.getInjectionsCode).mockResolvedValue([
        { css: { code: '.a { color: green; }' } },
    ]);

    contentScript.init();

    await vi.waitFor(() => {
        expect(createdStyles).toHaveLength(1);
    });
    expect(fakeDocument.addEventListener).not.toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.anything(),
        expect.anything(),
    );
});

test('marks the document once its root element appears after document_start', async () => {
    fakeDocument.documentElement = null;
    vi.mocked(messenger.getInjectionsCode).mockResolvedValue([]);

    contentScript.init();

    expect(messenger.getInjectionsCode).not.toHaveBeenCalled();
    expect(eventHandlers.readystatechange).toBeDefined();

    const root = createFakeRoot();
    fakeDocument.documentElement = root;
    eventHandlers.readystatechange!();

    expect(root.setAttribute).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
        expect(messenger.getInjectionsCode).toHaveBeenCalledOnce();
    });
});

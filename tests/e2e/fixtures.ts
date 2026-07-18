/**
 * @file
 */

import fs from 'node:fs/promises';
import http, { type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    chromium,
    expect,
    test as base,
    type BrowserContext,
    type Worker,
} from '@playwright/test';

const DEFAULT_EXTENSION_PATH = path.join('build', 'dev', 'chrome');
const EXTENSION_PATH_ENV = 'KODE_INJECTOR_E2E_EXTENSION_PATH';
const PROFILE_PREFIX = 'kode-injector-e2e-profile-';
const SOURCE_PREFIX = 'kode-injector-e2e-source-';
const MATCHING_HOSTNAME = 'localhost';
const NON_MATCHING_HOSTNAME = '127.0.0.1';
const LOOPBACK_BIND_ADDRESS = '::';
const EXTENSION_SCHEME = 'chrome-extension:';
const FILE_ACCESS_TEST_FLAG = '--disable-extensions-file-access-check';
const JS_SOURCE = 'document.documentElement.dataset.kodeInjectorE2eJs = \'injected\';\n';
const CSS_SOURCE = ':root { --kode-injector-e2e-css: injected; }\n';
const TARGET_HTML = `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Kode Injector E2E target</title>
    <script>
        window.addEventListener('load', () => {
            window.setTimeout(() => {
                document.documentElement.dataset.kodeInjectorE2eSettled = 'true';
            }, 250);
        });
    </script>
</head>
<body><main id="probe">Target page</main></body>
</html>`;

interface TestSite {
    matchingHostname: string;
    matchingUrl: string;
    nonMatchingUrl: string;
    javaScriptFileUrl: string;
    cssFileUrl: string;
}

interface ExtensionFixtures {
    context: BrowserContext;
    extensionId: string;
    serviceWorker: Worker;
    testSite: TestSite;
}

const listen = (server: Server): Promise<number> => {
    return new Promise((resolve, reject) => {
        const handleError = (error: Error): void => {
            reject(error);
        };
        server.once('error', handleError);
        server.listen(0, LOOPBACK_BIND_ADDRESS, () => {
            server.off('error', handleError);
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('E2E target server has no numeric port'));
                return;
            }
            resolve(address.port);
        });
    });
};

const closeServer = async (server: Server): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
        server.closeAllConnections();
    });
};

export const test = base.extend<ExtensionFixtures>({
    // Playwright fixtures require the dependency object even when it is empty.
    // eslint-disable-next-line no-empty-pattern
    context: async ({}, use, testInfo) => {
        const configuredPath = process.env[EXTENSION_PATH_ENV] ?? DEFAULT_EXTENSION_PATH;
        const extensionPath = path.resolve(configuredPath);
        const { headless } = testInfo.project.use;
        if (typeof headless !== 'boolean') {
            throw new Error('Playwright project must configure headless mode');
        }
        await fs.access(path.join(extensionPath, 'manifest.json'));
        const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), PROFILE_PREFIX));
        let context: BrowserContext | undefined;

        try {
            context = await chromium.launchPersistentContext(userDataDir, {
                channel: 'chromium',
                headless,
                args: [
                    FILE_ACCESS_TEST_FLAG,
                    `--disable-extensions-except=${extensionPath}`,
                    `--load-extension=${extensionPath}`,
                ],
            });
            await use(context);
        } finally {
            try {
                await context?.close();
            } finally {
                await fs.rm(userDataDir, { recursive: true, force: true });
            }
        }
    },

    serviceWorker: async ({ context }, use) => {
        const serviceWorker = context.serviceWorkers()[0]
            ?? await context.waitForEvent('serviceworker');
        const fileAccessAllowed = await serviceWorker.evaluate(() => {
            return chrome.extension.isAllowedFileSchemeAccess();
        });
        expect(
            fileAccessAllowed,
            'The isolated Chromium profile must allow extension file access',
        ).toBe(true);
        await use(serviceWorker);
    },

    extensionId: async ({ serviceWorker }, use) => {
        const serviceWorkerUrl = new URL(serviceWorker.url());
        expect(serviceWorkerUrl.protocol).toBe(EXTENSION_SCHEME);
        await use(serviceWorkerUrl.hostname);
    },

    // eslint-disable-next-line no-empty-pattern
    testSite: async ({}, use) => {
        const sourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), SOURCE_PREFIX));
        const javaScriptPath = path.join(sourceDirectory, 'injection.js');
        const cssPath = path.join(sourceDirectory, 'injection.css');
        const server = http.createServer((_request, response) => {
            response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            response.end(TARGET_HTML);
        });

        try {
            await Promise.all([
                fs.writeFile(javaScriptPath, JS_SOURCE, 'utf8'),
                fs.writeFile(cssPath, CSS_SOURCE, 'utf8'),
            ]);
            const port = await listen(server);
            await use({
                matchingHostname: MATCHING_HOSTNAME,
                matchingUrl: `http://${MATCHING_HOSTNAME}:${port}/`,
                nonMatchingUrl: `http://${NON_MATCHING_HOSTNAME}:${port}/`,
                javaScriptFileUrl: pathToFileURL(javaScriptPath).href,
                cssFileUrl: pathToFileURL(cssPath).href,
            });
        } finally {
            try {
                if (server.listening) {
                    await closeServer(server);
                }
            } finally {
                await fs.rm(sourceDirectory, { recursive: true, force: true });
            }
        }
    },
});

export { expect };

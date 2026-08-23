/**
 * @file Product-boundary journey of the Safari built-in demo, exercised on the
 * built Safari WebExtension resources in headless Chromium. Safari-only UI
 * (website-access prompts, the containing app) is covered by the manual gate.
 */

import path from 'node:path';
import type { BrowserContext, Page, Worker } from '@playwright/test';

import { MESSAGE_TYPES } from '../../src/app/common/constants';
import {
    DEMO_CSS_MARKER_PROPERTY,
    DEMO_CSS_MARKER_VALUE,
    DEMO_ELEMENT_ID,
    DEMO_RUN_TEST_ID,
    DEMO_TARGET_URL,
} from '../../src/app/common/demo-contracts';
import {
    CHROME_EXTENSION_PATH,
    createRule,
    expect,
    test,
} from './fixtures';

const SAFARI_EXTENSION_PATH_ENV = 'KODE_INJECTOR_E2E_SAFARI_EXTENSION_PATH';
const DEFAULT_SAFARI_EXTENSION_PATH = path.join('build', 'dev', 'safari');
const DEMO_CARD = '[data-testid="demo-card"]';
const DEMO_RUN = `[data-testid="${DEMO_RUN_TEST_ID}"]`;
const DEMO_RESUME = '[data-testid="demo-resume-btn"]';
const DEMO_STATUS = '[data-testid="demo-status"]';
const EMPTY_STATE = '[data-testid="empty-state"]';
const RULES_LIST = '[data-testid="rules-list"]';
const RULE_MENU = '[data-testid="rule-menu"]';
const RULE_DELETE = '[data-testid="rule-delete"]';
const RULE_DELETE_CONFIRM = '[data-testid="rule-delete-confirm"]';
const SETTINGS_DEMO_LINK = '[data-testid="settings-demo-link"]';
const SETTINGS_TAB_INDEX = 1;
const INJECTED_STYLE = 'style[data-source="Kode Injector"]';
const DEMO_ELEMENT = `#${DEMO_ELEMENT_ID}`;
const SETTLED_ATTRIBUTE = 'data-kode-injector-e2e-settled';
const SETTLED_VALUE = 'true';
const RELOAD_ITERATIONS = 20;
const DEMO_TARGET_ROUTE = `${DEMO_TARGET_URL}**`;
const DEMO_HTML = `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Example Domain</title>
    <script>
        window.addEventListener('load', () => {
            window.setTimeout(() => {
                document.documentElement.dataset.kodeInjectorE2eSettled = 'true';
            }, 250);
        });
    </script>
</head>
<body><div><h1>Example Domain</h1><p>This domain is for use in illustrative examples.</p></div></body>
</html>`;

test.use({
    extensionPath: process.env[SAFARI_EXTENSION_PATH_ENV] ?? DEFAULT_SAFARI_EXTENSION_PATH,
});

test.beforeEach(async ({ context }) => {
    // The fixed target is served locally: no network, no real example.com.
    await context.route(DEMO_TARGET_ROUTE, (route) => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: DEMO_HTML,
    }));
});

/**
 * Opens the options page of the loaded extension.
 *
 * @param context Browser context with the extension.
 * @param extensionId Extension identifier.
 */
const openOptions = async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    return page;
};

/**
 * Reads the demo CSS marker from a page.
 *
 * @param page Target page handle.
 */
const getCssMarker = async (page: Page): Promise<string> => {
    return page.evaluate((propertyName) => {
        return window.getComputedStyle(document.documentElement)
            .getPropertyValue(propertyName)
            .trim();
    }, DEMO_CSS_MARKER_PROPERTY);
};

/**
 * Asserts exactly one JavaScript effect and one CSS effect on the page.
 *
 * @param page Demo page handle.
 */
const expectDemoApplied = async (page: Page): Promise<void> => {
    await expect(page.locator(DEMO_ELEMENT)).toHaveCount(1);
    await expect.poll(async () => getCssMarker(page)).toBe(DEMO_CSS_MARKER_VALUE);
    await expect(page.locator(INJECTED_STYLE)).toHaveCount(1);
};

/**
 * Asserts that a settled page received neither demo effect.
 *
 * @param page Page handle.
 */
const expectNoDemo = async (page: Page): Promise<void> => {
    await expect(page.locator('html')).toHaveAttribute(SETTLED_ATTRIBUTE, SETTLED_VALUE);
    await expect(page.locator(DEMO_ELEMENT)).toHaveCount(0);
    expect(await getCssMarker(page)).toBe('');
    await expect(page.locator(INJECTED_STYLE)).toHaveCount(0);
};

/**
 * Reads the complete extension storage through the service worker.
 *
 * @param serviceWorker Extension service worker handle.
 */
const readStorage = async (serviceWorker: Worker): Promise<Record<string, unknown>> => {
    return serviceWorker.evaluate(async () => chrome.storage.local.get(null));
};

/**
 * Lists open pages at the demo target.
 *
 * @param context Browser context.
 */
const demoPages = (context: BrowserContext): Page[] => {
    return context.pages().filter((page) => page.url().startsWith(DEMO_TARGET_URL));
};

/**
 * Clicks Run Demo and returns the tab it opened.
 *
 * @param context Browser context.
 * @param optionsPage Options page handle.
 */
const runDemo = async (context: BrowserContext, optionsPage: Page): Promise<Page> => {
    const pagePromise = context.waitForEvent('page');
    await optionsPage.locator(DEMO_RUN).click();
    const demoPage = await pagePromise;
    await demoPage.waitForURL(DEMO_TARGET_URL);
    return demoPage;
};

test('runs the demo in exactly one tab, once per document, and nowhere else', async ({
    context,
    extensionId,
    serviceWorker,
}) => {
    const optionsPage = await openOptions(context, extensionId);
    await expect(optionsPage.locator(DEMO_CARD)).toBeVisible();
    await expect(optionsPage.locator(EMPTY_STATE)).toBeVisible();
    const storageBefore = await readStorage(serviceWorker);

    const demoPage = await runDemo(context, optionsPage);
    await expectDemoApplied(demoPage);
    await expect(optionsPage.locator(DEMO_STATUS)).toHaveAttribute('data-status', 'applied');

    // Repeated runs reuse the bound tab instead of opening competing tabs.
    await optionsPage.locator(DEMO_RUN).click();
    await optionsPage.locator(DEMO_RUN).click();
    await expect(optionsPage.locator(DEMO_STATUS)).toHaveAttribute('data-status', 'applied');
    // The persistent context keeps its initial blank page, so count only
    // tabs at the demo target: exactly one.
    expect(demoPages(context)).toHaveLength(1);
    await expectDemoApplied(demoPage);

    for (let iteration = 0; iteration < RELOAD_ITERATIONS; iteration += 1) {
        // eslint-disable-next-line no-await-in-loop
        await demoPage.reload({ waitUntil: 'load' });
        // eslint-disable-next-line no-await-in-loop
        await expectDemoApplied(demoPage);
    }

    const unrelatedPage = await context.newPage();
    await unrelatedPage.goto(DEMO_TARGET_URL, { waitUntil: 'load' });
    await expectNoDemo(unrelatedPage);

    // A complete demo session persists nothing (FR-012, SC-004).
    expect(await readStorage(serviceWorker)).toEqual(storageBefore);
});

test('the Settings link returns to the demo card', async ({ context, extensionId }) => {
    const optionsPage = await openOptions(context, extensionId);

    await optionsPage.getByRole('tab').nth(SETTINGS_TAB_INDEX).click();
    await expect(optionsPage.locator(SETTINGS_DEMO_LINK)).toBeVisible();
    await optionsPage.locator(SETTINGS_DEMO_LINK).click();

    await expect(optionsPage.locator(DEMO_CARD)).toBeVisible();
});

test('the first rule ends the demo and deleting it restores only the card', async ({
    context,
    extensionId,
    testSite,
}) => {
    const optionsPage = await openOptions(context, extensionId);
    const demoPage = await runDemo(context, optionsPage);
    await expectDemoApplied(demoPage);

    await createRule(optionsPage, testSite.matchingHostname, null, testSite.cssFileUrl);
    await expect(optionsPage.locator(RULES_LIST)).toBeVisible();
    await expect(optionsPage.locator(DEMO_CARD)).toHaveCount(0);

    await demoPage.reload({ waitUntil: 'load' });
    await expectNoDemo(demoPage);

    await optionsPage.locator(RULE_MENU).click();
    await optionsPage.locator(RULE_DELETE).click();
    await optionsPage.locator(RULE_DELETE_CONFIRM).click();
    await expect(optionsPage.locator(DEMO_CARD)).toBeVisible();
    await expect(optionsPage.locator(DEMO_STATUS)).toHaveCount(0);

    await demoPage.reload({ waitUntil: 'load' });
    await expectNoDemo(demoPage);
});

test('paused injections block the demo until resumed', async ({ context, extensionId }) => {
    const optionsPage = await openOptions(context, extensionId);
    await optionsPage.evaluate(
        (type) => chrome.runtime.sendMessage({ type }),
        MESSAGE_TYPES.DISABLE_APP,
    );
    await optionsPage.reload();

    await expect(optionsPage.locator(DEMO_STATUS)).toHaveAttribute('data-status', 'paused');
    await expect(optionsPage.locator(DEMO_RUN)).toBeDisabled();

    await optionsPage.locator(DEMO_RESUME).click();
    await expect(optionsPage.locator(DEMO_RUN)).toBeEnabled();
    const demoPage = await runDemo(context, optionsPage);
    await expectDemoApplied(demoPage);
});

test.describe('Chrome build', () => {
    test.use({
        extensionPath: CHROME_EXTENSION_PATH,
    });

    test('keeps the existing zero-rule state without a demo card', async ({ context, extensionId }) => {
        const optionsPage = await openOptions(context, extensionId);

        await expect(optionsPage.locator(EMPTY_STATE)).toBeVisible();
        await expect(optionsPage.locator(DEMO_CARD)).toHaveCount(0);
        await optionsPage.getByRole('tab').nth(SETTINGS_TAB_INDEX).click();
        await expect(optionsPage.locator(SETTINGS_DEMO_LINK)).toHaveCount(0);
    });
});

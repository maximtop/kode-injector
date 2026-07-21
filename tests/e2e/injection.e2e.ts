/**
 * @file
 */

import type { Page, Worker } from '@playwright/test';

import { STORAGE_KEYS } from '../../src/app/common/constants';
import { expect, test } from './fixtures';

const NEW_INJECTION_BUTTON = '[data-testid="new-injection-btn"]';
const EDITOR_FIELD = {
    Site: '[data-testid="editor-site"]',
    JavaScript: '[data-testid="editor-js"]',
    Css: '[data-testid="editor-css"]',
} as const;
const EDITOR_SUBMIT = '[data-testid="editor-submit"]';
const RULE_ROW = '[data-testid="rule-row"]';
const RULE_CHIP = '.chip';
const INJECTED_STYLE = 'style[data-source="Kode Injector"]';
const JS_MARKER_ATTRIBUTE = 'data-kode-injector-e2e-js';
const JS_MARKER_VALUE = 'injected';
const CSS_MARKER_PROPERTY = '--kode-injector-e2e-css';
const CSS_MARKER_VALUE = 'injected';
const SETTLED_ATTRIBUTE = 'data-kode-injector-e2e-settled';
const SETTLED_VALUE = 'true';

/**
 * Creates an injection rule through the redesigned options UI.
 *
 * @param optionsPage Options page handle.
 * @param site Hostname entered into the editor.
 * @param jsFileUrl Optional JavaScript file URL.
 * @param cssFileUrl Optional CSS file URL.
 */
const createRule = async (
    optionsPage: Page,
    site: string,
    jsFileUrl: string | null,
    cssFileUrl: string | null,
): Promise<void> => {
    await optionsPage.locator(NEW_INJECTION_BUTTON).click();
    await optionsPage.locator(EDITOR_FIELD.Site).fill(site);
    if (jsFileUrl) {
        await optionsPage.locator(EDITOR_FIELD.JavaScript).fill(jsFileUrl);
    }
    if (cssFileUrl) {
        await optionsPage.locator(EDITOR_FIELD.Css).fill(cssFileUrl);
    }
    await optionsPage.locator(EDITOR_SUBMIT).click();
};

/**
 * Reads the persisted injection count from extension storage.
 *
 * @param serviceWorker Extension service worker handle.
 *
 * @returns Number of persisted injection rules.
 */
const getStoredInjectionCount = async (
    serviceWorker: Worker,
): Promise<number> => {
    return serviceWorker.evaluate(async (storageKey) => {
        const stored = await chrome.storage.local.get(storageKey);
        const state = stored[storageKey] as { injections?: unknown[] } | undefined;
        return state?.injections?.length ?? 0;
    }, STORAGE_KEYS.INJECTIONS);
};

/**
 * Reads the CSS marker custom property from a page.
 *
 * @param page Target page handle.
 *
 * @returns Trimmed marker value.
 */
const getCssMarker = async (page: Page): Promise<string> => {
    return page.evaluate((propertyName) => {
        return window.getComputedStyle(document.documentElement)
            .getPropertyValue(propertyName)
            .trim();
    }, CSS_MARKER_PROPERTY);
};

test('injects local JavaScript and CSS only into the matching hostname', async ({
    context,
    extensionId,
    serviceWorker,
    testSite,
}) => {
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

    await createRule(
        optionsPage,
        testSite.matchingHostname,
        testSite.javaScriptFileUrl,
        testSite.cssFileUrl,
    );

    const injectionRow = optionsPage.locator(RULE_ROW).filter({
        hasText: testSite.matchingHostname,
    });
    await expect(injectionRow).toHaveCount(1);
    await expect(injectionRow.locator(RULE_CHIP)).toHaveCount(2);

    await expect.poll(async () => getStoredInjectionCount(serviceWorker)).toBe(1);

    await optionsPage.reload();
    await expect(injectionRow).toHaveCount(1);

    const matchingPage = await context.newPage();
    await matchingPage.goto(testSite.matchingUrl, { waitUntil: 'load' });
    await expect(matchingPage.locator('html')).toHaveAttribute(
        JS_MARKER_ATTRIBUTE,
        JS_MARKER_VALUE,
    );
    await expect.poll(async () => getCssMarker(matchingPage)).toBe(CSS_MARKER_VALUE);
    await expect(matchingPage.locator(INJECTED_STYLE)).toHaveCount(1);

    const nonMatchingPage = await context.newPage();
    await nonMatchingPage.goto(testSite.nonMatchingUrl, { waitUntil: 'load' });
    await expect(nonMatchingPage.locator('html')).toHaveAttribute(
        SETTLED_ATTRIBUTE,
        SETTLED_VALUE,
    );
    await expect(nonMatchingPage.locator('html')).not.toHaveAttribute(
        JS_MARKER_ATTRIBUTE,
        JS_MARKER_VALUE,
    );
    expect(await getCssMarker(nonMatchingPage)).toBe('');
    await expect(nonMatchingPage.locator(INJECTED_STYLE)).toHaveCount(0);
});

test('injects a CSS-only rule without executing any JavaScript', async ({
    context,
    extensionId,
    serviceWorker,
    testSite,
}) => {
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

    await createRule(optionsPage, testSite.matchingHostname, null, testSite.cssFileUrl);

    const injectionRow = optionsPage.locator(RULE_ROW).filter({
        hasText: testSite.matchingHostname,
    });
    await expect(injectionRow).toHaveCount(1);
    await expect(injectionRow.locator(RULE_CHIP)).toHaveCount(1);

    await expect.poll(async () => getStoredInjectionCount(serviceWorker)).toBe(1);

    const matchingPage = await context.newPage();
    await matchingPage.goto(testSite.matchingUrl, { waitUntil: 'load' });
    await expect.poll(async () => getCssMarker(matchingPage)).toBe(CSS_MARKER_VALUE);
    await expect(matchingPage.locator(INJECTED_STYLE)).toHaveCount(1);
    await expect(matchingPage.locator('html')).toHaveAttribute(
        SETTLED_ATTRIBUTE,
        SETTLED_VALUE,
    );
    await expect(matchingPage.locator('html')).not.toHaveAttribute(
        JS_MARKER_ATTRIBUTE,
        JS_MARKER_VALUE,
    );
});

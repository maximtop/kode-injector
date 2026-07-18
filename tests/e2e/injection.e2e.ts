/**
 * @file
 */

import { STORAGE_KEYS } from '../../src/app/common/constants';
import { expect, test } from './fixtures';

const FORM_FIELD = {
    Site: '#injection_form_site',
    JavaScript: '#injection_form_jsPath',
    Css: '#injection_form_cssPath',
} as const;

const FORM_SUBMIT = 'button[type="submit"]';
const TABLE_ROW = '.ant-table-tbody tr';
const INJECTED_STYLE = 'style[data-source="Kode Injector"]';
const JS_MARKER_ATTRIBUTE = 'data-kode-injector-e2e-js';
const JS_MARKER_VALUE = 'injected';
const CSS_MARKER_PROPERTY = '--kode-injector-e2e-css';
const CSS_MARKER_VALUE = 'injected';
const SETTLED_ATTRIBUTE = 'data-kode-injector-e2e-settled';
const SETTLED_VALUE = 'true';

test('injects local JavaScript and CSS only into the matching hostname', async ({
    context,
    extensionId,
    serviceWorker,
    testSite,
}) => {
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

    await optionsPage.locator(FORM_FIELD.Site).fill(testSite.matchingHostname);
    await optionsPage.locator(FORM_FIELD.JavaScript).fill(testSite.javaScriptFileUrl);
    await optionsPage.locator(FORM_FIELD.Css).fill(testSite.cssFileUrl);
    await optionsPage.locator(FORM_SUBMIT).click();

    const injectionRow = optionsPage.locator(TABLE_ROW).filter({
        hasText: testSite.matchingHostname,
    });
    await expect(injectionRow).toHaveCount(1);
    await expect(injectionRow.locator(`a[href="${testSite.javaScriptFileUrl}"]`))
        .toHaveCount(1);
    await expect(injectionRow.locator(`a[href="${testSite.cssFileUrl}"]`))
        .toHaveCount(1);

    await expect.poll(async () => {
        return serviceWorker.evaluate(async (storageKey) => {
            const stored = await chrome.storage.local.get(storageKey);
            const state = stored[storageKey] as { injections?: unknown[] } | undefined;
            return state?.injections?.length ?? 0;
        }, STORAGE_KEYS.INJECTIONS);
    }).toBe(1);

    await optionsPage.reload();
    await expect(injectionRow).toHaveCount(1);

    const matchingPage = await context.newPage();
    await matchingPage.goto(testSite.matchingUrl, { waitUntil: 'load' });
    await expect(matchingPage.locator('html')).toHaveAttribute(
        JS_MARKER_ATTRIBUTE,
        JS_MARKER_VALUE,
    );
    await expect.poll(async () => {
        return matchingPage.evaluate((propertyName) => {
            return window.getComputedStyle(document.documentElement)
                .getPropertyValue(propertyName)
                .trim();
        }, CSS_MARKER_PROPERTY);
    }).toBe(CSS_MARKER_VALUE);
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
    const nonMatchingCss = await nonMatchingPage.evaluate((propertyName) => {
        return window.getComputedStyle(document.documentElement)
            .getPropertyValue(propertyName)
            .trim();
    }, CSS_MARKER_PROPERTY);
    expect(nonMatchingCss).toBe('');
    await expect(nonMatchingPage.locator(INJECTED_STYLE)).toHaveCount(0);
});

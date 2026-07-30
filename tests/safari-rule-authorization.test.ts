/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { BrowserTarget } from '../src/app/common/browser-target';
import type { NewInjectionData } from '../src/app/common/contracts';
import { InjectionField } from '../src/app/common/constants';
import {
    SafariRuleAuthorizationError,
    saveRuleWithSafariAuthorization,
} from '../src/app/options/safari-rule-authorization';

const RULE: NewInjectionData = {
    site: 'example.com',
    jsPath: 'file:///tmp/scope/script.js',
    cssPath: 'file:///tmp/scope/style.css',
};

test('Safari authorizes JavaScript and CSS sequentially before persistence', async () => {
    const events: string[] = [];
    const authorizeFolder = vi.fn(async (fileUrl: string) => {
        events.push(`authorize:${fileUrl}`);
    });
    const persist = vi.fn(async () => {
        events.push('persist');
        return true;
    });

    await expect(saveRuleWithSafariAuthorization(
        BrowserTarget.Safari,
        RULE,
        { authorizeFolder },
        persist,
    )).resolves.toBe(true);

    expect(events).toEqual([
        `authorize:${RULE.jsPath}`,
        `authorize:${RULE.cssPath}`,
        'persist',
    ]);
});

test('Safari cancellation keeps the rule unpersisted and identifies its field', async () => {
    const persist = vi.fn(async () => true);
    const authorizeFolder = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('AUTHORIZATION_CANCELLED'));

    const result = saveRuleWithSafariAuthorization(
        BrowserTarget.Safari,
        RULE,
        { authorizeFolder },
        persist,
    );

    await expect(result).rejects.toEqual(expect.objectContaining({
        field: InjectionField.CssPath,
        code: 'AUTHORIZATION_CANCELLED',
    } satisfies Partial<SafariRuleAuthorizationError>));
    expect(persist).not.toHaveBeenCalled();
});

test.each([BrowserTarget.Chrome, BrowserTarget.Edge, BrowserTarget.Firefox])(
    '%s preserves the existing save flow without folder authorization',
    async (browserTarget) => {
        const authorizeFolder = vi.fn();
        const persist = vi.fn(async () => true);

        await expect(saveRuleWithSafariAuthorization(
            browserTarget,
            RULE,
            { authorizeFolder },
            persist,
        )).resolves.toBe(true);

        expect(authorizeFolder).not.toHaveBeenCalled();
        expect(persist).toHaveBeenCalledOnce();
    },
);

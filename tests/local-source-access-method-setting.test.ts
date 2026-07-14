/**
 * @file
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { BrowserTarget } from '../src/app/common/browser-target';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { LocalSourceAccessMethodSetting } from '../src/app/options/components/LocalSourceAccessMethodSetting';

vi.mock('../src/app/common/translator', () => ({
    translator: { getMessage: (key: string) => key },
}));

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    '%s renders browser and native-host choices with the browser description',
    (browserTarget) => {
        const html = renderToStaticMarkup(React.createElement(
            LocalSourceAccessMethodSetting,
            {
                browserTarget,
                method: LocalSourceAccessMethod.Browser,
                disabled: false,
                onChange: vi.fn(),
            },
        ));

        expect(html).toContain('local_source_method');
        expect(html).toContain('local_source_method_browser');
        expect(html).toContain('local_source_method_native_host');
        expect(html).toContain('local_source_method_browser_description');
        expect(html).not.toContain('local_source_method_native_host_description');
        expect(html).toContain('ant-radio-group');
        expect(html).toContain('aria-label="local_source_method"');
    },
);

test.each([BrowserTarget.Chrome, BrowserTarget.Edge])(
    '%s renders the native-host description when Native Host is selected',
    (browserTarget) => {
        const html = renderToStaticMarkup(React.createElement(
            LocalSourceAccessMethodSetting,
            {
                browserTarget,
                method: LocalSourceAccessMethod.NativeHost,
                disabled: false,
                onChange: vi.fn(),
            },
        ));

        expect(html).toContain('local_source_method_native_host_description');
        expect(html).not.toContain('local_source_method_browser_description');
    },
);

test('Firefox renders native-host mode without a selector', () => {
    const html = renderToStaticMarkup(React.createElement(
        LocalSourceAccessMethodSetting,
        {
            browserTarget: BrowserTarget.Firefox,
            method: LocalSourceAccessMethod.NativeHost,
            disabled: false,
            onChange: vi.fn(),
        },
    ));

    expect(html).toContain('local_source_method_native_host');
    expect(html).toContain('native_host_explanation');
    expect(html).not.toContain('local_source_method_native_host_description');
    expect(html).not.toContain('local_source_method_browser');
    expect(html).not.toContain('ant-radio-group');
});

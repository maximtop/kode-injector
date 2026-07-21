/**
 * @file
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { BrowserTarget } from '../src/app/common/browser-target';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { AccessMethodCards } from '../src/app/options/components/SettingsView/AccessMethodCards';

vi.mock('../src/app/common/translator', () => ({
    translator: { getMessage: (key: string) => key },
}));

vi.mock('webextension-polyfill', () => ({
    default: { runtime: {} },
}));

const renderCards = (
    browserTarget: BrowserTarget,
    method: LocalSourceAccessMethod,
    disabled = false,
): string => renderToStaticMarkup(React.createElement(
    AccessMethodCards,
    {
        browserTarget,
        method,
        disabled,
        onChange: () => undefined,
    },
));

test('chromium renders both selectable method cards', () => {
    const html = renderCards(BrowserTarget.Chrome, LocalSourceAccessMethod.Browser);

    expect(html).toContain('local_source_method_browser');
    expect(html).toContain('local_source_method_native_host');
    expect(html).toContain('tag_default');
    expect(html).toContain('local_source_method_advanced');
    expect(html).toContain('type="radio"');
});

test('chromium marks the active method card as selected', () => {
    const html = renderCards(BrowserTarget.Chrome, LocalSourceAccessMethod.NativeHost);

    expect(html).toContain('radio-card selected');
});

test('firefox locks the method to the helper without radio inputs', () => {
    const html = renderCards(BrowserTarget.Firefox, LocalSourceAccessMethod.NativeHost);

    expect(html).toContain('settings_firefox_helper_locked');
    expect(html).toContain('native_host_read_only');
    expect(html).not.toContain('type="radio"');
});

test('disabled selector disables both radio inputs', () => {
    const html = renderCards(BrowserTarget.Chrome, LocalSourceAccessMethod.Browser, true);

    expect(html.match(/disabled/g)?.length).toBeGreaterThanOrEqual(2);
});

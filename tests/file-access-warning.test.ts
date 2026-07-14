/**
 * @file
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { FileAccessWarning } from '../src/app/common/FileAccessWarning';
import { BrowserTarget } from '../src/app/common/browser-target';

vi.mock('../src/app/common/translator', () => ({
    translator: {
        getMessage: (key: string) => key,
    },
}));

test('allowed file access renders no warning', () => {
    const html = renderToStaticMarkup(React.createElement(FileAccessWarning, {
        allowed: true,
        browserTarget: BrowserTarget.Firefox,
        compact: false,
        onCheckAgain: undefined,
        onOpenSettings: undefined,
    }));

    expect(html).toBe('');
});

test('full Firefox warning renders Firefox instructions and a recheck action', () => {
    const html = renderToStaticMarkup(React.createElement(FileAccessWarning, {
        allowed: false,
        browserTarget: BrowserTarget.Firefox,
        compact: false,
        onCheckAgain: vi.fn(),
        onOpenSettings: undefined,
    }));

    expect(html).toContain('file_access_disabled');
    expect(html).toContain('file_access_instructions');
    expect(html).toContain('file_access_check_again');
    expect(html).toContain('file-access-warning-guidance');
    expect(html).toContain('file-access-warning-image-frame');
    expect(html).toContain('assets/img/firefox-local-file-access.png');
    expect(html).not.toContain('file_access_open_extension_settings');
    expect(html).not.toContain('ant-alert-action');
    expect(html.indexOf('file_access_check_again'))
        .toBeLessThan(html.indexOf('firefox-local-file-access.png'));
});

test.each([
    [BrowserTarget.Chrome, 'chrome-local-file-access.png'],
    [BrowserTarget.Edge, 'edge-local-file-access.png'],
] as const)('full %s warning renders its instructions image and settings action', (
    browserTarget,
    image,
) => {
    const html = renderToStaticMarkup(React.createElement(FileAccessWarning, {
        allowed: false,
        browserTarget,
        compact: false,
        onCheckAgain: vi.fn(),
        onOpenSettings: vi.fn(),
    }));

    expect(html).toContain(`assets/img/${image}`);
    expect(html).toContain('file_access_open_extension_settings');
    expect(html).not.toContain('popup_open_settings');
    expect(html).not.toContain('firefox-local-file-access.png');
});

test('compact warning renders popup guidance without a recheck action', () => {
    const html = renderToStaticMarkup(React.createElement(FileAccessWarning, {
        allowed: false,
        browserTarget: BrowserTarget.Edge,
        compact: true,
        onCheckAgain: undefined,
        onOpenSettings: vi.fn(),
    }));

    expect(html).toContain('popup_file_access_disabled');
    expect(html).not.toContain('file_access_check_again');
    expect(html).not.toContain('file_access_open_extension_settings');
    expect(html).not.toContain('local-file-access.png');
});

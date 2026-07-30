/**
 * @file
 */

import { expect, test } from 'vitest';

import { getBrowserCapabilities } from '../src/app/common/browser-capabilities';
import { BrowserTarget } from '../src/app/common/browser-target';
import {
    getDefaultLocalSourceAccessMethod,
    getSupportedLocalSourceAccessMethod,
    LocalSourceAccessMethod,
} from '../src/app/common/contracts';

test('Safari has a fixed embedded native source method', () => {
    expect(getBrowserCapabilities(BrowserTarget.Safari)).toMatchObject({
        nativeHostIsDefault: true,
        localSourceAccessMethodIsFixed: true,
        usesEmbeddedNativeHost: true,
        canOpenFileAccessSettings: false,
        canDownloadExternalHelper: false,
        nativeMessagingPermissionIsOptional: false,
    });
    expect(getDefaultLocalSourceAccessMethod(BrowserTarget.Safari))
        .toBe(LocalSourceAccessMethod.NativeHost);
    expect(getSupportedLocalSourceAccessMethod(
        LocalSourceAccessMethod.Browser,
        BrowserTarget.Safari,
    )).toBe(LocalSourceAccessMethod.NativeHost);
});

test('existing browser capability behavior remains unchanged', () => {
    expect(getBrowserCapabilities(BrowserTarget.Chrome)).toMatchObject({
        nativeHostIsDefault: false,
        localSourceAccessMethodIsFixed: false,
        nativeMessagingPermissionIsOptional: true,
    });
    expect(getBrowserCapabilities(BrowserTarget.Edge)).toMatchObject({
        nativeHostIsDefault: false,
        localSourceAccessMethodIsFixed: false,
        nativeMessagingPermissionIsOptional: true,
    });
    expect(getBrowserCapabilities(BrowserTarget.Firefox)).toMatchObject({
        nativeHostIsDefault: true,
        localSourceAccessMethodIsFixed: true,
        usesEmbeddedNativeHost: false,
    });
});

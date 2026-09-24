/**
 * @file Shared native host runtime services.
 */

import browser from 'webextension-polyfill';

import { BrowserTarget, getCurrentBrowserTarget } from '../common/browser-target';
import { SafariNativeClient } from '../common/safari-native-client';

import { NativeHostClient } from './native-host-client';
import { settings } from './settings';
import { SourceReader } from './source-reader';

const browserTarget = getCurrentBrowserTarget();

const externalNativeHostClient = new NativeHostClient((name) => {
    return browser.runtime.connectNative(name);
});

const safariNativeClient = browserTarget === BrowserTarget.Safari
    ? new SafariNativeClient(
        browser.runtime.sendNativeMessage.bind(browser.runtime),
    )
    : undefined;

export const nativeHostClient = browserTarget === BrowserTarget.Safari
    ? safariNativeClient as SafariNativeClient
    : externalNativeHostClient;

export const sourceReader = new SourceReader(
    nativeHostClient,
    (url) => globalThis.fetch(url),
    settings.getLocalSourceAccessMethod,
);

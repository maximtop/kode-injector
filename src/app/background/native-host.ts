/**
 * @file Shared native host runtime services.
 */

import browser from 'webextension-polyfill';

import { NativeHostClient, type NativePort } from './native-host-client';
import { SourceReader } from './source-reader';
import { settings } from './settings';
import { BrowserTarget, getCurrentBrowserTarget } from '../common/browser-target';
import {
    SafariNativeClient,
    type SafariNativeMessenger,
} from '../common/safari-native-client';

const browserTarget = getCurrentBrowserTarget();

const externalNativeHostClient = new NativeHostClient((name) => {
    return browser.runtime.connectNative(name) as unknown as NativePort;
});

const safariNativeClient = browserTarget === BrowserTarget.Safari
    ? new SafariNativeClient(
        browser.runtime.sendNativeMessage.bind(browser.runtime) as SafariNativeMessenger,
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

/**
 * @file Shared native host runtime services.
 */

import browser from 'webextension-polyfill';

import { NativeHostClient, type NativePort } from './native-host-client';
import { SourceReader } from './source-reader';
import { settings } from './settings';

export const nativeHostClient = new NativeHostClient((name) => {
    return browser.runtime.connectNative(name) as unknown as NativePort;
});

export const sourceReader = new SourceReader(
    nativeHostClient,
    (url) => globalThis.fetch(url),
    settings.getLocalSourceAccessMethod,
);

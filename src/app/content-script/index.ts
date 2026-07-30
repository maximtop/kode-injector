/**
 * @file
 */

import { log } from '../common/log';
import { messenger } from '../common/messenger';
import type { CssInjectionCode } from '../common/contracts';
import {
    createDocumentToken,
    DOCUMENT_TOKEN_ATTRIBUTE,
} from '../common/document-injection';

const dataSource = 'Kode Injector';
const documentToken = createDocumentToken();

/**
 * Marks this DOM with the identity used to guard asynchronous injections.
 */
const markDocument = (): HTMLElement | null => {
    const root = document.documentElement;
    if (!root) {
        return null;
    }
    root.setAttribute(DOCUMENT_TOKEN_ATTRIBUTE, documentToken);
    return root;
};

/**
 * Returns the node that should receive CSS without delaying source loading.
 *
 * @param root Current document root used when a head element is unavailable.
 */
const getCssInsertionNode = async (root: HTMLElement): Promise<HTMLElement> => {
    if (document.head) {
        return document.head;
    }
    if (document.readyState !== 'loading') {
        return root;
    }
    await new Promise<void>((resolve) => {
        document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    });
    return document.head || root;
};

/**
 * Appends injected CSS to the target document node.
 *
 * @param insertNode Document node that receives the style element.
 * @param cssCode CSS source to inject.
 */
const injectCss = (insertNode: HTMLElement, cssCode: string): void => {
    if (!cssCode) {
        return;
    }
    const style = document.createElement('style');
    style.setAttribute('data-source', dataSource);
    style.appendChild(document.createTextNode(cssCode));
    insertNode.appendChild(style);
};

/**
 * Fetches and injects CSS rules matching the current page.
 *
 * @param root Document root carrying the current document token.
 */
const inject = async (root: HTMLElement): Promise<void> => {
    const injections = await messenger.getInjectionsCode(documentToken);
    if (!injections || root.getAttribute(DOCUMENT_TOKEN_ATTRIBUTE) !== documentToken) {
        return;
    }
    if (injections.length === 0) {
        return;
    }
    const insertNode = await getCssInsertionNode(root);
    if (root.getAttribute(DOCUMENT_TOKEN_ATTRIBUTE) !== documentToken) {
        return;
    }
    injections.forEach(((injection: CssInjectionCode) => {
        const { css } = injection;
        injectCss(insertNode, css.code);
    }));
};

/**
 * Starts one document-bound source request and reports unexpected failures.
 *
 * @param root Document root carrying the current document token.
 */
const startInjection = (root: HTMLElement): void => {
    inject(root).catch((error) => {
        log.error('KI source injection failed', error);
    });
};

/**
 * Schedules content injection when the document is ready.
 */
const init = (): void => {
    const root = markDocument();
    if (root) {
        startInjection(root);
        return;
    }

    /**
     * Handles the uncommon case where document_start precedes the root element.
     */
    const handler = () => {
        const availableRoot = markDocument();
        if (!availableRoot) {
            return;
        }
        document.removeEventListener('readystatechange', handler);
        startInjection(availableRoot);
    };
    document.addEventListener('readystatechange', handler);
};

export const contentScript = {
    init,
};

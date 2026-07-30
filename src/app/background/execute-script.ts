/**
 * @file
 */

import { log } from '../common/log';
import type { ExecuteScriptPayload } from '../common/contracts';
import { DOCUMENT_TOKEN_ATTRIBUTE } from '../common/document-injection';

/**
 * Function executed in the target page's main world.
 *
 * @param script JavaScript source to execute.
 * @param documentToken Identity of the document that requested the injection.
 * @param documentTokenAttribute DOM attribute carrying the document identity.
 */
type InjectedFunction = (
    script: string,
    documentToken: string,
    documentTokenAttribute: string,
) => void;

/**
 * Appends an inline script to the page and removes its wrapper element.
 *
 * @param script JavaScript source to execute.
 * @param documentToken Identity of the document that requested the injection.
 * @param documentTokenAttribute DOM attribute carrying the document identity.
 */
const functionToInject: InjectedFunction = (
    script,
    documentToken,
    documentTokenAttribute,
) => {
    const root = document.documentElement;
    if (!root || root.getAttribute(documentTokenAttribute) !== documentToken) {
        return;
    }

    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('type', 'text/javascript');
    scriptTag.textContent = script;

    const parent = document.head || root;
    parent.appendChild(scriptTag);

    if (scriptTag.parentNode) {
        scriptTag.parentNode.removeChild(scriptTag);
    }
};

/**
 * Chrome scripting options for a main-world injection.
 */
type MainWorldScriptInjection = {
    /**
     * Target tab for the injection.
     */
    target: {
        /**
         * Target browser tab identifier.
         */
        tabId: number;
    };

    /**
     * Function executed in the target tab.
     */
    func: InjectedFunction;

    /**
     * Whether execution should begin without waiting for document readiness.
     */
    injectImmediately: boolean;

    /**
     * JavaScript world where the function executes.
     */
    world?: 'MAIN' | 'ISOLATED';

    /**
     * Ordered source and document-identity arguments passed to the injected function.
     */
    args: [
        script: string,
        documentToken: string,
        documentTokenAttribute: string,
    ];
};

/**
 * Injects JavaScript into the main world of a browser tab.
 *
 * @param script JavaScript source to inject.
 * @param tabId Target browser tab identifier.
 * @param documentToken Identity of the document that requested the injection.
 */
export const executeScript = async (
    script: ExecuteScriptPayload['script'],
    tabId: ExecuteScriptPayload['tabId'],
    documentToken: ExecuteScriptPayload['documentToken'],
): Promise<void> => {
    if (script.length === 0) {
        return;
    }

    if (typeof tabId !== 'number') {
        log.debug(`Error on executeScript in the tab ${tabId}:`, undefined, 'Missing tab id');
        return;
    }

    try {
        const options: MainWorldScriptInjection = {
            target: { tabId },
            func: functionToInject,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [
                script,
                documentToken,
                DOCUMENT_TOKEN_ATTRIBUTE,
            ],
        };
        await chrome.scripting.executeScript(options);
    } catch (e) {
        log.debug(
            `Error on executeScript in the tab ${tabId}:`,
            chrome.runtime.lastError,
            e,
        );
    }
};

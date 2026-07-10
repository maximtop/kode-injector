/**
 * @file
 */

import { log } from '../common/log';
import type { ExecuteScriptPayload } from '../common/contracts';

/**
 * Function executed in the target page's main world.
 */
type InjectedFunction = (script: string, loggingScript: string) => void;

/**
 * Appends an inline script to the page and removes its wrapper element.
 *
 * @param script JavaScript source to execute.
 * @param loggingScript Diagnostic logging source prepended to the script.
 */
const functionToInject: InjectedFunction = (script, loggingScript) => {
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('type', 'text/javascript');
    scriptTag.textContent = loggingScript + script;

    const parent = document.head || document.documentElement;
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
    target: { tabId: number };

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
     * Arguments passed to the injected function.
     */
    args: [string, string];
};

/**
 * Injects JavaScript into the main world of a browser tab.
 *
 * @param script JavaScript source to inject.
 * @param tabId Target browser tab identifier.
 * @param filePath Source file path used for diagnostic logging.
 */
export const executeScript = async (
    script: ExecuteScriptPayload['script'],
    tabId: ExecuteScriptPayload['tabId'],
    filePath: ExecuteScriptPayload['filePath'],
): Promise<void> => {
    if (script.length === 0) {
        return;
    }

    if (typeof tabId !== 'number') {
        log.debug(`Error on executeScript in the tab ${tabId}:`, undefined, 'Missing tab id');
        return;
    }

    const time = Date.now();
    try {
        const options: MainWorldScriptInjection = {
            target: { tabId },
            func: functionToInject,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [script, `;console.log("KI injected ${filePath} at ${time}");`],
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

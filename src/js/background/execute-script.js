import { log } from '../common/log';

/**
 * Executes provided scripts in the specified tab.
 *
 * @param script Scripts.
 * @param tabId Tab id.
 * @param filePath
 */
export const executeScript = async (script, tabId, filePath) => {
    if (script.length === 0) {
        return;
    }

    // eslint-disable-next-line no-shadow
    const functionToInject = (script, loggingScript) => {
        const scriptTag = document.createElement('script');
        scriptTag.setAttribute('type', 'text/javascript');
        scriptTag.textContent = loggingScript + script;

        const parent = document.head || document.documentElement;
        parent.appendChild(scriptTag);

        if (scriptTag.parentNode) {
            scriptTag.parentNode.removeChild(scriptTag);
        }
    };

    const time = Date.now();
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: functionToInject,
            injectImmediately: true,
            world: 'MAIN', // ISOLATED doesn't allow to execute code inline
            args: [script, `;console.log("KI injected ${filePath} at ${time}");`],
        });
    } catch (e) {
        log.debug(
            `Error on executeScript in the tab ${tabId}:`,
            chrome.runtime.lastError,
            e,
        );
    }
};

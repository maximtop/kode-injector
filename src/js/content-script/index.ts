/**
 * @file
 */

import { log } from '../common/log';
import { messenger } from '../common/messenger';
import type { CssInjectionCode } from '../common/contracts';

const dataSource = 'Kode Injector';

/**
 * Appends injected CSS to the target document node.
 *
 * @param insertNode Document node that receives the style element.
 * @param cssCode CSS source to inject.
 * @param filename Source filename used for diagnostic logging.
 */
const injectCss = (insertNode: HTMLElement, cssCode: string, filename: string): void => {
    if (!cssCode) {
        return;
    }
    const style = document.createElement('style');
    style.setAttribute('data-source', dataSource);
    style.appendChild(document.createTextNode(cssCode));
    insertNode.appendChild(style);
    log.debug(`KI injected ${filename} at ${Date.now()}`);
};

/**
 * Fetches and injects CSS rules matching the current page.
 */
const inject = async (): Promise<void> => {
    const head = document.getElementsByTagName('head')[0];
    // TODO can be received earlier
    const injections = await messenger.getInjectionsCode();
    if (!injections) {
        return;
    }
    injections.forEach(((injection: CssInjectionCode) => {
        const { css } = injection;
        injectCss(head, css.code, css.filename);
    }));
};

/**
 * Schedules content injection when the document is ready.
 */
const init = (): void => {
    if (document.readyState === 'complete') {
        inject();
    } else {
        /**
         * Injects content once the document reaches an interactive state.
         */
        const handler = () => {
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                inject();
                document.removeEventListener('readystatechange', handler);
            }
        };
        document.addEventListener('readystatechange', handler);
    }
};

export const contentScript = {
    init,
};

import { log } from '../common/log';
import { messenger } from '../common/messenger';

const dataSource = 'Kode Injector';

const injectCss = (insertNode, cssCode, filename) => {
    if (!cssCode) {
        return;
    }
    const style = document.createElement('style');
    style.setAttribute('data-source', dataSource);
    style.appendChild(document.createTextNode(cssCode));
    insertNode.appendChild(style);
    log.debug(`KI injected ${filename} at ${Date.now()}`);
};

const inject = async () => {
    const head = document.getElementsByTagName('head')[0];
    // TODO can be received earlier
    const injections = await messenger.getInjectionsCode();
    if (!injections) {
        return;
    }
    injections.forEach(((injection) => {
        const { css } = injection;
        injectCss(head, css.code, css.filename);
    }));
};

const init = () => {
    if (document.readyState === 'complete') {
        inject();
    } else {
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

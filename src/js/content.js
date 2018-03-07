import url from 'url';
import { getState } from './helpers/chromeStorage';

const dataSource = 'Kameleoon Injector';

const insertCss = (insertNode, cssCode, filename) => {
  const style = document.createElement('style');
  style.setAttribute('data-source', dataSource);
  style.type = 'text/css';
  if (style.styleSheet) { // IE Explorer
    style.styleSheet.cssText = cssCode;
  } else {
    style.appendChild(document.createTextNode(cssCode));
  }
  insertNode.appendChild(style);
  console.log(`KI injected ${filename} at ${Date.now()}`);
};

const insertJs = (insertNode, jsCode, filename) => {
  const script = document.createElement('script');
  script.setAttribute('data-source', dataSource);
  script.type = 'text/javascript';
  script.text = jsCode;
  insertNode.appendChild(script);
  console.log(`KI injected ${filename} at ${Date.now()}`);
};

const start = () => {
  const head = document.getElementsByTagName('head')[0];
  const tabUrl = url.parse(window.location.href);
  const tabHostname = tabUrl.hostname;
  chrome.storage.local.get('config', async ({ config }) => {
    // eslint-disable-next-line no-prototype-builtins
    const { isActivated } = await getState('isActivated');
    if (config.hasOwnProperty(tabHostname) && isActivated) {
      const injections = config[tabHostname];
      injections.forEach((injection) => {
        const { js, css } = injection;
        if (css.code) {
          if (css.code.error) {
            console.log(css.code.error);
          } else {
            insertCss(head, css.code, css.fileName);
          }
        }
        if (js.code) {
          if (js.code.error) {
            console.log(js.code.error);
          } else {
            insertJs(head, js.code, js.fileName);
          }
        }
      });
    }
  });
};

const check = setInterval(() => {
  if (document.getElementsByTagName('head')) {
    clearInterval(check);
    start();
  }
});


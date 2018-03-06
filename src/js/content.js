import url from 'url';
import { getState } from './helpers/chromeStorage';

const insertCss = (insertNode, cssCode) => {
  const style = document.createElement('style');
  style.setAttribute('data-source', cssCode);
  style.type = 'text/css';
  if (style.styleSheet) { // IE Explorer
    style.styleSheet.cssText = cssCode;
  } else {
    style.appendChild(document.createTextNode(cssCode));
  }
  insertNode.appendChild(style);
  console.log('content script css', Date.now());
};

const start = () => {
  const dataSource = 'Kameleoon Injector';
  const head = document.getElementsByTagName('head')[0];
  const script = document.createElement('script');
  script.setAttribute('data-source', dataSource);
  script.type = 'text/javascript';

  const tabUrl = url.parse(window.location.href);
  const tabHostname = tabUrl.hostname;
  chrome.storage.local.get('config', async ({ config }) => {
    // eslint-disable-next-line no-prototype-builtins
    console.log(config);
    const { isActivated } = await getState('isActivated');
    if (config.hasOwnProperty(tabHostname) && isActivated) {
      const { jsCode, cssCode } = config[tabHostname];
      if (cssCode) {
        if (cssCode.error) {
          console.log(cssCode.error);
        } else {
          insertCss(head, cssCode);
        }
      }
      if (jsCode) {
        if (jsCode.error) {
          console.log(jsCode.error);
        } else {
          script.text = jsCode;
          head.appendChild(script);
          console.log('content script js', Date.now());
        }
      }
    }
  });
};

const check = setInterval(() => {
  if (document.getElementsByTagName('head')) {
    clearInterval(check);
    start();
  }
});


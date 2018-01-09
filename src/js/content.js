import url from 'url';

const head = document.getElementsByTagName('head')[0];
const script = document.createElement('script');
script.setAttribute('data-source', 'Kameleoon injector');
script.type = 'text/javascript';

const style = document.createElement('style');
style.setAttribute('data-source', 'Kameleoon Injector');
style.type = 'text/css';
const tabUrl = url.parse(window.location.href);
const tabHostname = tabUrl.hostname;
chrome.storage.local.get('kInjector', ({ kInjector }) => {
  const { jsCode, cssCode } = kInjector[tabHostname];
  if (jsCode) {
    script.text = jsCode;
    head.appendChild(script);
  }
  if (cssCode) {
    if (style.styleSheet) { // IE Explorer
      style.styleSheet.cssText = cssCode;
    } else {
      style.appendChild(document.createTextNode(cssCode));
    }
    head.appendChild(style);
  }
});


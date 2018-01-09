import url from 'url';

const head = document.getElementsByTagName('head')[0];
const script = document.createElement('script');
script.setAttribute('data-source', 'Kameleoon injector');
script.type = 'text/javascript';
const tabUrl = url.parse(window.location.href);
const tabHostname = tabUrl.hostname;
chrome.storage.local.get('kInjector', ({ kInjector }) => {
  const { code } = kInjector[tabHostname];
  if (code) {
    script.text = code;
    head.appendChild(script);
  }
});


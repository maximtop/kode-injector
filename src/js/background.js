import url from 'url';
import '../img/icon-128.png';
import '../img/icon-34.png';

const bindings = {
  'stackoverflow.com': {
    jsFilePath: 'file:///home/maxim/Documents/test.js',
    cssFilePath: 'file:///home/maxim/Documents/test.css',
  },
};

const readFile = filePath => new Promise(((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.onerror = (error) => {
    reject(error);
  };
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      resolve(xhr.response);
    }
  };
  xhr.open('GET', filePath);
  xhr.send();
}));

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    const tabUrl = url.parse(tab.url);
    const { jsFilePath, cssFilePath } = bindings[tabUrl.hostname];
    let jsCode;
    let cssCode;
    if (jsFilePath) {
      jsCode = await readFile(jsFilePath);
    }
    if (cssFilePath) {
      cssCode = await readFile(cssFilePath);
    }
    // save code to chrome.storage.local
    chrome.storage.local.set(
      { kInjector: { [tabUrl.hostname]: { jsCode, cssCode } } },
      (e) => {
        console.log('successfully saved', e);
      },
    );
  }
});

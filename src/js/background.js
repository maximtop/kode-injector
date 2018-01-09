import url from 'url';
import '../img/icon-128.png';
import '../img/icon-34.png';

const bindings = { 'stackoverflow.com': { js: 'file:///home/maxim/Documents/test.js' } };

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
    const jsFilePath = bindings[tabUrl.hostname].js;
    let code;
    try {
      code = await readFile(jsFilePath);
    } catch (e) {
      console.log('Error: ', e);
    }
    if (code) {
      // save code to chrome.storage.local
      chrome.storage.local.set({ kInjector: { [tabUrl.hostname]: { code } } }, (e) => {
        console.log('successfully saved', e);
      });
    }
  }
});

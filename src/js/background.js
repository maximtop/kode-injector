import url from 'url';
import '../img/icon-128.png';
import '../img/icon-34.png';

const config = {
  'stackoverflow.com': {
    jsFilePath: 'file:///home/maxim/Documents/test.js',
    cssFilePath: 'file:///home/maxim/Documents/test.css',
  },
};

const readFile = filePath => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.onerror = (error) => {
    reject(error);
  };
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      resolve(xhr.response);
    }
  };
  xhr.open('GET', filePath, false);
  try {
    xhr.send();
  } catch (e) {
    reject(e);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    const tabUrl = url.parse(tab.url);
    // eslint-disable-next-line no-prototype-builtins
    if (config.hasOwnProperty(tabUrl.hostname)) {
      const { jsFilePath, cssFilePath } = config[tabUrl.hostname];
      let jsCode;
      let cssCode;
      if (jsFilePath) {
        try {
          jsCode = await readFile(jsFilePath);
        } catch (error) {
          jsCode = { error: error.message };
        }
      }
      if (cssFilePath) {
        try {
          cssCode = await readFile(cssFilePath);
        } catch (error) {
          cssCode = { error: error.message };
        }
      }
      // save code to chrome.storage.local
      chrome.storage.local.set(
        { config: { [tabUrl.hostname]: { jsCode, cssCode } } },
        (e) => {
          console.log('successfully saved', e);
        },
      );
    }
  }
});

import url from 'url';
import '../img/icon-128.png';
import '../img/icon-34.png';
import { getState } from './helpers/chromeStorage';

// TODO READ SITE NAMES WITH WWW AND WITHOUT THEM

const readFile = filePath => new Promise(((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.onloadend = (event) => {
    if (event.loaded > 0 && xhr.responseURL) {
      resolve(xhr.response);
    } else if (event.loaded === 0 && xhr.responseURL) {
      reject(new Error(`Seems that this file is empty: ${filePath}.`));
    } else {
      reject(new Error(`Seems that there is error with file path: ${filePath}.`));
    }
  };
  xhr.open('GET', filePath);
  xhr.send();
}));

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const { injections } = await getState();
  if (changeInfo.status === 'loading') {
    const tabUrl = url.parse(tab.url);
    const currentUrlInjections = Object.keys(injections).filter((key) => {
      const injection = injections[key];
      const { siteUrl } = injection;
      return siteUrl === tabUrl.hostname;
    });
    // TODO change method to work with multiple injections
    const currentInjectionId = currentUrlInjections[0];
    if (currentInjectionId) {
      const { jsPath, cssPath } = injections[currentInjectionId];
      let jsCode;
      let cssCode;
      if (jsPath) {
        try {
          jsCode = await readFile(jsPath);
        } catch (error) {
          jsCode = { error: error.message };
        }
      }
      if (cssPath) {
        try {
          cssCode = await readFile(cssPath);
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

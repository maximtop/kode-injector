import url from 'url';
import '../img/icon16.png';
import '../img/icon32.png';
import '../img/icon48.png';
import '../img/icon128.png';
import { getState, setState } from './helpers/chromeStorage';

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

chrome.runtime.onInstalled.addListener(async () => {
  await setState('isActivated', { isActivated: true });
});

const getFileName = filePath => filePath.split('/').slice(-2).join('/');

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const { injections } = await getState('state');
  if (changeInfo.status === 'loading') {
    const tabUrl = url.parse(tab.url);
    const currentUrlActiveInjectionsIds = Object.keys(injections).filter((key) => {
      const injection = injections[key];
      const { siteUrl, state } = injection;
      return siteUrl === tabUrl.hostname && state === 'active';
    });
    // TODO change method to work with multiple injections
    if (currentUrlActiveInjectionsIds.length > 0) {
      const generateConfig = (injections, idList) => Promise.all(idList.map(async (id) => {
        console.log(injections[id]);
        const { jsPath, cssPath } = injections[id];
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
        return {
          id,
          js: { fileName: getFileName(jsPath), code: jsCode },
          css: { fileName: getFileName(cssPath), code: cssCode },
        };
      }));
      const config = await generateConfig(injections, currentUrlActiveInjectionsIds);
      chrome.storage.local.set(
        { config: { [tabUrl.hostname]: config } },
        (event) => {
          console.log('successfully saved', event);
        },
      );
    } else {
      chrome.storage.local.set(
        { config: { [tabUrl.hostname]: [] } },
        (event) => {
          console.log('successfully removed injections', event);
        },
      );
    }
  }
});

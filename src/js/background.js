import url from 'url';
import '../img/icon-128.png';
import '../img/icon-34.png';

// TODO READ SITE NAMES WITH WWW AND WITHOUT THEM
const config = {
  'stackoverflow.com': {
    active: true,
    jsFilePath: 'file:///home/maxim/Documents/test.js',
    cssFilePath: 'file:///home/maxim/Documents/test.css',
  },
  'www.darty.com': {
    active: true,
    jsFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d%27achat-Notification-DAR_ACCOMP/index.js',
    cssFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d\'achat-Notification-DAR_ACCOMP/style.css',
  },
  'm.darty.com': {
    active: true,
    jsFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d%27achat-Notification-DAR_ACCOMP/index.js',
    cssFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/darty/DARTY-Guide-d\'achat-Notification-DAR_ACCOMP/style.css',
  },
  // 'www.shoppinglive.ru': {
  //   active: true,
  //   jsFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/shopinglive/src/index.js',
  //   cssFilePath: 'file:///home/maxim/Documents/projects/Kameleoon/shopinglive/src/style.css',
  // },
};

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
  if (changeInfo.status === 'loading') {
    const tabUrl = url.parse(tab.url);
    console.log(tabUrl);
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

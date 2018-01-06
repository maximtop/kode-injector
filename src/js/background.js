import '../img/icon-128.png'
import '../img/icon-34.png'

const filePath = 'file:///home/maxim/Documents/test.jsa'
const head = document.getElementsByTagName('head')[0]
const script = document.createElement('script')
script.setAttribute('data-source', 'Kameleoon injector')
script.type = 'text/javascript'
let code = ''
const readFile = (filePath) => {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest()
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        resolve(xhr.response)
      }
    }
    xhr.ontimeout = function () {
      reject('timeout')
    }
    xhr.open('GET', filePath)
    xhr.send()
  })
}

chrome.tabs.onUpdated.addListener(async function (tabId, change) {
  console.log(tabId)
  try {
    code = await readFile(filePath)
  } catch (e) {
    console.log('Error:' + e)
  }
  if (change.status === 'complete') {
    chrome.tabs.executeScript(tabId, { code: code })
  }
})
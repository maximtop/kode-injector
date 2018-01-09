import url from 'url'

let code
const head = document.getElementsByTagName('head')[0]
const script = document.createElement('script')
script.setAttribute('data-source', 'Kameleoon injector')
script.type = 'text/javascript'
const tabUrl = url.parse(window.location.href)
const tabHostname = tabUrl.hostname
console.log(tabHostname)
chrome.storage.local.get('kInjector', ({ kInjector }) => {
  const { code } = kInjector[tabHostname]
  console.log(code)
  if (code) {
    script.text = code
    head.appendChild(script)
  }
})


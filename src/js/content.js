let code
const head = document.getElementsByTagName('head')[0]
const script = document.createElement('script')
script.setAttribute('data-source', 'Kameleoon injector')
script.type = 'text/javascript'
chrome.storage.local.get('code', ({ code }) => {
  if (code) {
    script.text = code;
    head.appendChild(script);
  }
})


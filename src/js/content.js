let code;
const head = document.getElementsByTagName('head')[0]
const script = document.createElement('script')
script.setAttribute('data-source', 'Kameleoon injector')
script.type = 'text/javascript'
chrome.runtime.onMessage.addListener(
  function(request) {
    console.log(request);
    if (request.code)
      code = request.code;
      console.log(request.code);
      script.text = code;
      head.appendChild(script);
  });


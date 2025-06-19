// Ce content script relaie le message de skip au background
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'STEAM_SCANNER_SKIP_PROFILE') {
    chrome.runtime.sendMessage({ action: 'skip' });
  }
}); 
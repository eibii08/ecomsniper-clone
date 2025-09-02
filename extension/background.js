// background.js (service worker)
chrome.runtime.onInstalled.addListener(() => {
  console.log("EcomSniper extension installed");
});

// Allow popup to open auth url in a new tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "OPEN_AUTH") {
    const url = msg.url;
    chrome.tabs.create({ url }, (tab) => {
      sendResponse({ ok: true });
    });
    return true; // keep channel open
  }
});

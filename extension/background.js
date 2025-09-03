chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AMAZON_PRODUCT") {
    // Nachricht an das Popup weiterleiten
    chrome.runtime.sendMessage(msg);
  }
});

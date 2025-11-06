chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openPopup") {
    chrome.action.openPopup(); // Opens your popup.html
  }
});

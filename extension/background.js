chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openPopup") {
    chrome.action.openPopup(); // Opens your popup.html
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_RESUME_EMBEDDING") {
    chrome.storage.local.get("resumeEmbedding").then((data) => {
      sendResponse({ resume_embedding: data.resumeEmbedding });
    });
    return true; // keeps the message channel open for async
  }
});
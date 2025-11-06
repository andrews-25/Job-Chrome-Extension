const uploadBtn = document.getElementById("uploadBtn");
const clearBtn = document.getElementById("clearBtn");
const fileInput = document.getElementById("resumeFile");
const statusEl = document.getElementById("status");

// ---- Utility: Check if resume is uploaded ----
async function hasResume() {
  const { resumeEmbedding, resumeFilename } = await chrome.storage.local.get([
    "resumeEmbedding",
    "resumeFilename",
  ]);
  return !!(resumeEmbedding && resumeFilename);
}

// ---- UI helpers ----
function toggleElements({ showUpload = true, showCurrent = false }) {
  fileInput.style.display = showUpload ? "block" : "none";
  uploadBtn.style.display = showUpload ? "inline-block" : "none";
  clearBtn.style.display = showCurrent ? "inline-block" : "none";
}

async function updateUI() {
  if (await hasResume()) {
    const { resumeFilename } = await chrome.storage.local.get("resumeFilename");
    statusEl.textContent = `✅ Current resume: ${resumeFilename}`;
    statusEl.style.color = "green";
    toggleElements({ showUpload: false, showCurrent: true });
  } else {
    statusEl.textContent = "⚠️ No resume uploaded";
    statusEl.style.color = "orange";
    toggleElements({ showUpload: true, showCurrent: false });
  }
}

// ---- Initialize on popup open ----
window.addEventListener("DOMContentLoaded", async () => {
  console.log("[JobFit] Popup loaded");
  await updateUI();
});

// ---- Upload resume ----
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    statusEl.textContent = "Please select a PDF first.";
    statusEl.style.color = "red";
    return;
  }

  statusEl.textContent = "Uploading...";
  statusEl.style.color = "black";

  try {
    const formData = new FormData();
    formData.append("file", file);

    console.log("[JobFit] Uploading resume to backend:", file.name);

    const response = await fetch("http://127.0.0.1:8000/upload_resume", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[JobFit] Server error:", text);
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    console.log("[JobFit] Backend response:", result);

    const embedding = result.embedding_preview || [];

    await chrome.storage.local.set({
      resumeEmbedding: embedding,
      resumeFilename: file.name,
    });


    // Clear old scores since we have a new resume
    await chrome.storage.local.remove(["jobScores"]);




    console.log("[JobFit] Resume saved to storage:", file.name);

    await updateUI();

    // Notify content script
    console.log("[JobFit] Sending RESUME_UPLOADED to content script...");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      for (const tab of tabs) {
        console.log(`[JobFit] → Notifying tab ${tab.id}`);
        chrome.tabs.sendMessage(tab.id, { action: "RESUME_UPLOADED" });
      }
    });

  } catch (err) {
    console.error("[JobFit] Upload error:", err);
    statusEl.textContent = `Failed to upload: ${err.message}`;
    statusEl.style.color = "red";
  }
});

// ---- Clear resume ----
clearBtn.addEventListener("click", async () => {
  console.log("[JobFit] Clearing resume data...");
  await chrome.storage.local.remove(["resumeEmbedding", "resumeFilename", "jobScores"]);
  await updateUI();

  // Notify content script
  console.log("[JobFit] Sending RESUME_CLEARED to content script...");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    for (const tab of tabs) {
      console.log(`[JobFit] → Notifying tab ${tab.id}`);
      chrome.tabs.sendMessage(tab.id, { action: "RESUME_CLEARED" });
    }
  });
});

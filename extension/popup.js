const uploadBtn = document.getElementById("uploadBtn");
const clearBtn = document.getElementById("clearBtn");
const fileInput = document.getElementById("resumeFile");
const statusEl = document.getElementById("status");

// Utility to show/hide elements
function toggleElements({ showUpload = true, showCurrent = false }) {
  fileInput.style.display = showUpload ? "block" : "none";
  uploadBtn.style.display = showUpload ? "inline-block" : "none";

  clearBtn.style.display = showCurrent ? "inline-block" : "none";
}

// Update UI based on whether a resume exists
async function updateUI() {
  const { resumeFilename } = await chrome.storage.local.get("resumeFilename");

  if (resumeFilename) {
    statusEl.textContent = `✅ Current resume: ${resumeFilename}`;
    statusEl.style.color = "green";
    toggleElements({ showUpload: false, showCurrent: true });
  } else {
    statusEl.textContent = "⚠️ No resume uploaded";
    statusEl.style.color = "orange";
    toggleElements({ showUpload: true, showCurrent: false });
  }
}

// Call on load
window.addEventListener("DOMContentLoaded", updateUI);

// Upload resume PDF
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

    console.log("Sending file to backend:", file);

    const response = await fetch("http://127.0.0.1:8000/upload_resume", {
      method: "POST",
      body: formData,
    });

    console.log("Raw response object:", response);

    if (!response.ok) {
      const text = await response.text();
      console.error("Server responded with error:", text);
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Parsed JSON response from backend:", result);

    const embedding = result.embedding_preview || [];
    await chrome.storage.local.set({ resumeEmbedding: embedding, resumeFilename: file.name });

    statusEl.textContent = `✅ Current resume: ${file.name}`;
    statusEl.style.color = "green";
    toggleElements({ showUpload: false, showCurrent: true });
  } catch (err) {
    console.error("Upload error:", err);
    statusEl.textContent = `Failed to upload: ${err.message}`;
    statusEl.style.color = "red";
  }
});

// Clear resume embedding
clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["resumeEmbedding", "resumeFilename"]);
  statusEl.textContent = "⚠️ No resume uploaded";
  statusEl.style.color = "orange";
  fileInput.value = "";
  toggleElements({ showUpload: true, showCurrent: false });
});

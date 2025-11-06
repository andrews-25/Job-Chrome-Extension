const uploadBtn = document.getElementById("uploadBtn");
const clearBtn = document.getElementById("clearBtn");
const fileInput = document.getElementById("resumeFile");
const statusEl = document.getElementById("status");

// Update button text based on whether a resume exists
async function updateButtonText() {
  const { resumeFilename } = await chrome.storage.local.get("resumeFilename");
  if (resumeFilename) {
    uploadBtn.textContent = `Change Resume (${resumeFilename})`;
    statusEl.textContent = `✅ Current resume: ${resumeFilename}`;
    statusEl.style.color = "green";
  } else {
    uploadBtn.textContent = "Upload Resume";
    statusEl.textContent = "⚠️ No resume uploaded";
    statusEl.style.color = "orange";
  }
}

// Call on load
window.addEventListener("DOMContentLoaded", updateButtonText);

// Upload resume PDF and store returned embedding
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
      const text = await response.text(); // get error text for logging
      console.error("Server responded with error:", text);
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Parsed JSON response from backend:", result);

    const embedding = result.embedding_preview || [];
    await chrome.storage.local.set({ resumeEmbedding: embedding, resumeFilename: file.name });

    statusEl.textContent = `✅ Resume uploaded: ${file.name}`;
    statusEl.style.color = "green";
    updateButtonText();
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
  uploadBtn.textContent = "Upload Resume";
  fileInput.value = "";
});

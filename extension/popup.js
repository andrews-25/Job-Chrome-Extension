const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("resumeFile");
const statusEl = document.getElementById("status");

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

    const response = await fetch("http://localhost:8000/upload_resume", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    console.log("Backend response:", result);

    // Store embedding locally in Chrome
    const embedding = result.embedding_preview || [];
    await chrome.storage.local.set({ resumeEmbedding: embedding });

    statusEl.textContent = "✅ Resume uploaded and embedding saved!";
    statusEl.style.color = "green";
  } catch (err) {
    console.error("Upload error:", err);
    statusEl.textContent = "Failed to upload resume.";
    statusEl.style.color = "red";
  }
});

// Check if embedding exists on load
window.addEventListener("DOMContentLoaded", async () => {
  const { resumeEmbedding } = await chrome.storage.local.get("resumeEmbedding");
  if (resumeEmbedding) {
    statusEl.textContent = "✅ Resume embedding already uploaded";
    statusEl.style.color = "green";
  } else {
    statusEl.textContent = "⚠️ No resume uploaded";
    statusEl.style.color = "orange";
  }
});

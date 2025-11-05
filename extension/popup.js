const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("resumeFile");
const statusEl = document.getElementById("status");

// Upload and extract resume text locally
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    statusEl.textContent = "Please select a PDF first.";
    statusEl.style.color = "red";
    return;
  }

  statusEl.textContent = "Processing...";
  statusEl.style.color = "black";

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const pdfData = new Uint8Array(e.target.result);
      const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs");
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

      let text = "";
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(" ") + "\n";
      }

      // Store the resume text locally
      await chrome.storage.local.set({ resumeText: text });

      statusEl.textContent = "✅ Resume uploaded and saved locally!";
      statusEl.style.color = "green";
    };

    reader.readAsArrayBuffer(file);
  } catch (err) {
    console.error("Error reading PDF:", err);
    statusEl.textContent = "Failed to process resume.";
    statusEl.style.color = "red";
  }
});

// Check if resume exists on load
window.addEventListener("DOMContentLoaded", async () => {
  const { resumeText } = await chrome.storage.local.get("resumeText");
  if (resumeText) {
    statusEl.textContent = "✅ Resume already uploaded";
    statusEl.style.color = "green";
  } else {
    statusEl.textContent = "⚠️ No resume uploaded";
    statusEl.style.color = "orange";
  }
});

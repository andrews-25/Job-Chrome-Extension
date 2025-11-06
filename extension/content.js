console.log("[JobFit] Content script loaded.");

// ---- In-memory cache ----
const jobCache = {};
const pendingTokens = {};

// ---- Utility: Check if resume exists ----
async function hasResume() {
  const { resumeEmbedding, resumeFilename } = await chrome.storage.local.get([
    "resumeEmbedding",
    "resumeFilename",
  ]);
  return !!(resumeEmbedding && resumeFilename);
}

// ---- Connect to backend ----
async function getScore({ jobId, title, company, location, description }) {
  try {
    const { resume_embedding } = await chrome.runtime.sendMessage({
      action: "GET_RESUME_EMBEDDING",
    });
    if (!resume_embedding) return { score: 0, feedback: "Resume embedding not found." };

    const response = await fetch("http://127.0.0.1:8000/getscore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, description, resume_embedding }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();

    const existingScores = (await chrome.storage.local.get("jobScores")).jobScores || {};
    existingScores[jobId] = data.score;
    await chrome.storage.local.set({ jobScores: existingScores });

    return { score: data.score, feedback: data.feedback || "OK" };
  } catch (err) {
    console.error("[JobFit] getScore error:", err);
    return { score: 0, feedback: "Error fetching score." };
  }
}

// ---- Wait for job description to stabilize ----
async function waitForDescription({ title, timeout = 5000, pollInterval = 200, stableMs = 500 } = {}) {
  const start = Date.now();
  let last = "";
  let stableSince = null;

  return new Promise((resolve) => {
    const check = () => {
      const descEl =
        document.getElementById("jobDescriptionText") ||
        document.querySelector(".jobsearch-JobComponent-description");
      const text = descEl ? descEl.innerText.trim() : "";

      if (title && text && text.toLowerCase().includes(title.toLowerCase())) {
        resolve(text);
        return;
      }

      if (text !== last) {
        last = text;
        stableSince = Date.now();
      } else if (text && stableSince && Date.now() - stableSince >= stableMs) {
        resolve(text);
        return;
      }

      if (Date.now() - start > timeout) {
        resolve(last);
        return;
      }

      setTimeout(check, pollInterval);
    };
    check();
  });
}

// ---- Create or update badge ----
function createOrUpdateBadge(card, resumeExists) {
  const titleEl = card.querySelector("h2 span") || card.querySelector("h2");
  if (!titleEl) return null;

  let badge = titleEl.querySelector(".jobfit-badge");

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "jobfit-badge";
    badge.style.color = "white";
    badge.style.borderRadius = "4px";
    badge.style.padding = "2px 6px";
    badge.style.marginLeft = "6px";
    badge.style.fontSize = "0.8em";
    badge.style.fontWeight = "700";
    badge.style.cursor = "default";
    titleEl.appendChild(badge);
  }

  // Reset badge text & color if no score exists yet
  if (!badge.dataset.scored) {
    badge.textContent = resumeExists ? " Click to rate" : " Upload Resume";
    badge.style.backgroundColor = resumeExists ? "#2e7d32" : "#666666ff";
  }

  return badge;
}

// ---- Process a single job card ----
async function processJobCard(card) {
  if (card.dataset.jobfitProcessed === "true") return;
  card.dataset.jobfitProcessed = "true";

  const jobId = card.getAttribute("data-jk") || "";
  const initialTitle = (card.querySelector("h2 span") || card.querySelector("h2"))?.innerText?.trim() || "";

  const resumeExists = await hasResume();
  const badge = createOrUpdateBadge(card, resumeExists);
  if (!badge) return;

  const clickHandler = async () => {
    // Re-check resume existence at click time instead of using captured value
    const currentResumeExists = await hasResume();
    if (!currentResumeExists) return;

    // Reset other loading badges
    Object.entries(pendingTokens).forEach(([id]) => {
      if (id !== jobId) {
        const other = document.querySelector(`[data-jk="${id}"] .jobfit-badge`);
        if (other && other.textContent.includes("loading")) {
          other.textContent = " Click to rate";
          other.style.backgroundColor = "#2e7d32";
        }
        delete pendingTokens[id];
      }
    });

    const token = Symbol();
    pendingTokens[jobId] = token;

    badge.textContent = " ⏳ loading";
    badge.style.backgroundColor = "#f57c00";

    try {
      const description = await waitForDescription({ title: initialTitle, timeout: 6000 });
      if (pendingTokens[jobId] !== token) return;

      const detailPane = document.querySelector("#jobsearch-ViewjobPaneWrapper, .jobsearch-JobComponent");
      const title = detailPane?.querySelector("h1")?.innerText?.trim() || initialTitle;
      const company =
        detailPane?.querySelector('[data-testid="inlineHeader-companyName"]')?.innerText?.trim() ||
        detailPane?.querySelector(".jobsearch-InlineCompanyRating div:first-child")?.innerText?.trim() ||
        "";
      const location =
        detailPane?.querySelector('[data-testid="inlineHeader-companyLocation"]')?.innerText?.trim() ||
        detailPane?.querySelector(".jobsearch-JobInfoHeader-subtitle div:last-child")?.innerText?.trim() ||
        "";

      const { score, feedback } = await getScore({ jobId, title, company, location, description });
      if (pendingTokens[jobId] !== token) return;

      jobCache[jobId || title] = { jobId, title, company, location, description, score, feedback };

      badge.textContent = score;
      badge.dataset.scored = "true";
      badge.style.backgroundColor = score >= 8 ? "#2e7d32" : score >= 6 ? "#fbc02d" : "#c62828";

      console.log("[JobFit] Job scored:", { jobId, title, company, score, feedback });
    } catch (err) {
      console.error("[JobFit] JobFit error:", err);
      badge.textContent = " !err";
      badge.style.backgroundColor = "#b00020";
    } finally {
      delete pendingTokens[jobId];
    }
  };

  if (!card.dataset.jobfitListener) {
    card.addEventListener("click", clickHandler, { capture: true });
    card.dataset.jobfitListener = "true";
  }
}

// ---- Initial scan ----
document.querySelectorAll("[data-jk]").forEach(processJobCard);

// ---- Observe dynamic job cards ----
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches && node.matches("[data-jk]")) processJobCard(node);
      if (node.querySelectorAll) node.querySelectorAll("[data-jk]").forEach(processJobCard);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// ---- Refresh badges & click handlers on resume change ----
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === "RESUME_UPLOADED" || msg.action === "RESUME_CLEARED") {
    console.log("[JobFit] Refreshing badges due to", msg.action);
    const cards = document.querySelectorAll("[data-jk]");
    for (const card of cards) {
      // Reset BOTH flags so processJobCard will fully reinitialize
      card.dataset.jobfitProcessed = "false";
      card.dataset.jobfitListener = "false";

      // Reset scored flag so badge updates
      const badge = (card.querySelector("h2 span") || card.querySelector("h2"))?.querySelector(".jobfit-badge");
      if (badge) badge.dataset.scored = "";

      await processJobCard(card);
    }
    console.log("[JobFit] Badge & handler refresh complete");
  }
});
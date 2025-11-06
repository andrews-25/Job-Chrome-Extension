console.log("JobFit content script loaded.");

const jobCache = {};
const pendingTokens = {};

async function getScore({ title, company, location, description }) {
  await new Promise((res) => setTimeout(res, 500));

  const keywords = ["finance", "data", "analysis", "energy", "trading", "python", "sql", "market"];
  const descLower = description.toLowerCase();

  let matchCount = 0;
  for (const word of keywords) {
    if (descLower.includes(word)) matchCount++;
  }

  const score = Math.min(10, Math.round((matchCount / keywords.length) * 10)) || 5;

  const feedback =
    score > 8
      ? "Strong match! This role fits your likely skill set well."
      : score > 5
      ? "Moderate match. Some overlap, but review the details."
      : "Weak match. Probably not ideal for your profile.";

  return { score, feedback };
}

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

function makeBadge(text = "Click") {
  const badge = document.createElement("span");
  badge.className = "jobfit-badge";
  badge.textContent = ` ${text}`;
  badge.style.color = "white";
  badge.style.backgroundColor = "#2e7d32";
  badge.style.borderRadius = "4px";
  badge.style.padding = "2px 6px";
  badge.style.marginLeft = "6px";
  badge.style.fontSize = "0.8em";
  badge.style.fontWeight = "700";
  badge.style.cursor = "default";
  return badge;
}

async function processJobCard(card) {
  if (card.dataset.jobfitProcessed) return;

  const titleEl = card.querySelector("h2 span") || card.querySelector("h2");
  if (!titleEl) return;

  const jobId = card.getAttribute("data-jk") || "";
  const initialTitle = titleEl.innerText?.trim() || "";

  let badge = titleEl.querySelector(".jobfit-badge");
  if (!badge) {
    badge = makeBadge("Click to rate");
    titleEl.appendChild(badge);
  }

  // --- NEW: check if user has a resume uploaded ---
  const { resumeFilename } = await chrome.storage.local.get("resumeFilename");

  if (!resumeFilename) {
  badge.textContent = " Upload resume to get eval";
  badge.style.backgroundColor = "#757575";
  badge.style.cursor = "pointer";

  // Click opens the popup and stops propagation
  badge.onclick = (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: "openPopup" });
  };

  card.dataset.jobfitProcessed = "true";
  return; // Skip scoring logic
}

  // If resume exists, normal badge
  badge.textContent = " Click to rate";
  badge.style.backgroundColor = "#2e7d32";
  badge.style.cursor = "default";

  const clickHandler = async () => {
    const { resumeText } = await chrome.storage.local.get("resumeText");
    if (!resumeText) {
      badge.textContent = " Upload resume to get eval";
      badge.style.backgroundColor = "#757575";
      return;
    }

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
    if (jobId) pendingTokens[jobId] = token;

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

      if (pendingTokens[jobId] !== token) return;

      const { score, feedback } = await getScore({ title, company, location, description });
      if (pendingTokens[jobId] !== token) return;

      jobCache[jobId || title] = { jobId, title, company, location, description, score, feedback };

      badge.textContent = ` ${score}/10`;
      badge.style.backgroundColor = score >= 8 ? "#2e7d32" : score >= 6 ? "#fbc02d" : "#c62828";

      console.log("Job scraped:", {
        jobId,
        title,
        company,
        location,
        score,
        feedback,
        descriptionSnippet: description.slice(0, 120),
      });
    } catch (err) {
      console.error("JobFit error while fetching description:", err);
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

  card.dataset.jobfitProcessed = "true";
}

document.querySelectorAll("[data-jk]").forEach(processJobCard);

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

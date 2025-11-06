console.log("JobFit content script loaded.");

// In-memory cache for scraped jobs
const jobCache = {};
// Track ongoing requests to avoid race conditions
const pendingTokens = {};

// Local scoring function (placeholder for backend)
async function getScore({ title, company, location, description }) {

  return {score};
}

// Wait for job description to stabilize or contain title
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

// Create UI badge element
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

// Process individual job cards
function processJobCard(card) {
  if (card.dataset.jobfitProcessed) return;

  const titleEl = card.querySelector("h2 span") || card.querySelector("h2");
  if (!titleEl) return;

  const jobId = card.getAttribute("data-jk") || "";
  const initialTitle = titleEl.innerText?.trim() || "";

  let badge = titleEl.querySelector(".jobfit-badge");
  if (!badge) {
    badge = makeBadge("Click to rate");
    titleEl.appendChild(badge);
  } else {
    badge.style.backgroundColor = "#2e7d32";
  }

  const clickHandler = async () => {
    // Reset any other loading badges
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

      // Compute local score
      const { score, feedback } = await getScore({ title, company, location, description });
      if (pendingTokens[jobId] !== token) return;

      // Save results in cache
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

// Initial scan for job cards
document.querySelectorAll("[data-jk]").forEach(processJobCard);

// Watch for dynamically added job cards
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

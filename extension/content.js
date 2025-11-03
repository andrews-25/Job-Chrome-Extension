console.log("JobFit content script loaded.");

// in-memory cache for clicked job descriptions
const jobCache = {};
// protect against races: pending token per jobId
const pendingTokens = {};

// waitForDescription: resolves with the stable description text after it settles or contains the title
async function waitForDescription({ title, timeout = 5000, pollInterval = 200, stableMs = 500 } = {}) {
  const start = Date.now();
  let last = "";
  let stableSince = null;

  return new Promise((resolve) => {
    const check = () => {
      const descEl = document.getElementById("jobDescriptionText") || document.querySelector(".jobsearch-JobComponent-description");
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

// Create badge element
function makeBadge(text = "Click") {
  const badge = document.createElement("span");
  badge.className = "jobfit-badge";
  badge.textContent = ` ${text}`;
  badge.style.color = "white";
  badge.style.backgroundColor = "#2e7d32"; // green
  badge.style.borderRadius = "4px";
  badge.style.padding = "2px 6px";
  badge.style.marginLeft = "6px";
  badge.style.fontSize = "0.8em";
  badge.style.fontWeight = "700";
  badge.style.cursor = "default";
  return badge;
}

// Main per-card processing
function processJobCard(card) {
  if (card.dataset.jobfitProcessed) return;

  const titleEl = card.querySelector("h2 span") || card.querySelector("h2");
  if (!titleEl) return;

  const jobId = card.getAttribute("data-jk") || "";
  const initialTitle = titleEl.innerText?.trim() || "";

  // Create or reuse badge
  let badge = titleEl.querySelector(".jobfit-badge");
  if (!badge) {
    badge = makeBadge("Click to rate");
    titleEl.appendChild(badge);
  } else {
    badge.style.backgroundColor = "#2e7d32";
  }

  // Click handler: fetch all info from open description pane
  const clickHandler = async () => {
    try {
      const token = Symbol();
      if (jobId) pendingTokens[jobId] = token;

      badge.textContent = " ⏳ loading";
      badge.style.backgroundColor = "#f57c00";

      // Wait for the description panel
      const description = await waitForDescription({ title: initialTitle, timeout: 6000 });

      const detailPane = document.querySelector("#jobsearch-ViewjobPaneWrapper, .jobsearch-JobComponent");

      const title = detailPane?.querySelector('h1')?.innerText?.trim() || initialTitle;
      const company = (
        detailPane?.querySelector('[data-testid="inlineHeader-companyName"]')?.innerText?.trim() ||
        detailPane?.querySelector('.jobsearch-InlineCompanyRating div:first-child')?.innerText?.trim() ||
        ""
      );
      const location = (
        detailPane?.querySelector('[data-testid="inlineHeader-companyLocation"]')?.innerText?.trim() ||
        detailPane?.querySelector('.jobsearch-JobInfoHeader-subtitle div:last-child')?.innerText?.trim() ||
        ""
      );

      if (jobId && pendingTokens[jobId] !== token) return;

      jobCache[jobId || title] = { jobId, title, company, location, description };

      const placeholderScore = 7;
      badge.textContent = ` ${placeholderScore}/10`;
      badge.style.backgroundColor = "#2e7d32";

      console.log("Job scraped:", { jobId, title, company, location, descriptionSnippet: description.slice(0, 120) });
    } catch (err) {
      console.error("JobFit error while fetching description:", err);
      badge.textContent = " !err";
      badge.style.backgroundColor = "#b00020";
    }
  };

  if (!card.dataset.jobfitListener) {
    card.addEventListener("click", clickHandler, { capture: true });
    card.dataset.jobfitListener = "true";
  }

  card.dataset.jobfitProcessed = "true";
}

// Initial run & MutationObserver
document.querySelectorAll("[data-jk]").forEach(processJobCard);

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;

      if (node.matches && node.matches("[data-jk]")) processJobCard(node);
      if (node.querySelectorAll) node.querySelectorAll("[data-jk]").forEach(processJobCard);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

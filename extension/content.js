console.log("JobFit content script loaded.");

// in-memory cache for clicked job descriptions
const jobCache = {};
// protect against races: pending token per jobId
const pendingTokens = {};

// Helpers for company/location selectors (fallback chaining)
function extractCompany(card) {
  return (
    card.querySelector(".css-1afmp4o.e37uo190")?.innerText?.trim() ||
    card.querySelector(".company_name, .companyName, .company")?.innerText?.trim() ||
    card.querySelector(".company_location.css-i375s1.e37uo190")?.innerText?.trim() ||
    ""
  );
}
function extractLocation(card) {
  return (
    card.querySelector(".company_location.css-i375s1.e37uo190")?.innerText?.trim() ||
    card.querySelector(".css-1restlb.eu4oa1w0")?.innerText?.trim() ||
    card.querySelector(".location, .companyLocation")?.innerText?.trim() ||
    ""
  );
}

// waitForDescription: resolves with the stable description text after it settles or contains the title
async function waitForDescription({ title, timeout = 5000, pollInterval = 200, stableMs = 500 } = {}) {
  const start = Date.now();
  let last = "";
  let stableSince = null;

  return new Promise((resolve) => {
    const check = () => {
      const descEl = document.getElementById("jobDescriptionText") || document.querySelector(".jobsearch-JobComponent-description");
      const text = descEl ? descEl.innerText.trim() : "";

      // If description contains the title (strong signal), accept it immediately.
      if (title && text && text.toLowerCase().includes(title.toLowerCase())) {
        resolve(text);
        return;
      }

      // If text changed, reset stability timer
      if (text !== last) {
        last = text;
        stableSince = Date.now();
      } else if (text && stableSince && Date.now() - stableSince >= stableMs) {
        // text unchanged for stableMs -> accept
        resolve(text);
        return;
      }

      // Timeout fallback: if we've waited too long, accept whatever we have (may be empty)
      if (Date.now() - start > timeout) {
        resolve(last);
        return;
      }

      setTimeout(check, pollInterval);
    };

    // immediate check first
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
  const titleText = titleEl.innerText?.trim() || "";

  // Create or reuse badge
  let badge = titleEl.querySelector(".jobfit-badge");
  if (!badge) {
    badge = makeBadge("Click to rate");
    titleEl.appendChild(badge);
  } else {
    // ensure styling if accidentally lost
    badge.style.backgroundColor = "#2e7d32";
  }

  // Extract company & location immediately (fixes issue #1)
  const company = extractCompany(card);
  const location = extractLocation(card);

  // store on dataset for quick access
  if (jobId) {
    card.dataset.jobfitCompany = company;
    card.dataset.jobfitLocation = location;
  }

  // Click handler: when user opens the listing, grab the (full) description and store it
  const clickHandler = async (ev) => {
    try {
      // allow default navigation / panel opening to proceed
      // generate a token so late-arriving responses don't overwrite newer ones
      const token = Symbol();
      if (jobId) pendingTokens[jobId] = token;

      // immediate UX update
      badge.textContent = " ⏳ loading";
      badge.style.backgroundColor = "#f57c00"; // orange for loading

      // wait for the description panel to settle
      const description = await waitForDescription({ title: titleText, timeout: 6000 });

      // ensure this result is still desired for this job (no newer token replaced it)
      if (jobId && pendingTokens[jobId] !== token) {
        // dropped because a newer click/request for same jobId exists
        return;
      }

      // save to cache
      jobCache[jobId || titleText] = {
        jobId,
        title: titleText,
        company,
        location,
        description
      };

      // Update badge to show we have a cached description (placeholder score for now)
      const placeholderScore = 7; // swap with real compute later
      badge.textContent = ` ${placeholderScore}/10`;
      badge.style.backgroundColor = "#2e7d32";

      console.log("Job scraped:", {
        jobId,
        title: titleText,
        company,
        location,
        descriptionSnippet: description?.slice(0, 200)
      });
    } catch (err) {
      console.error("JobFit error while fetching description:", err);
      badge.textContent = " !err";
      badge.style.backgroundColor = "#b00020";
    }
  };

  // Attach listener once
  if (!card.dataset.jobfitListener) {
    card.addEventListener("click", clickHandler, { capture: true }); // capture so we run early
    card.dataset.jobfitListener = "true";
  }

  card.dataset.jobfitProcessed = "true";
  // optional console log
  // console.log("Processed job:", titleText, company, location);
}

// Initial run & MutationObserver to handle dynamic loading
document.querySelectorAll("[data-jk]").forEach(processJobCard);

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;

      if (node.matches && node.matches("[data-jk]")) {
        processJobCard(node);
      }
      if (node.querySelectorAll) {
        node.querySelectorAll("[data-jk]").forEach(processJobCard);
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

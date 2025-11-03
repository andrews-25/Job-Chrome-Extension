console.log("JobFit content script loaded.");

// In-memory cache for clicked job descriptions
const jobCache = {};

// Helper to process a card
function processJobCard(card) {
  if (card.dataset.logged) return;

  const titleEl = card.querySelector("h2 span");
  if (!titleEl) return;

  // Add badge
  const badge = document.createElement("span");
  badge.textContent = " 7/10";
  badge.style.color = "white";
  badge.style.backgroundColor = "green";
  badge.style.borderRadius = "4px";
  badge.style.padding = "2px 4px";
  badge.style.marginLeft = "6px";
  badge.style.fontSize = "0.8em";
  badge.style.fontWeight = "bold";
  titleEl.appendChild(badge);

  // Grab company and location from tile
  const companyEl = card.querySelector(".css-1afmp4o.e37uo190, .company_location.css-i375s1.e37uo190");
  const locationEl = card.querySelector(".company_location.css-i375s1.e37uo190, .css-1restlb.eu4oa1w0");
  const company = companyEl?.innerText?.trim() || "";
  const location = locationEl?.innerText?.trim() || "";

  // Store data on the card dataset (optional)
  card.dataset.company = company;
  card.dataset.location = location;

  // Click listener to grab job description
  card.addEventListener("click", () => {
    const descEl = document.getElementById("jobDescriptionText");
    const description = descEl?.innerText?.trim() || "";

    if (description) {
      jobCache[card.dataset.jk] = {
        company,
        location,
        description
      };
      console.log("Job clicked:", {
        title: titleEl.innerText,
        company,
        location,
        description
      });
    }
  });

  card.dataset.logged = "true";
  console.log("Processed job:", titleEl.innerText);
}

// Process initial jobs
document.querySelectorAll("[data-jk]").forEach(processJobCard);

// Watch for dynamically added jobs
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;

      if (node.matches && node.matches("[data-jk]")) {
        processJobCard(node);
      }
      node.querySelectorAll && node.querySelectorAll("[data-jk]").forEach(processJobCard);
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });

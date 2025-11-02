console.log("JobFit content script loaded.");

// Helper to process a card
function processJobCard(card) {
  if (card.dataset.logged) return;

  const titleEl = card.querySelector("h2 span");
  if (!titleEl) return;

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

  card.dataset.logged = "true";
  console.log("Found job:", titleEl.innerText); // may log twice
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

console.log("JobFit content script loaded.");

// Process each job card once
document.querySelectorAll("[data-jk]").forEach(card => {
  // Skip if already processed
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

  card.dataset.logged = "true"; // mark as processed
  console.log("Found job:", titleEl.innerText);
});

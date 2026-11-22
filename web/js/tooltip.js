// One shared tooltip element (#tooltip in index.html) used by every chart.

const tooltip = document.getElementById("tooltip");

export function showTooltip(event, html) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const pad = 14;
  const { width, height } = tooltip.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  // flip to the other side of the cursor near the window edge
  if (x + width > window.innerWidth - 8) x = event.clientX - width - pad;
  if (y + height > window.innerHeight - 8) y = event.clientY - height - pad;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

export function hideTooltip() {
  tooltip.hidden = true;
}

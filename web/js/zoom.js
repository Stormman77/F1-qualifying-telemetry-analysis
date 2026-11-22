// Shared zoom behavior for the speed trace and PCA scatter.
//
// Plain mouse-wheel scrolling keeps scrolling the page; zooming needs
// Ctrl/Cmd + wheel (or the buttons). Drag pans, double-click resets.

// Which events d3.zoom should handle.
export function zoomFilter(event) {
  if (event.type === "wheel") return event.ctrlKey || event.metaKey;
  if (event.type === "dblclick") return false;  // double-click resets instead (see attachZoom)
  return !event.button;                         // left-button drag, touch
}

// Attach a zoom behavior to `target` and add the +/-/reset buttons and a hint
// above the chart in `container`.
export function attachZoom(container, target, zoom) {
  target.call(zoom).on("dblclick.zoom", null)
    .on("dblclick", () => target.transition().duration(300).call(zoom.transform, d3.zoomIdentity));

  const bar = container.insert("div", ":first-child").attr("class", "zoom-bar");
  bar.append("span").attr("class", "zoom-hint")
    .text("Ctrl + scroll to zoom · drag to pan · double-click to reset");
  const buttons = bar.append("div").attr("class", "zoom-buttons");
  const button = (label, title, onClick) => buttons.append("button")
    .attr("type", "button").attr("title", title).attr("aria-label", title)
    .text(label).on("click", onClick);
  button("+", "Zoom in", () => target.transition().duration(250).call(zoom.scaleBy, 1.6));
  button("−", "Zoom out", () => target.transition().duration(250).call(zoom.scaleBy, 1 / 1.6));
  button("Reset", "Reset zoom", () => target.transition().duration(300).call(zoom.transform, d3.zoomIdentity));
}

// Native settings dialogs retain modal focus/Escape behavior; game overlays retain their stacking.
export function isOverlayVisible(id) {
  const overlay = document.getElementById(id);
  return overlay.tagName === "DIALOG" ? overlay.open : overlay.style.display === "flex";
}

export function setOverlayVisible(id, visible) {
  const overlay = document.getElementById(id);
  if (overlay.tagName === "DIALOG") {
    if (visible && !overlay.open) overlay.showModal();
    else if (!visible && overlay.open) overlay.close();
  } else overlay.style.display = visible ? "flex" : "none";
}

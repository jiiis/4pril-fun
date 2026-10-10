// A small set of clean line icons (inline SVG, stroke follows the text colour). Used instead of emoji
// in the HUD, hero cards and build menus so everything looks consistent on every device.
const P = {
  coins:     '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.2"/><path d="M12 9.6v4.8M10.6 9.6h2.8M10.6 14.4h2.8"/>',
  heart:     '<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
  volume:    '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  volumeOff: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  waves:     '<path d="M3 8c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M3 15c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/>',
  map:       '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  sword:     '<path d="M4 20l10-10"/><path d="M14 10l6-6v4l-6 6"/><path d="M7 13l4 4"/><path d="M3 21l2-2"/>',
  bow:       '<path d="M5 3c6 2 10 7 12 14"/><path d="M5 3l12 14"/><path d="M12 10l6-6"/><path d="M15 4h3v3"/>',
  flame:     '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-3-1-5-3-7 0 4-4 6-4 12 0 5 3 8 7 8z"/>',
  leaf:      '<path d="M20 4C9 4 4 10 4 20c10 0 16-5 16-16z"/><path d="M4 20c4-5 8-8 12-10"/>',
  snowflake: '<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10"/><path d="M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2"/>',
  sparkles:  '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
  bomb:      '<circle cx="10" cy="14" r="7"/><path d="M15 9l3-3"/><path d="M18 6l2-2M20 7l1 1M21 3v2"/>',
  shield:    '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  shieldOff: '<path d="M12 3l8 3v6c0 2-.6 3.8-1.6 5.3"/><path d="M5.2 7.6C4.5 7.9 4 8 4 8v4c0 5 3.5 8 8 9 1.8-.4 3.4-1.1 4.7-2.1"/><path d="M3 3l18 18"/>',
  shieldCheck:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  zap:       '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  chevrons:  '<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  trash:     '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  brush:     '<path d="M14 3h6v6l-7 7-6-6z" fill="none"/><path d="M20 9l-7 7"/><path d="M9.5 12.5a3.5 3.5 0 0 0-5 3c0 2.2-1 3.8-2.5 5 2.4.3 4.8-.2 6.4-1.8a3.5 3.5 0 0 0 3.1-5.2"/><path d="M14 3l6 6"/>',
  eraser:    '<path d="M7 20h13"/><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8l-7 7H8.5l-4-4z"/><path d="M9.5 10.5l6 6"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  skull:     '<path d="M12 3a8 8 0 0 0-8 8c0 3 2 5 4 6v3h8v-3c2-1 4-3 4-6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.3"/><circle cx="15" cy="11" r="1.3"/><path d="M10 20v-2M14 20v-2"/>',
  tornado:   '<path d="M3 5h18M5 9h14M7 13h10M9 17h6M11 21h2"/>',
  burst:     '<path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.3 6.3l2.9 2.9M14.8 14.8l2.9 2.9M6.3 17.7l2.9-2.9M14.8 9.2l2.9-2.9"/>',
  axe:       '<path d="M14 10L4 20"/><path d="M11 7l6 6"/><path d="M13 5c3-2 6-2 8 0-2 2-2 5 0 8-3 1-6 0-8-2z"/>',
  radio:     '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  flag:      '<path d="M5 22V4"/><path d="M5 4h12l-3 4 3 4H5"/>',
  star:      '<path d="M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9L6.5 20l1-6.1L3 9.5l6.3-.9z"/>',
  dragon:    '<path d="M3 14c3-6 8-8 14-7l4 3-4 1c-1 3-4 6-9 6-2 0-3-1-5-3z"/><path d="M8 11l1 1"/><path d="M3 14l-1 4 4-1"/>',
  people:    '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5 2 5 5"/>',
  range:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  play:      '<path d="M7 4l13 8-13 8z"/>',
  pause:     '<path d="M7 4v16M17 4v16"/>',
  expand:    '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  restart:   '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  shrink:    '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  forward:   '<path d="M4 5l8 7-8 7z"/><path d="M13 5l8 7-8 7z"/>',
  swords:    '<path d="M3 3l8 8"/><path d="M11 11l-2 2"/><path d="M21 3l-8 8"/><path d="M13 11l2 2"/><path d="M6 14l4 4-3 3-4-4z"/><path d="M18 14l-4 4 3 3 4-4z"/>',
  hourglass: '<path d="M6 2h12M6 22h12"/><path d="M7 2c0 5 5 6 5 10s-5 5-5 10M17 2c0 5-5 6-5 10s5 5 5 10"/>',
  x:         '<path d="M6 6l12 12M18 6L6 18"/>',
};
export function icon(name, cls = "") {
  const d = P[name] || P.star;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
// Fill every element with a data-icon attribute
export function applyIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) el.innerHTML = icon(el.dataset.icon);
}

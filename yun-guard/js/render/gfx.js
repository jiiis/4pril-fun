// The main canvas plus tiny shape helpers used by all the drawing code.
// Every helper takes the context first so the same code can draw to the
// offscreen background canvas too.

export const canvas = globalThis.document?.getElementById("c") ?? null;
export let ctx = canvas?.getContext("2d") ?? null;
// Background drawing uses the same helpers in the page and in its worker.
export function createCanvas(w = 300, h = 150) {
  if (!globalThis.document) return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return c;
}
// Temporarily point every drawing helper at another context (used to draw a creature into a small
// scratch canvas so it can be tinted cheaply). Importers see the change because module bindings are live.
export function withCtx(c, fn) { const prev = ctx; ctx = c; try { fn(); } finally { ctx = prev; } }

export function rect(c, x, y, w, h, fill, stroke, lw = 2) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
}

export function circle(c, x, y, r, fill, stroke, lw = 1.5) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}

export function ellipse(c, x, y, rx, ry, fill, stroke, lw = 1.5) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}

export function poly(c, pts, fill, stroke, lw = 2) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = "round"; c.stroke(); }
}

export function line(c, x1, y1, x2, y2, color, lw = 2) {
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

// Shared shadow styling for units, scenery, buildings and flying companions.
// A firmer core grounds each object; the edges fade toward the lower right.
export const SHADOW_STYLE = {
  scale: 1.15,
  cast: [[0, "rgba(10,25,5,0.2)"], [0.65, "rgba(10,25,5,0.13)"], [1, "rgba(10,25,5,0)"]],
  contact: [[0, "rgba(5,15,0,0.42)"], [0.7, "rgba(5,15,0,0.27)"], [1, "rgba(5,15,0,0)"]],
  projected: [[0, "rgba(10,30,5,0.29)"], [0.5, "rgba(10,30,5,0.17)"], [1, "rgba(10,30,5,0)"]],
  airOpacity: 0.22,
};
// Cache unit radial gradients per canvas, then scale them into place.
const unitGrads = new WeakMap();
function unitGradient(c, key, stops) {
  let m = unitGrads.get(c); if (!m) { m = {}; unitGrads.set(c, m); }
  if (!m[key]) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); for (const [t, col] of stops) g.addColorStop(t, col); m[key] = g; }
  return m[key];
}
function softBlob(c, x, y, rx, ry, key, stops) {
  c.save(); c.translate(x, y); c.scale(rx, ry);
  c.fillStyle = unitGradient(c, key, stops);
  c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill();
  c.restore();
}
export function shadow(c, x, y, rx, ry = rx * 0.4, h = 0) {   // h: how tall the thing is, which stretches the cast shadow
  rx *= SHADOW_STYLE.scale; ry *= SHADOW_STYLE.scale; h *= SHADOW_STYLE.scale;
  softBlob(c, x + rx * 0.55 + h * 0.55, y + ry * 0.3 + h * 0.1, rx * 1.45 + h * 0.55, ry * 1.05 + h * 0.06, "cast", SHADOW_STYLE.cast);
  softBlob(c, x, y, rx * 0.95, ry * 1.05, "contact", SHADOW_STYLE.contact);
}

// A compact ground patch follows the torso, with a distinct lighter cast to the lower right.
export function bodyShadow(c, x, y, rx, ry) {
  rx *= SHADOW_STYLE.scale; ry *= SHADOW_STYLE.scale;
  softBlob(c, x + rx * 0.95, y + ry * 0.55, rx * 1.15, ry * 0.55, "cast", SHADOW_STYLE.cast);
  softBlob(c, x, y, rx * 1.2, ry * 0.8, "contact", SHADOW_STYLE.contact);
}

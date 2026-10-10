// The main canvas plus tiny shape helpers used by all the drawing code.
// Every helper takes the context first so the same code can draw to the
// offscreen background canvas too.

export const canvas = document.getElementById("c");
export let ctx = canvas.getContext("2d");
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

export function shadow(c, x, y, rx, ry = rx * 0.4) {
  ellipse(c, x, y, rx, ry, "rgba(0,0,0,0.25)");
}

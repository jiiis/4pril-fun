import { ctx, rect, circle, ellipse, poly, line, shadow } from "./gfx.js";
import { state } from "../state.js";
import { xpToNext } from "../hero.js";

const ACCENT = { april: "#90caf9", avril: "#f48fb1", ember: "#ffab91", willow: "#aed581", meilin: "#b2ebf2" };
const RING = { april: "rgba(144,202,249,0.25)", avril: "rgba(244,143,177,0.25)", ember: "rgba(255,171,145,0.25)", willow: "rgba(174,213,129,0.25)", meilin: "rgba(178,235,242,0.28)" };
const BAR = { april: "#42a5f5", avril: "#f06292", ember: "#ff7043", willow: "#8bc34a", meilin: "#4dd0e1" };

// Draws whichever hero is in play. Shared: selection ring, movement animation, bars and badges.
export function drawHero(h) {
  if (h.hp <= 0) {
    ctx.globalAlpha = 0.6;
    circle(ctx, h.spawn.x, h.spawn.y, 12, null, "#90caf9", 2);
    ctx.fillStyle = "#e3f2fd"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${Math.ceil(h.respawn)}s`, h.spawn.x, h.spawn.y);
    ctx.globalAlpha = 1;
    return;
  }

  const accent = ACCENT[h.kind] || "#90caf9";
  if (h.selected) {
    circle(ctx, h.x, h.y + 10, 16, RING[h.kind] || RING.april, accent, 2);
    if (h.moveTo) {
      const pulse = 4 + Math.sin((state.time * 1000) / 150) * 2;
      circle(ctx, h.moveTo.x, h.moveTo.y, pulse, null, accent, 1.5);
      line(ctx, h.moveTo.x - 7, h.moveTo.y, h.moveTo.x + 7, h.moveTo.y, accent, 1);
      line(ctx, h.moveTo.x, h.moveTo.y - 7, h.moveTo.x, h.moveTo.y + 7, accent, 1);
    }
  }
  if (h.def.healRange) {                                                      // Avril's healing aura
    ctx.globalAlpha = 0.06 + Math.sin(state.time * 2) * 0.02;
    circle(ctx, h.x, h.y + 6, h.def.healRange, "#f8bbd0");
    ctx.globalAlpha = 1;
  }
  if (h.def.root) {                                                           // Willow's vine reach, brightest right after a cast
    ctx.globalAlpha = 0.05 + (h.cast > 0 ? h.cast * 0.25 : 0);
    circle(ctx, h.x, h.y + 6, h.def.root.range, "#aed581");
    ctx.globalAlpha = 1;
  }

  const run = Math.min(1, h.speedNow / h.def.speed);
  const anim = {
    run,
    sw: Math.sin(h.phase) * 3.5 * run,
    bob: Math.abs(Math.sin(h.phase)) * 1.8 * run,
    lean: run * 0.14,
    breathe: (1 - run) * Math.sin(state.time * 2.2) * 0.4,
    lunge: h.swing > 0 ? Math.sin((h.swing / 0.25) * Math.PI) * 3 : 0,
  };
  if (run > 0.3) {
    const k = (h.phase / Math.PI) % 1;
    ctx.globalAlpha = 0.2 * (1 - k) * run;
    circle(ctx, h.x - h.face * (6 + k * 10), h.y + 12, 2 + k * 4, "#d7ccc8");
    ctx.globalAlpha = 1;
  }
  shadow(ctx, h.x, h.y + 12, 9 - anim.bob * 0.3, 3.5);

  ctx.save();
  ctx.translate(h.x + h.face * anim.lunge, h.y - anim.bob);
  ctx.scale(Math.sign(h.face || 1) * Math.max(0.2, Math.abs(h.face)), 1);
  ctx.rotate(anim.lean);
  ({ april: drawApril, avril: drawAvril, ember: drawEmber, willow: drawWillow, meilin: drawMeiLin }[h.kind] || drawApril)(h, anim);
  ctx.restore();

  if (h.levelFlash > 0) {
    ctx.globalAlpha = h.levelFlash / 1.2 * 0.6;
    circle(ctx, h.x, h.y - 5, 22 + (1.2 - h.levelFlash) * 20, null, "#80deea", 3);
    ctx.globalAlpha = 1;
  }
  const w = 30, x = h.x - w / 2, y = h.y - 30;
  rect(ctx, x, y, w, 4, "#222");
  rect(ctx, x, y, w * (h.hp / h.maxHp), 4, BAR[h.kind] || "#42a5f5");
  rect(ctx, x, y + 5, w, 2, "#222");
  rect(ctx, x, y + 5, w * Math.min(1, h.xp / xpToNext(h)), 2, "#80deea");
  circle(ctx, x - 6, y + 3, 6, "#263238", "#80deea", 1.2);
  ctx.fillStyle = "#e0f7fa"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(h.level, x - 6, y + 3.5);
  if (h.selected) {
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(`${h.def.name}  Lv ${h.level}`, h.x, y - 2);
  }
}

// Aim angle toward h.aim in the hero's local (flipped) space, clamped so arms stay sensible
function aimAngle(h) {
  const dx = (h.aim.x - h.x) * Math.sign(h.face || 1), dy = h.aim.y - h.y;
  return Math.max(-0.7, Math.min(0.7, Math.atan2(dy, Math.abs(dx))));
}

// ---------- Lady April: knight in silver armour with sword and shield ----------
function drawApril(h, a) {
  const { run, sw, breathe } = a;
  const flow = 1 + run * 6 + Math.sin(h.phase * 0.5) * run * 1.5;
  poly(ctx, [[-3, -14], [3, -14], [-2 - flow, 6 + run * 2], [-9 - flow, 4 + run * 3]], "#1e88e5", "#0d47a1", 1);
  line(ctx, -3, 4, -3 + sw, 11, "#78909c", 3.5);
  line(ctx, 3, 4, 3 - sw, 11, "#78909c", 3.5);
  rect(ctx, -5 + sw, 10, 5, 3, "#37474f");
  rect(ctx, 1 - sw, 10, 5, 3, "#37474f");
  poly(ctx, [[-6, -12 - breathe], [6, -12 - breathe], [5, 5], [-5, 5]], "#cfd8dc", "#546e7a", 1);
  rect(ctx, -3, -11 - breathe, 6, 15 + breathe, "#1e88e5");
  circle(ctx, 0, -6, 1.8, "#ffd54f");
  rect(ctx, -6, 1, 12, 2.5, "#4e342e");
  circle(ctx, 0, 2.2, 1.2, "#ffd54f");
  ellipse(ctx, -6, -11 - breathe, 4, 2.5, "#b0bec5", "#546e7a", 1);
  ellipse(ctx, 6, -11 - breathe, 4, 2.5, "#b0bec5", "#546e7a", 1);
  const braidSwing = Math.sin(h.phase - 0.8) * 2.5 * run;
  ellipse(ctx, -6 - run * 2, -14 + braidSwing, 2.5, 6, "#f9a825");
  circle(ctx, -7 - run * 3, -9 + braidSwing * 1.4, 1.6, "#f57f17");
  circle(ctx, 0, -18 - breathe, 5, "#ffcc80");
  ctx.fillStyle = "#f9a825"; ctx.beginPath(); ctx.arc(0, -18.5 - breathe, 5.2, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  line(ctx, -5, -19.5 - breathe, 5, -19.5 - breathe, "#eceff1", 1.5);
  circle(ctx, 0, -20.5 - breathe, 1, "#42a5f5");
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, -15.5 - breathe, 4.2, 2.2, "#000"); ctx.globalAlpha = 1;   // soft shade under the chin
  const armSwing = -sw * 0.8;
  line(ctx, -5, -9, -9 + armSwing, -3, "#cfd8dc", 3);
  poly(ctx, [[-13 + armSwing, -8], [-5 + armSwing, -8], [-5 + armSwing, -1], [-9 + armSwing, 3], [-13 + armSwing, -1]], "#1565c0", "#ffd54f", 1.5);
  line(ctx, -9 + armSwing, -7, -9 + armSwing, 1, "#ffd54f", 1); line(ctx, -12 + armSwing, -4, -6 + armSwing, -4, "#ffd54f", 1);
  if (h.swing > 0) {
    line(ctx, 5, -9, 11, -14, "#cfd8dc", 3);
    line(ctx, 11, -14, 26, -24, "#eceff1", 2.8);
    line(ctx, 9, -16, 13, -11, "#ffd54f", 2);
  } else {
    line(ctx, 5, -9, 9 - armSwing, -2, "#cfd8dc", 3);
    line(ctx, 9 - armSwing, -2, 14 - armSwing, 13, "#eceff1", 2.8);
    line(ctx, 6 - armSwing, -1, 12 - armSwing, -3, "#ffd54f", 2);
  }
}

// ---------- Princess Avril: archer princess in a rose gown with a longbow ----------
function drawAvril(h, a) {
  const { run, sw, breathe } = a;
  const hem = Math.sin(h.phase) * 2 * run;
  const T = state.time;
  if (!h.aim) {
    ctx.save();
    ctx.translate(-4, -7);
    ctx.rotate(-0.3);
    const r = 17, span = 1.1, cxB = -11;
    ctx.strokeStyle = "#4e342e"; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(cxB, 0, r, -span, span); ctx.stroke();
    ctx.strokeStyle = "#d7a86e"; ctx.lineWidth = 1.9;
    ctx.beginPath(); ctx.arc(cxB, 0, r, -span, span); ctx.stroke();
    const bx = cxB + r * Math.cos(span), by = r * Math.sin(span);
    circle(ctx, bx, -by, 1.3, "#fff"); circle(ctx, bx, by, 1.3, "#fff");
    line(ctx, bx, -by, bx, by, "#fce4ec", 0.9);
    line(ctx, cxB + r, -3, cxB + r, 3, "#f06292", 2.4);
    ctx.restore();
  }
  ellipse(ctx, -3 + sw, 11, 3, 1.5, "#ad1457");
  ellipse(ctx, 3 - sw, 11, 3, 1.5, "#ad1457");
  poly(ctx, [[-3, -2], [3, -2], [8 + hem, 12], [-8 - hem, 12]], "#fce4ec", "#f48fb1", 0.8);
  for (const px of [-5, 0, 5]) line(ctx, px * 0.6, -1, px * 1.5 + hem * (px / 5), 11.5, "#f8bbd0", 0.8);
  const sheen = ctx.createLinearGradient(-9, 0, 9, 0);
  sheen.addColorStop(0, "#ec407a"); sheen.addColorStop(0.45, "#f8bbd0"); sheen.addColorStop(1, "#ec407a");
  poly(ctx, [[-4, -10 - breathe], [4, -10 - breathe], [7 + hem, 10], [2 + hem * 0.5, 7], [-2 - hem * 0.5, 7], [-7 - hem, 10]], sheen, "#ad1457", 1);
  line(ctx, -6.5 - hem, 9, -2 - hem * 0.5, 6.5, "#ffd54f", 1.2); line(ctx, 6.5 + hem, 9, 2 + hem * 0.5, 6.5, "#ffd54f", 1.2);
  for (const [ex, ey] of [[-3, 1], [2.5, 3], [-1, 5]]) circle(ctx, ex, ey, 0.9, "#ffd54f");
  poly(ctx, [[-4, -11 - breathe], [4, -11 - breathe], [3.5, -2], [-3.5, -2]], "#f48fb1", "#ad1457", 1);
  ctx.fillStyle = "#ffe0b2"; ctx.beginPath(); ctx.arc(-1.8, -11 - breathe, 1.9, Math.PI, 0); ctx.arc(1.8, -11 - breathe, 1.9, Math.PI, 0); ctx.fill();
  line(ctx, -3.5, -2, 3.5, -2, "#ffd54f", 1.5);
  line(ctx, 0, -9 - breathe, 0, -3, "#ffd54f", 0.8);
  circle(ctx, 0, -2.5, 1.8, "#e91e63", "#ad1457", 0.6); circle(ctx, 0, -2.5, 0.8, "#f8bbd0");
  ellipse(ctx, -5, -11 - breathe, 3, 2.2, "#f8bbd0", "#ad1457", 0.8);
  ellipse(ctx, 5, -11 - breathe, 3, 2.2, "#f8bbd0", "#ad1457", 0.8);
  for (let i = -2; i <= 2; i++) circle(ctx, i * 1.3, -10.5 - breathe + Math.abs(i) * 0.3 + 1.2, 0.6, "#ffffff");
  rect(ctx, -8, -16, 3.5, 10, "#6d4c41", "#3e2723", 0.8);
  for (const qx of [-7.5, -6]) line(ctx, qx, -16, qx, -20, "#e0f7fa", 1);
  circle(ctx, -7.5, -20.5, 1, "#80deea"); circle(ctx, -6, -20.5, 1, "#80deea");
  const hairSwing = Math.sin(h.phase - 0.6) * 2 * run + Math.sin(T * 1.5) * 0.4;
  poly(ctx, [[-4, -22], [-7 - run * 3, -14 + hairSwing], [-9 - run * 4, -4 + hairSwing], [-7 - run * 3, 2 + hairSwing * 1.3], [-4, -2], [-3, -8]], "#4e342e", "#2b1b14", 0.8);
  line(ctx, -5.5, -18, -7.5 - run * 3, -6 + hairSwing, "#8d6e63", 1.2);
  for (const wy of [-4, 0]) circle(ctx, -7.5 - run * 3.5, wy + hairSwing, 1.6, "#4e342e");
  poly(ctx, [[-5, -9], [-7, -11], [-8.5, -8.5], [-6.5, -7]], "#80deea", "#00acc1", 0.6);
  const fy = -18 - breathe;
  circle(ctx, 0, fy, 5, "#ffe0b2");
  ctx.fillStyle = "#4e342e"; ctx.beginPath(); ctx.arc(0, fy - 0.5, 5.2, Math.PI * 1.03, Math.PI * 1.97); ctx.fill();
  line(ctx, -4.8, fy - 1.5, -1.5, fy - 4.2, "#6d4c41", 1);
  poly(ctx, [[-4.5, fy - 3], [-2.5, fy - 6], [0, fy - 4.5], [2.5, fy - 7.5], [4.5, fy - 3]], "#ffd54f", "#f9a825", 0.8);
  circle(ctx, 2.5, fy - 6.5, 1.2, "#f06292", "#ad1457", 0.4);
  circle(ctx, -2.5, fy - 5.2, 0.6, "#ffffff"); circle(ctx, 0, fy - 3.8, 0.6, "#ffffff");
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 2.5, 4.2, 2.2, "#000"); ctx.globalAlpha = 1;          // soft shade under the chin
  const sp = (T * 0.7) % 1;
  if (sp < 0.5) { ctx.globalAlpha = Math.sin(sp * Math.PI * 2) * 0.8; const sx = -6 + Math.sin(T * 3) * 6, sy = -6 - sp * 16; line(ctx, sx - 2, sy, sx + 2, sy, "#fff", 1); line(ctx, sx, sy - 2, sx, sy + 2, "#fff", 1); ctx.globalAlpha = 1; }
  const armSwing = -sw * 0.8;
  if (h.aim && h.hp > 0) {
    ctx.save();
    ctx.translate(2, -10);
    ctx.rotate(aimAngle(h));
    const drawn = h.shoot > 0.2 || h.bowCd < 0.25;
    line(ctx, 0, 0, 9, 0, "#ffe0b2", 2.5);
    ctx.strokeStyle = "#d7a86e"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(9, 0, 9, -1.25, 1.25); ctx.stroke();
    const ex = 9 + 9 * Math.cos(1.25), ey = 9 * Math.sin(1.25);
    ctx.strokeStyle = "#fce4ec"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(ex, -ey);
    if (drawn) ctx.lineTo(1, 0); ctx.lineTo(ex, ey); ctx.stroke();
    if (drawn) {
      line(ctx, 1, 0, 19, 0, "#cfd8dc", 1.3);
      circle(ctx, 20, 0, 3, "rgba(128,222,234,0.7)"); circle(ctx, 20, 0, 1.4, "#e0f7fa");
      line(ctx, -2, -1, 0, 0, "#ffe0b2", 2.2);
    }
    ctx.restore();
  } else if (h.swing > 0) {
    line(ctx, 4, -9, 10, -12, "#ffe0b2", 2.5);
    line(ctx, 10, -12, 18, -15, "#eceff1", 2);
  } else {
    line(ctx, 4, -9, 7 - armSwing, -2, "#ffe0b2", 2.5);
    line(ctx, -4, -9, -7 + armSwing, -2, "#ffe0b2", 2.5);
  }
}

// ---------- Ember: young fire mage in a crimson robe with a flame-tipped staff ----------
function drawEmber(h, a) {
  const { run, sw, breathe } = a;
  const T = state.time, hem = Math.sin(h.phase) * 2 * run;
  const casting = h.shoot > 0, aiming = !!h.aim;
  // Boots
  ellipse(ctx, -3 + sw, 11, 3, 1.6, "#4e342e");
  ellipse(ctx, 3 - sw, 11, 3, 1.6, "#4e342e");
  // Robe: crimson with an orange hem that seems to glow, gold trim and sash
  const robe = ctx.createLinearGradient(0, -12, 0, 12);
  robe.addColorStop(0, "#b71c1c"); robe.addColorStop(0.7, "#d84315"); robe.addColorStop(1, "#ff8f00");
  poly(ctx, [[-4, -11 - breathe], [4, -11 - breathe], [8 + hem, 12], [-8 - hem, 12]], robe, "#7f0000", 1);
  for (const [fx, fy] of [[-5, 9], [0, 11], [5, 9]]) poly(ctx, [[fx - 2, 12], [fx, fy - 3 + Math.sin(T * 9 + fx) * 1.2], [fx + 2, 12]], "#ffb300");   // flame pattern on the hem
  rect(ctx, -4.5, -2, 9, 2.2, "#ffd54f");
  circle(ctx, 0, -1, 1.3, "#ff6f00");
  line(ctx, 0, -10 - breathe, 0, -3, "#ffd54f", 0.8);
  ellipse(ctx, -5, -11 - breathe, 3, 2.2, "#c62828", "#7f0000", 0.8);   // puffed sleeves
  ellipse(ctx, 5, -11 - breathe, 3, 2.2, "#c62828", "#7f0000", 0.8);
  // Auburn hair, loose and a little wild, with a side plait
  const hs = Math.sin(h.phase - 0.5) * 2 * run + Math.sin(T * 2) * 0.5;
  poly(ctx, [[-4, -22], [-8 - run * 3, -14 + hs], [-9 - run * 3, -3 + hs], [-5, -4], [-3, -9]], "#bf360c", "#7a2a08", 0.8);
  line(ctx, -5, -17, -7.5 - run * 3, -6 + hs, "#ff7043", 1.2);
  const fy = -18 - breathe;
  circle(ctx, 0, fy, 5, "#ffe0b2");
  ctx.fillStyle = "#bf360c"; ctx.beginPath(); ctx.arc(0, fy - 0.5, 5.2, Math.PI * 1.03, Math.PI * 1.97); ctx.fill();
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 2.5, 4.2, 2.2, "#000"); ctx.globalAlpha = 1;          // soft shade under the chin
  // Wide-brimmed pointed hat, tilted, with a flame badge and a glowing band
  ctx.save(); ctx.translate(0, fy - 3.5); ctx.rotate(-0.12);
  ellipse(ctx, 0, 0, 9, 2.6, "#7f0000", "#4a0000", 0.8);
  poly(ctx, [[-5.5, -0.5], [5.5, -0.5], [2.5 + Math.sin(T * 1.6) * 0.8, -15]], "#b71c1c", "#4a0000", 1);
  rect(ctx, -5, -3.2, 10, 2.2, "#ff8f00");
  poly(ctx, [[0.6, -2.4], [-0.8, -5.5], [2.2, -4.2], [1.6, -6.8], [3.4, -3.4]], "#ffeb3b");                             // flame badge
  ctx.restore();
  // Staff: dark wood with a flame at the tip, raised toward the target when casting
  const armSwing = -sw * 0.8;
  const raise = aiming ? aimAngle(h) - 0.9 : (casting ? -0.6 : 0.1);
  ctx.save();
  ctx.translate(3, -9);
  ctx.rotate(raise);
  line(ctx, 0, 0, 8, 0, "#ffe0b2", 2.5);                                 // arm
  line(ctx, 8, 10, 8, -20, "#4e342e", 2.5);                              // staff
  line(ctx, 8, -14, 10.5, -20, "#6d4c41", 1.5); line(ctx, 8, -14, 5.5, -20, "#6d4c41", 1.5);   // forked tip
  const fl = 4 + Math.sin(T * 14) * 1 + (casting ? 3 : 0);
  const glow = ctx.createRadialGradient(8, -22, 1, 8, -22, fl * 2.2);
  glow.addColorStop(0, "rgba(255,255,255,0.95)"); glow.addColorStop(0.35, "rgba(255,193,7,0.9)"); glow.addColorStop(1, "rgba(255,87,34,0)");
  circle(ctx, 8, -22, fl * 2.2, glow);
  poly(ctx, [[8 - fl * 0.6, -20], [8 + fl * 0.6, -20], [8 + Math.sin(T * 11) * 1.5, -20 - fl * 1.8]], "#ff9800");
  poly(ctx, [[8 - fl * 0.3, -20], [8 + fl * 0.3, -20], [8 + Math.sin(T * 11) * 1, -20 - fl * 1.1]], "#ffeb3b");
  ctx.restore();
  line(ctx, -4, -9, -7 + armSwing, -2, "#ffe0b2", 2.5);                   // other arm
  // Embers drifting up from her hem
  for (let i = 0; i < 3; i++) { const k = (T * 0.8 + i / 3) % 1; ctx.globalAlpha = (1 - k) * 0.8; circle(ctx, -6 + i * 6 + Math.sin(T * 3 + i) * 2, 10 - k * 22, 1, i % 2 ? "#ffb300" : "#ff5722"); }
  ctx.globalAlpha = 1;
}

// ---------- Willow: forest druid in a green hooded cloak with a living staff ----------
function drawWillow(h, a) {
  const { run, sw, breathe } = a;
  const T = state.time, hem = Math.sin(h.phase) * 2 * run;
  const casting = h.cast > 0;
  // Bare feet with leaf anklets
  ellipse(ctx, -3 + sw, 11, 2.8, 1.5, "#d7905a");
  ellipse(ctx, 3 - sw, 11, 2.8, 1.5, "#d7905a");
  // Earthy tunic and a long moss-green cloak that sways
  const flow = 1 + run * 5 + Math.sin(h.phase * 0.5) * run;
  poly(ctx, [[-4, -14], [4, -14], [6 + flow * 0.4, 11], [-3 - flow, 9 + run * 2], [-8 - flow, 6 + run * 3]], "#33691e", "#1b5e20", 1);
  poly(ctx, [[-4, -10 - breathe], [4, -10 - breathe], [6 + hem * 0.5, 10], [-6 - hem * 0.5, 10]], "#8d6e63", "#5d4037", 1);
  rect(ctx, -5, 0, 10, 2, "#4e342e"); circle(ctx, 0, 1, 1.3, "#aed581");                                              // woven belt with a leaf clasp
  for (const [lx, ly] of [[-3, 5], [2, 7]]) poly(ctx, [[lx, ly], [lx + 2.5, ly - 2], [lx + 1, ly + 2]], "#7cb342");    // leaves stitched on
  // Hood (down) draped on her shoulders, long brown braid over one shoulder
  ellipse(ctx, 0, -12 - breathe, 7.5, 3.5, "#2e7d32", "#1b5e20", 0.8);
  const bs = Math.sin(h.phase - 0.8) * 2 * run;
  line(ctx, 3, -14 - breathe, 6 + bs * 0.5, -2 + bs, "#5d4037", 3.2);
  for (const by of [-11, -8, -5, -2]) circle(ctx, 4.5 + (by + 8) * 0.12 + bs * ((by + 14) / 12) * 0.5, by - breathe * 0.5, 1.9, "#6d4c41");
  circle(ctx, 6 + bs * 0.5, -1 + bs, 1.4, "#7cb342");                                                                 // leaf tie
  // Face with a leaf circlet and a tiny flower
  const fy = -18 - breathe;
  circle(ctx, 0, fy, 5, "#ffe0b2");
  ctx.fillStyle = "#5d4037"; ctx.beginPath(); ctx.arc(0, fy - 0.5, 5.2, Math.PI * 1.03, Math.PI * 1.97); ctx.fill();
  for (const lx of [-4, -1.5, 1, 3.5]) poly(ctx, [[lx, fy - 4], [lx + 1.6, fy - 6.5], [lx + 2.6, fy - 4]], "#7cb342", "#33691e", 0.5);   // circlet leaves
  circle(ctx, -3.5, fy - 3.5, 1.1, "#f48fb1"); circle(ctx, -3.5, fy - 3.5, 0.5, "#ffeb3b");                           // flower
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 2.5, 4.2, 2.2, "#000"); ctx.globalAlpha = 1;          // soft shade under the chin
  // Gnarled staff with a glowing leaf; slammed down when she casts, swung when she fights
  const armSwing = -sw * 0.8;
  const tilt = casting ? 0.35 - h.cast * 0.5 : h.swing > 0 ? -0.9 : 0.05;
  ctx.save();
  ctx.translate(4, -8);
  ctx.rotate(tilt);
  line(ctx, 0, 0, 7, -1, "#ffe0b2", 2.5);
  line(ctx, 7, 14, 7, -22, "#5d4037", 3);
  line(ctx, 7, -16, 10, -22, "#5d4037", 2); line(ctx, 7, -10, 4.5, -14, "#5d4037", 1.8);                              // knots and twigs
  for (const [lx, ly] of [[10.5, -23], [3.8, -15]]) poly(ctx, [[lx, ly], [lx + 2.5, ly - 3], [lx + 3.5, ly + 0.5]], "#7cb342");
  const g = 3 + Math.sin(T * 3) * 0.8 + (casting ? 4 : 0);
  const glow = ctx.createRadialGradient(7, -24, 1, 7, -24, g * 2.5);
  glow.addColorStop(0, "rgba(220,255,180,0.95)"); glow.addColorStop(0.4, "rgba(139,195,74,0.8)"); glow.addColorStop(1, "rgba(139,195,74,0)");
  circle(ctx, 7, -24, g * 2.5, glow);
  poly(ctx, [[7, -21], [10, -26], [7, -30], [4, -26]], "#aed581", "#558b2f", 0.8);                                     // the living leaf
  ctx.restore();
  line(ctx, -4, -9, -7 + armSwing, -2, "#ffe0b2", 2.5);
  // Fireflies drifting around her
  for (let i = 0; i < 3; i++) { const k = (T * 0.5 + i / 3) % 1; ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; circle(ctx, -8 + Math.sin(T * 1.7 + i * 2) * 10, -4 - k * 16, 1, "#ccff90"); }
  ctx.globalAlpha = 1;
}

// ---------- 寒 Hán: a cool, elegant warrior in frost-white hanfu with a silver spear ----------
function drawMeiLin(h, a) {
  const { run, sw, breathe } = a;
  const T = state.time, hem = Math.sin(h.phase) * 2 * run;
  const thrust = h.swing > 0 ? Math.sin((h.swing / 0.25) * Math.PI) : 0;
  const wind = Math.sin(T * 1.6) * 1.5 + run * 6;                      // ribbons and hair stream in the wind, more when she runs
  // Flowing silk ribbons (飘带) trailing from her shoulders, drawn behind everything
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = "#cfd8dc"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-3, -12); ctx.bezierCurveTo(-10 - wind, -14 + Math.sin(T * 2.2) * 3, -14 - wind * 1.5, -2 + Math.sin(T * 1.7) * 4, -22 - wind * 2, 2 + Math.sin(T * 2.6) * 5); ctx.stroke();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-3, -11); ctx.bezierCurveTo(-9 - wind, -8 + Math.sin(T * 2.4) * 3, -13 - wind * 1.4, 4 + Math.sin(T * 1.9) * 4, -20 - wind * 2, 10 + Math.sin(T * 2.1) * 4); ctx.stroke();
  ctx.globalAlpha = 1;
  // Silver boots
  ellipse(ctx, -3 + sw, 11, 3, 1.6, "#546e7a"); ellipse(ctx, 3 - sw, 11, 3, 1.6, "#546e7a");
  line(ctx, -5 + sw, 10, -1 + sw, 10, "#eceff1", 1); line(ctx, 1 - sw, 10, 5 - sw, 10, "#eceff1", 1);
  // Hanfu in silver silk: a long shimmering skirt, a brighter satin outer layer, frost-blue trim and snowflake embroidery
  const silver = ctx.createLinearGradient(-9, 0, 9, 0);
  silver.addColorStop(0, "#90a4ae"); silver.addColorStop(0.35, "#cfd8dc"); silver.addColorStop(0.55, "#f5f7f8"); silver.addColorStop(0.8, "#b0bec5"); silver.addColorStop(1, "#78909c");
  poly(ctx, [[-4, -3], [4, -3], [8 + hem, 12], [-8 - hem, 12]], silver, "#607d8b", 0.9);
  const satin = ctx.createLinearGradient(-7, -3, 7, 11);
  satin.addColorStop(0, "#eceff1"); satin.addColorStop(0.5, "#ffffff"); satin.addColorStop(1, "#b0bec5");
  poly(ctx, [[-4, -3], [4, -3], [6.5 + hem * 0.8, 10.5], [1.5 + hem * 0.3, 7], [-1.5 - hem * 0.3, 7], [-6.5 - hem * 0.8, 10.5]], satin, "#90a4ae", 0.7);
  line(ctx, -7.5 - hem, 11.2, 7.5 + hem, 11.2, "#ffffff", 1.2);                                                        // bright silver hem
  for (const [ex, ey] of [[-3, 3], [2.5, 5], [-0.5, 8]]) { line(ctx, ex - 1.5, ey, ex + 1.5, ey, "#ffffff", 0.8); line(ctx, ex, ey - 1.5, ex, ey + 1.5, "#ffffff", 0.8); }   // white snowflake embroidery
  poly(ctx, [[-4.5, -12 - breathe], [4.5, -12 - breathe], [4, -3], [-4, -3]], silver, "#607d8b", 0.9);              // bodice
  poly(ctx, [[-1.5, -12 - breathe], [3.2, -12 - breathe], [0.6, -4]], "#ffffff");                                     // crossed collar
  line(ctx, -1.5, -12 - breathe, 0.6, -4, "#90a4ae", 0.9); line(ctx, 3.2, -12 - breathe, 0.6, -4, "#90a4ae", 0.9);
  rect(ctx, -4.5, -4.2, 9, 2.6, "#78909c"); line(ctx, -4.5, -2.9, 4.5, -2.9, "#eceff1", 0.6);                        // silver sash
  circle(ctx, 0, -2.9, 1.6, "#ffffff", "#78909c", 0.7); circle(ctx, -0.4, -3.3, 0.5, "#ffffff");                      // polished silver clasp
  line(ctx, 1.5, -1.5, 1.5, 3.5, "#cfd8dc", 1); poly(ctx, [[1.5, 3.5], [3, 5.5], [1.5, 7.5], [0, 5.5]], "#eceff1", "#78909c", 0.5);   // dangling silver pendant
  ellipse(ctx, -6, -9 - breathe, 3.5, 3, silver, "#607d8b", 0.8);                                                     // wide sleeves
  ellipse(ctx, 6, -9 - breathe, 3.5, 3, silver, "#607d8b", 0.8);
  line(ctx, -8.5, -8 - breathe, -4, -7 - breathe, "#ffffff", 1); line(ctx, 4, -7 - breathe, 8.5, -8 - breathe, "#ffffff", 1);   // bright sleeve edges
  // Hair: long, jet black and glossy, swept into a high ponytail that streams behind her
  const hs = Math.sin(h.phase - 0.5) * 2 * run + Math.sin(T * 1.8) * 0.6;
  poly(ctx, [[-2, -25], [-8 - wind * 0.6, -21 + hs], [-14 - wind, -13 + hs * 1.5], [-18 - wind * 1.3, -2 + hs * 2], [-13 - wind * 0.8, -4 + hs], [-7 - wind * 0.4, -10 + hs], [-3, -14]], "#1b1b1b", "#000", 0.8);
  line(ctx, -5, -22, -12 - wind, -11 + hs * 1.4, "#607d8b", 1.1);                                                    // glossy highlight
  line(ctx, -7, -20, -15 - wind, -6 + hs * 1.6, "#455a64", 0.6);
  const fy = -18 - breathe;
  // Thin side locks (鬓发) framing the face, swaying gently
  const lk = Math.sin(T * 2.2) * 0.5;
  poly(ctx, [[-4.6, fy - 1], [-5.2 + lk, fy + 5], [-4.2 + lk, fy + 5.5], [-3.9, fy + 0.5]], "#1b1b1b");
  poly(ctx, [[4.6, fy - 0.5], [5 - lk, fy + 4.5], [4.1 - lk, fy + 5], [3.9, fy + 0.5]], "#1b1b1b");
  // Back of the head is covered in hair: a dark mass behind and slightly left of the face, running down into the ponytail
  ellipse(ctx, -1.3, fy - 0.2, 5.1, 6.1, "#1b1b1b");
  poly(ctx, [[-6.2, fy - 1], [-6, fy + 4], [-4.2, fy + 5.5], [-3.9, fy + 1]], "#1b1b1b");
  // Face: fair porcelain skin, simple and clean like the other heroes
  ellipse(ctx, 0, fy + 0.2, 4.6, 5.6, "#ffeadb");                                                                     // oval face
  ctx.fillStyle = "#1b1b1b"; ctx.beginPath(); ctx.ellipse(0, fy - 0.4, 4.8, 5.8, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.fill(); // hairline
  line(ctx, -4.6, fy - 1.6, -1.2, fy - 4.3, "#546e7a", 1);                                                            // a glossy sweep in the fringe
  ellipse(ctx, -1, fy - 6.8, 3.2, 2.3, "#1b1b1b");                                                                     // high ponytail knot
  circle(ctx, -1.6, fy - 7.3, 0.8, "#455a64");
  rect(ctx, -2.5, fy - 5.6, 3, 1.1, "#eceff1");                                                                         // silver hair tie
  // Small silver hairpin with two dangling blue beads
  line(ctx, -3, fy - 7.4, 3.8, fy - 9.2, "#f5f7f8", 1.1);
  circle(ctx, 3.9, fy - 9.3, 0.9, "#b2ebf2", "#4dd0e1", 0.5);
  for (let i = 0; i < 2; i++) { const bx = 2.2 + i * 1.2, by = fy - 7.6 + i * 1.8 + Math.sin(T * 4 + i) * 0.4; line(ctx, 1.8 + i * 1.2, fy - 8.2, bx, by, "#eceff1", 0.5); circle(ctx, bx, by, 0.6, "#80deea"); }
  // A clean, featureless face like the other legends; only the tiny blue huadian (花钿) ornament on the brow
  circle(ctx, 0.6, fy - 1.9, 0.55, "#4dd0e1");
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 3, 3.8, 2.2, "#000"); ctx.globalAlpha = 1;             // soft shade under the chin
  // Jian (剑): a slender straight double-edged Chinese sword with a silver blade, a dark wrapped grip,
  // a flared guard and an ice-blue tassel at the pommel. Held upright; thrusts forward on a strike.
  const armSwing = -sw * 0.8;
  ctx.save();
  ctx.translate(4, -7);
  ctx.rotate(thrust > 0 ? -1.35 : 0.3);
  ctx.translate(thrust * 11, 0);
  line(ctx, 0, 0, 6, -2, "#ffeadb", 2.5);                                 // arm
  circle(ctx, 6, -2, 1.3, "#ffeadb");                                     // hand
  line(ctx, 6, 1.5, 6, -6, "#263238", 2.4);                               // wrapped grip
  for (let i = 0; i < 4; i++) line(ctx, 5, 0.5 - i * 1.8, 7, -0.5 - i * 1.8, "#546e7a", 0.6);   // cord wrapping
  circle(ctx, 6, 2.2, 1.3, "#eceff1", "#90a4ae", 0.5);                    // pommel
  for (let i = 0; i < 3; i++) line(ctx, 6, 3, 6 + (i - 1) * 1.6 + Math.sin(T * 6 + i) * 1.2, 8 + Math.sin(T * 5 + i) * 1, "#80deea", 1.3);   // sword tassel (剑穗)
  poly(ctx, [[2.5, -6], [9.5, -6], [8, -8.2], [4, -8.2]], "#eceff1", "#90a4ae", 0.6);                   // flared guard
  const blade = ctx.createLinearGradient(4.5, 0, 7.5, 0);
  blade.addColorStop(0, "#b0bec5"); blade.addColorStop(0.5, "#ffffff"); blade.addColorStop(1, "#90a4ae");
  poly(ctx, [[4.6, -8.2], [7.4, -8.2], [7.2, -28], [6, -32], [4.8, -28]], blade, "#78909c", 0.6);        // long straight blade
  line(ctx, 6, -9, 6, -28, "#78909c", 0.5);                               // central ridge
  if (thrust > 0) { ctx.globalAlpha = thrust * 0.7; line(ctx, 6, -32, 6, -39, "#e0f7fa", 2); ctx.globalAlpha = 1; }   // a flash of cold light at the tip
  ctx.restore();
  line(ctx, -4, -9, -7 + armSwing, -2, "#ffeadb", 2.5);
  // A faint chill: tiny snowflakes drifting around her
  for (let i = 0; i < 4; i++) {
    const k = (T * 0.35 + i / 4) % 1, sx = -12 + Math.sin(T * 1.1 + i * 1.7) * 12 + k * 4, sy = 6 - k * 26;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
    line(ctx, sx - 1.4, sy, sx + 1.4, sy, "#e0f7fa", 0.9); line(ctx, sx, sy - 1.4, sx, sy + 1.4, "#e0f7fa", 0.9);
  }
  ctx.globalAlpha = 1;
}

// ---------- Flying companions ----------
export function drawEagle() {
  const g = state.eagle;
  if (!g) return;
  const groundY = g.owner.hp > 0 ? g.owner.y : g.owner.spawn.y;
  const height = Math.max(0, groundY - g.y);
  ctx.globalAlpha = 0.22 * Math.max(0.3, 1 - height / 80);
  ellipse(ctx, g.x, groundY + 10, (g.def.kind === "loong" ? 16 : 9) * Math.max(0.5, 1 - height / 120), 2.5, "#000");
  ctx.globalAlpha = 1;
  if (g.def.kind === "dragon") drawDragon(g); else if (g.def.kind === "loong") drawLoong(g); else drawBird(g);
}

// Yun: a serpentine Chinese loong, jade green with a gold belly, a flowing mane, antlers, whiskers and a pearl
function drawLoong(g) {
  const T = state.time;
  const pts = [{ x: g.x, y: g.y }, ...g.trail];
  if (pts.length < 2) return;
  // Body: a chain of overlapping scales from head to tail, swaying as it flies
  // Four legs: a front pair just behind the head and a hind pair further back. Each one paddles through the air.
  const legAt = [Math.min(3, pts.length - 2), Math.min(Math.round(pts.length * 0.55), pts.length - 2)];
  const legs = [];
  for (let i = pts.length - 1; i >= 1; i--) {
    const p = pts[i], k = i / pts.length, r = 5.5 * (1 - k * 0.8) + 1.2;
    const wob = Math.sin(T * 6 - i * 0.7) * 2.5 * k;
    const legIdx = legAt.indexOf(i);
    if (legIdx >= 0) { loongLeg(p.x, p.y + wob, r, g.dir, T * 7 + legIdx * 2.1 + Math.PI, true); legs.push([p.x, p.y + wob, r, legIdx]); }   // far-side leg behind the body
    circle(ctx, p.x, p.y + wob, r, i % 2 ? "#2e7d32" : "#43a047", "#1b5e20", 0.8);
    circle(ctx, p.x, p.y + wob + r * 0.35, r * 0.55, "#ffd54f");                                                      // gold belly scales
    if (i % 3 === 0 && i < pts.length - 2) line(ctx, p.x, p.y + wob - r, p.x - 2, p.y + wob - r - 5 - Math.sin(T * 8 + i) * 1.5, "#e53935", 1.6);   // dorsal fin spikes
  }
  for (const [lx, ly, lr, li] of legs) loongLeg(lx, ly, lr, g.dir, T * 7 + li * 2.1, false);     // near-side legs on top of the body
  const tail = pts[pts.length - 1];
  for (let i = -1; i <= 1; i++) line(ctx, tail.x, tail.y, tail.x - 8 + i * 2, tail.y + i * 5 + Math.sin(T * 5) * 2, "#e53935", 1.5);   // tail plume
  // Head
  const hx = g.x, hy = g.y, dir = g.dir;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(dir, 1);
  for (let i = 0; i < 5; i++) line(ctx, -4, -4 + i * 1.5, -11 - Math.sin(T * 5 + i) * 2, -10 + i * 2.5, "#ffb300", 1.6);   // flowing golden mane
  ellipse(ctx, 0, 0, 7.5, 5.5, "#43a047", "#1b5e20", 1);                                                              // head
  ellipse(ctx, 7, 1.5, 4.5, 3, "#66bb6a", "#1b5e20", 0.8);                                                             // snout
  for (const ax of [-2, 1.5]) { line(ctx, ax, -5, ax - 2, -12, "#d7ccc8", 2); line(ctx, ax - 1.2, -9, ax - 4, -12, "#d7ccc8", 1.4); }   // antlers
  circle(ctx, 2, -1.5, 1.6, "#fff"); circle(ctx, 2.5, -1.5, 0.9, "#b71c1c");                                           // fierce eye
  line(ctx, 0, -3.5, 4, -4.2, "#1b5e20", 1.2);                                                                           // brow
  for (const s of [-1, 1]) { ctx.strokeStyle = "#ffd54f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, 1); ctx.bezierCurveTo(14, 1 + s * 2, 16, 4 + s * 4 + Math.sin(T * 4) * 1.5, 20, 2 + s * 6); ctx.stroke(); }   // whiskers
  circle(ctx, 11, 0.5, 0.8, "#1b1b1b");                                                                                  // nostril
  line(ctx, 6, 3.5, 10.5, 3.2, "#1b5e20", 1); poly(ctx, [[7.5, 3.5], [8.5, 3.5], [8, 5.2]], "#fff");                    // mouth and a fang
  // The pearl it chases, glowing in front of its snout
  const pg = ctx.createRadialGradient(15, -4, 1, 15, -4, 7);
  pg.addColorStop(0, "rgba(255,255,255,0.95)"); pg.addColorStop(0.5, "rgba(255,224,130,0.7)"); pg.addColorStop(1, "rgba(255,224,130,0)");
  circle(ctx, 15, -4, 7, pg); circle(ctx, 15, -4, 2.2, "#fff8e1", "#ffb300", 0.6);
  ctx.restore();
  // Little wisps of cloud trailing the body
  for (let i = 2; i < pts.length; i += 5) { ctx.globalAlpha = 0.35; circle(ctx, pts[i].x + Math.sin(T * 2 + i) * 3, pts[i].y + 6, 3 + (i % 3), "#e3f2fd"); }
  ctx.globalAlpha = 1;
}

// One clawed loong leg: a short thigh, a shin that kicks back and forth, and three golden claws.
function loongLeg(x, y, r, dir, phase, far) {
  const swing = Math.sin(phase) * 0.7;
  const col = far ? "#2e7d32" : "#66bb6a", edge = far ? "#0d3d12" : "#1b5e20", claw = far ? "#c9a227" : "#ffd54f";
  const kx = x - dir * (2 + swing * 2), ky = y + r + 1.8;                     // knee
  const fx = kx + dir * (3 + swing * 2.5), fy = ky + 2.2 - Math.abs(swing);   // foot
  line(ctx, x, y + r * 0.4, kx, ky, edge, 3.4); line(ctx, x, y + r * 0.4, kx, ky, col, 2.2);
  line(ctx, kx, ky, fx, fy, edge, 2.8); line(ctx, kx, ky, fx, fy, col, 1.6);
  circle(ctx, fx, fy, 1.3, col, edge, 0.7);                                                                       // ankle
  for (let c = -1; c <= 1; c++) line(ctx, fx, fy, fx + dir * (2.2 - Math.abs(c) * 0.3) + c * 1.3, fy + 1.8 + Math.abs(c) * 0.4, claw, 1.3);   // three golden claws
}

function drawBird(g) {
  const flap = Math.sin(g.phase) * (g.dive && !g.dive.struck ? 0.25 : 0.9);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.dir, 1);
  for (const side of [-1, 1]) {
    const tipY = -2 - flap * 9;
    poly(ctx, [[-2, -1], [side * 6, -4 - flap * 4], [side * 16, tipY], [side * 15, tipY + 4], [side * 7, 2], [0, 3]], "#5d4037", "#3e2723", 0.8);
    for (const k of [0.6, 0.8, 1]) line(ctx, side * 16 * k, tipY + 4 * (1 - k) + 2, side * 16 * k + side * 2, tipY + 4 * (1 - k) + 4.5, "#8d6e63", 1);
  }
  ellipse(ctx, 0, 1, 6, 3.2, "#6d4c41", "#3e2723", 0.8);
  poly(ctx, [[-6, 1], [-11, -1], [-11, 3]], "#5d4037", "#3e2723", 0.8);
  circle(ctx, 6.5, -1, 3, "#fff8e1", "#6d4c41", 0.6);
  poly(ctx, [[8.5, -1.5], [12, -0.5], [8.5, 0.5]], "#ffb300", "#f57f17", 0.5);
  circle(ctx, 7.2, -1.6, 0.7, "#212121");
  ctx.restore();
}

// Cinder: a chubby red baby dragon with stubby wings, a cream belly and little horns
function drawDragon(g) {
  const flap = Math.sin(g.phase * 0.9) * 0.9, T = state.time;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.dir, 1);
  for (const side of [-1, 1]) {                                                 // bat-like wings
    const tipY = -6 - flap * 8;
    poly(ctx, [[-1, -3], [side * 5, -7 - flap * 3], [side * 13, tipY], [side * 12, tipY + 5], [side * 7, 0], [0, 1]], "#c62828", "#7f0000", 0.8);
    line(ctx, -1, -3, side * 13, tipY, "#7f0000", 1); line(ctx, -1, -3, side * 12, tipY + 5, "#7f0000", 0.8);
  }
  line(ctx, -6, 2, -14 + Math.sin(T * 4) * 1.5, 6, "#d32f2f", 3);               // tail
  poly(ctx, [[-14 + Math.sin(T * 4) * 1.5, 4], [-18 + Math.sin(T * 4) * 1.5, 6], [-14 + Math.sin(T * 4) * 1.5, 8]], "#ff8a65");   // tail fin
  ellipse(ctx, 0, 1, 7, 5, "#e53935", "#7f0000", 0.8);                          // round body
  ellipse(ctx, 1, 2.5, 4, 3, "#ffe0b2");                                        // cream belly
  for (const lx of [-3, 3]) line(ctx, lx, 5, lx, 8, "#c62828", 2.2);            // stubby legs
  circle(ctx, 7, -3, 5, "#e53935", "#7f0000", 0.8);                             // head
  ellipse(ctx, 11, -1.5, 3.5, 2.5, "#ef5350");                                  // snout
  for (const hx of [5, 8]) poly(ctx, [[hx - 1, -7], [hx, -10.5], [hx + 1, -7]], "#ffe0b2", "#bcaaa4", 0.5);   // horns
  circle(ctx, 8, -4, 1.4, "#fff"); circle(ctx, 8.4, -4, 0.8, "#212121");         // big eye
  circle(ctx, 13.5, -2, 0.6, "#4a0000"); circle(ctx, 13, -0.6, 0.6, "#4a0000");   // nostrils
  if (g.breath > 0) {                                                           // a puff of flame from the mouth
    const k = g.breath / 0.3;
    ctx.globalAlpha = k;
    poly(ctx, [[13, 0], [22 + (1 - k) * 6, -4], [26 + (1 - k) * 8, 0.5], [22 + (1 - k) * 6, 4]], "#ff9800");
    poly(ctx, [[13, 0], [19 + (1 - k) * 4, -2], [22 + (1 - k) * 5, 0.5], [19 + (1 - k) * 4, 2.5]], "#ffeb3b");
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.6; circle(ctx, 14.5, -1.5 - (T % 1) * 4, 1.2, "#9e9e9e"); ctx.globalAlpha = 1;   // a wisp of smoke from the nostrils
  }
  ctx.restore();
}

// ---------- Four-legged companions ----------
export function drawDog() {
  const d = state.dog;
  if (!d || d.hp <= 0) return;
  if (d.def.kind === "bear") { drawBear(d); return; }
  const run = Math.min(1, d.speedNow / d.def.speed);
  const sw = Math.sin(d.phase) * 4 * run;
  const bob = Math.abs(Math.sin(d.phase)) * 1.5 * run;
  const sit = !d.moving && !d.target;
  const wag = Math.sin(state.time * (sit ? 9 : 5)) * (sit ? 4 : 2);
  const lungeBite = d.bite > 0 ? Math.sin((d.bite / 0.2) * Math.PI) * 3 : 0;
  shadow(ctx, d.x, d.y + 8, 10, 3);
  ctx.save();
  ctx.translate(d.x + lungeBite * Math.sign(d.face || 1), d.y - bob);
  ctx.scale(Math.sign(d.face || 1) * Math.max(0.2, Math.abs(d.face)), 1);
  if (sit) {
    ellipse(ctx, -5, 0, 7, 5, "#5d4037");
    line(ctx, 3, 0, 3, 7, "#8d6e63", 2.5); line(ctx, 6, 0, 6, 7, "#8d6e63", 2.5);
    poly(ctx, [[-10, 2], [8, 2], [7, -12], [-6, -4]], "#c89b5a", "#6d4c41", 1);
    poly(ctx, [[-9, 0], [3, -6], [6, -12], [-5, -4]], "#2b2b2b");
    line(ctx, -10, 2, -16 + wag, -4, "#2b2b2b", 3.5);
    circle(ctx, 9, -16, 5.5, "#c89b5a", "#6d4c41", 1);
    poly(ctx, [[5, -20], [6, -27], [9, -20]], "#2b2b2b", "#1a1a1a", 0.8);
    poly(ctx, [[9, -20.5], [12, -27], [13, -20]], "#2b2b2b", "#1a1a1a", 0.8);
    ellipse(ctx, 14, -14.5, 4, 2.8, "#2b2b2b");
    circle(ctx, 17.5, -15, 1.3, "#111");
    circle(ctx, 11, -17, 1.1, "#3e2723");
    rect(ctx, 6, -12, 7, 2, "#c62828");
  } else {
    for (const [lx, k] of [[-7, 1], [-3, -1], [5, 1], [9, -1]]) line(ctx, lx, 0, lx + sw * k, 7, "#8d6e63", 2.5);
    ellipse(ctx, 0, -5, 12, 6, "#c89b5a", "#6d4c41", 1);
    poly(ctx, [[-10, -7], [-6, -11], [6, -11], [10, -7], [6, -5], [-6, -5]], "#2b2b2b");
    ellipse(ctx, 1, -2, 7, 2.5, "#e3c79a");
    line(ctx, -12, -6, -19 + wag * 0.5, -12 + wag, "#2b2b2b", 3.5);
    circle(ctx, 12, -9 + (d.target ? 2 : 0), 5.5, "#c89b5a", "#6d4c41", 1);
    poly(ctx, [[8, -13], [9, -20], [12, -13]], "#2b2b2b", "#1a1a1a", 0.8);
    poly(ctx, [[12, -13.5], [15, -20], [16, -13]], "#2b2b2b", "#1a1a1a", 0.8);
    ellipse(ctx, 17, -7.5, 4, 2.8, "#2b2b2b");
    circle(ctx, 20.5, -8, 1.3, "#111");
    if (d.bite > 0) line(ctx, 15, -6, 20, -5.5, "#fff", 1.2);
    circle(ctx, 14, -10, 1.1, "#3e2723");
    rect(ctx, 8, -6, 6, 2, "#c62828");
  }
  ctx.restore();
  const w = 20, x = d.x - w / 2, y = d.y - 26;
  rect(ctx, x, y, w, 3, "#222");
  rect(ctx, x, y, w * (d.hp / d.maxHp), 3, "#ffab91");
}

// Bramble: a big brown bear who lumbers along and rears up to swipe
function drawBear(d) {
  const run = Math.min(1, d.speedNow / d.def.speed);
  const sw = Math.sin(d.phase) * 5 * run;
  const bob = Math.abs(Math.sin(d.phase * 0.5)) * 2 * run;
  const idle = !d.moving && !d.target;
  const swipe = d.bite > 0 ? Math.sin((d.bite / 0.2) * Math.PI) : 0;
  const T = state.time;
  shadow(ctx, d.x, d.y + 10, 16, 5);
  ctx.save();
  ctx.translate(d.x, d.y - bob);
  ctx.scale(Math.sign(d.face || 1) * Math.max(0.2, Math.abs(d.face)), 1);
  // Legs: thick, with claws
  for (const [lx, k] of [[-10, 1], [-5, -1], [7, 1], [12, -1]]) {
    line(ctx, lx, 0, lx + sw * k, 9, "#4e342e", 5);
    for (const c of [-2, 0, 2]) line(ctx, lx + sw * k + c, 10, lx + sw * k + c * 1.2, 12.5, "#eceff1", 1);
  }
  // Body: a big shaggy mound, lighter muzzle and belly
  const fur = ctx.createRadialGradient(-2, -10, 2, 0, -4, 20);
  fur.addColorStop(0, "#8d6e63"); fur.addColorStop(1, "#4e342e");
  ellipse(ctx, 0, -5 + (idle ? Math.sin(T * 1.5) * 0.4 : 0), 17, 10, fur, "#3e2723", 1);
  for (const [fx, fy] of [[-10, -11], [-3, -14], [5, -13], [11, -9]]) line(ctx, fx, fy, fx - 1.5, fy - 4, "#3e2723", 1.5);   // shaggy tufts
  ellipse(ctx, 2, 0, 9, 4, "#a1887f");
  circle(ctx, -15, -6, 3, "#5d4037");                                          // stubby tail
  // Head, raised when swiping
  const hy = -12 - swipe * 6, hx = 14 - swipe * 3;
  circle(ctx, hx, hy, 7.5, "#6d4c41", "#3e2723", 1);
  for (const ex of [-4, 4]) { circle(ctx, hx + ex, hy - 6.5, 2.6, "#5d4037", "#3e2723", 0.8); circle(ctx, hx + ex, hy - 6.5, 1.3, "#a1887f"); }   // round ears
  ellipse(ctx, hx + 6, hy + 1.5, 4.5, 3.2, "#a1887f");                          // muzzle
  circle(ctx, hx + 9.5, hy + 0.5, 1.6, "#212121");                               // nose
  circle(ctx, hx + 3, hy - 1.5, 1.2, "#212121");                                 // eye
  if (d.bite > 0) {                                                             // roaring, with a raised paw
    line(ctx, hx + 4, hy + 3.5, hx + 9, hy + 4, "#3e2723", 1.4);
    poly(ctx, [[hx + 5, hy + 3.5], [hx + 6, hy + 3.5], [hx + 5.5, hy + 5.5]], "#fff");
    line(ctx, 9, -8, 18 + swipe * 4, -16 - swipe * 6, "#4e342e", 5);
    for (const c of [-2, 0, 2]) line(ctx, 18 + swipe * 4 + c, -17 - swipe * 6, 20 + swipe * 4 + c * 1.3, -20 - swipe * 6, "#eceff1", 1.2);
  }
  ctx.restore();
  const w = 26, x = d.x - w / 2, y = d.y - 30;
  rect(ctx, x, y, w, 3, "#222");
  rect(ctx, x, y, w * (d.hp / d.maxHp), 3, "#ffab91");
}

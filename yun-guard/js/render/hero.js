import { ctx, rect, circle, ellipse, poly, line, shadow } from "./gfx.js";
import { state } from "../state.js";
import { xpToNext } from "../hero.js";

const ACCENT = { april: "#9fa8da", avril: "#f48fb1", ember: "#ffab91", willow: "#aed581", meilin: "#b2ebf2", adrien: "#ffe082" };
const RING = { april: "rgba(159,168,218,0.28)", avril: "rgba(244,143,177,0.25)", ember: "rgba(255,171,145,0.25)", willow: "rgba(174,213,129,0.25)", meilin: "rgba(178,235,242,0.28)", adrien: "rgba(255,224,130,0.28)" };
const BAR = { april: "#5c6bc0", avril: "#f06292", ember: "#ff7043", willow: "#8bc34a", meilin: "#4dd0e1", adrien: "#ffca28" };

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

  if (h.charge) {                                                             // Sir Adrien's charge: a golden streak and dust behind him
    for (const p of h.charge.trail) { ctx.globalAlpha = (1 - p.t / 0.25) * 0.35; circle(ctx, p.x, p.y - 8, 9 * (1 - p.t / 0.25) + 2, "#ffe082"); }
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
  ({ april: drawApril, avril: drawAvril, ember: drawEmber, willow: drawWillow, meilin: drawMeiLin, adrien: drawAdrien }[h.kind] || drawApril)(h, anim);
  ctx.restore();

  if (h.levelFlash > 0) {
    ctx.globalAlpha = h.levelFlash / 1.2 * 0.6;
    circle(ctx, h.x, h.y - 5, 22 + (1.2 - h.levelFlash) * 20, null, "#80deea", 3);
    ctx.globalAlpha = 1;
  }
  const w = 30, x = h.x - w / 2, y = h.y - 42;                                  // well above the head, clear of the face
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
  const T = state.time;
  const navy = "#1a237e", sapphire = "#3949ab", silver = "#cfd8dc", silverDark = "#78909c", leather = "#4e342e", hair = "#6d2f1f", hairLight = "#9c4a2e", skin = "#ffe0b2";
  // A short sapphire half-cape over the left shoulder, streaming out when she runs
  const flow = 1 + run * 5 + Math.sin(h.phase * 0.5) * run * 1.5;
  poly(ctx, [[-6, -13 - breathe], [-1, -13 - breathe], [-3 - flow, 2 + run * 2], [-11 - flow, -1 + run * 3]], sapphire, navy, 0.8);
  line(ctx, -3 - flow, 2 + run * 2, -11 - flow, -1 + run * 3, silver, 1);                                  // silver hem
  // Long legs in fitted dark breeches and tall riding boots
  line(ctx, -3, 3, -3 + sw, 11, navy, 3.2); line(ctx, 3, 3, 3 - sw, 11, navy, 3.2);
  rect(ctx, -5.5 + sw, 7, 5, 6, leather); rect(ctx, 0.5 - sw, 7, 5, 6, leather);
  line(ctx, -5.5 + sw, 7, -0.5 + sw, 7, silverDark, 1); line(ctx, 0.5 - sw, 7, 5.5 - sw, 7, silverDark, 1);   // boot cuffs
  // Fitted midnight coat with a high collar and silver frogging; a laced leather corset-belt at the waist
  poly(ctx, [[-5.5, -12 - breathe], [5.5, -12 - breathe], [5, 4], [-5, 4]], navy, "#0d1545", 0.8);
  for (const fy of [-9, -6, -3]) { line(ctx, -2.5, fy - breathe * 0.5, 2.5, fy - breathe * 0.5, silver, 0.9); circle(ctx, -2.8, fy - breathe * 0.5, 0.7, silver); circle(ctx, 2.8, fy - breathe * 0.5, 0.7, silver); }
  poly(ctx, [[-3, -12 - breathe], [3, -12 - breathe], [1.5, -9 - breathe], [-1.5, -9 - breathe]], skin);  // the V of the open collar
  poly(ctx, [[-5.5, -12.5 - breathe], [-2.5, -12.5 - breathe], [-1, -9.5 - breathe]], silver); poly(ctx, [[5.5, -12.5 - breathe], [2.5, -12.5 - breathe], [1, -9.5 - breathe]], silver);   // high collar, silver-lined
  rect(ctx, -5.5, 0, 11, 4, leather); for (let i = -1; i <= 1; i++) line(ctx, i * 1.5 - 0.8, 0.5, i * 1.5 + 0.8, 3.5, silverDark, 0.6);   // corset lacing
  // One silver pauldron on the sword arm; a slim steel vambrace on the other
  ellipse(ctx, 6, -12 - breathe, 4, 2.6, silver, silverDark, 0.8);
  // Hair: dark auburn, swept into a high ponytail tied with a sapphire ribbon, swinging as she moves
  const swing = Math.sin(h.phase - 0.8) * 3 * run + Math.sin(T * 1.8) * 0.5;
  poly(ctx, [[-2, -25 - breathe], [-7 - run * 2, -20 - breathe + swing], [-9 - run * 3, -11 + swing * 1.4], [-6 - run * 2, -8 + swing * 1.6], [-4, -14 - breathe]], hair, "#4a1f12", 0.6);
  line(ctx, -4.5, -22 - breathe, -7.5 - run * 2.5, -12 + swing * 1.3, hairLight, 1);                     // a glossy strand
  const fy = -18 - breathe;
  ellipse(ctx, -1, fy - 0.2, 5.3, 6, hair);                                                                // the back of the head
  circle(ctx, 0, fy, 5, skin);                                                                             // face
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, fy - 0.6, 5.3, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();   // hairline
  poly(ctx, [[-5.3, fy - 1.2], [-3, fy - 5.5], [0.5, fy - 3.5], [2, fy - 6], [5.3, fy - 1.2]], hair);       // side-parted fringe
  ellipse(ctx, -1.5, fy - 6.2, 3, 2.2, hair);                                                              // the knot of the ponytail
  poly(ctx, [[-2.8, fy - 6.5], [-0.5, fy - 7.8], [-1.6, fy - 5.6], [-3.8, fy - 4.6]], sapphire);          // ribbon bow
  circle(ctx, 3.6, fy + 1.2, 0.6, silver);                                                                 // a small silver earring
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 2.6, 4.2, 2.2, "#000"); ctx.globalAlpha = 1;                // soft shade under the chin
  // Off hand: gloved, held back for balance like a duellist, with a steel vambrace
  const armSwing = -sw * 0.8;
  line(ctx, -5, -9, -10 + armSwing, -4, navy, 2.6); line(ctx, -8 + armSwing, -6, -10 + armSwing, -4, silver, 2.2); circle(ctx, -10.5 + armSwing, -3.5, 1.4, leather);
  // Sword arm and a slender silver blade with a swept guard; lunges forward on a strike, else held low and ready
  if (h.swing > 0) {
    line(ctx, 5, -9, 11, -11, navy, 2.6); circle(ctx, 11.5, -11, 1.4, leather);
    poly(ctx, [[9.5, -12.5], [13.5, -12.5], [13.5, -9.5], [9.5, -9.5]], silver, silverDark, 0.5);        // swept guard
    line(ctx, 13, -11, 30, -17, "#eceff1", 2); line(ctx, 13, -11, 30, -17, "#fff", 0.6);                 // blade with a bright edge
  } else {
    line(ctx, 5, -9, 9 - armSwing, -2, navy, 2.6); circle(ctx, 9.5 - armSwing, -1.5, 1.4, leather);
    poly(ctx, [[7.5 - armSwing, -3], [11.5 - armSwing, -3], [11.5 - armSwing, 0], [7.5 - armSwing, 0]], silver, silverDark, 0.5);
    line(ctx, 9.5 - armSwing, -1, 14.5 - armSwing, 14, "#eceff1", 2); line(ctx, 9.5 - armSwing, -1, 14.5 - armSwing, 14, "#fff", 0.6);
    circle(ctx, 9.5 - armSwing, -4.5, 1, "#64b5f6");                                                      // sapphire pommel
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
  const fy = -17.2 - breathe;
  circle(ctx, 0, fy, 4.2, "#ffe0b2");                                                                       // a small, dainty face
  ctx.fillStyle = "#4e342e"; ctx.beginPath(); ctx.arc(0, fy - 0.4, 4.4, Math.PI * 1.03, Math.PI * 1.97); ctx.fill();
  line(ctx, -4, fy - 1.3, -1.2, fy - 3.6, "#6d4c41", 1);
  poly(ctx, [[-3.8, fy - 2.6], [-2.1, fy - 5.2], [0, fy - 3.9], [2.1, fy - 6.4], [3.8, fy - 2.6]], "#ffd54f", "#f9a825", 0.7);   // tiara
  circle(ctx, 2.1, fy - 5.6, 1, "#f06292", "#ad1457", 0.4);
  circle(ctx, -2.1, fy - 4.5, 0.5, "#ffffff"); circle(ctx, 0, fy - 3.3, 0.5, "#ffffff");
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 2.1, 3.5, 1.9, "#000"); ctx.globalAlpha = 1;          // soft shade under the chin
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
  poly(ctx, [[-2, -24], [-7 - wind * 0.5, -21 + hs], [-11 - wind * 0.8, -16 + hs * 1.3], [-13 - wind, -10 + hs * 1.6], [-10 - wind * 0.6, -10 + hs], [-6 - wind * 0.3, -13.5 + hs], [-3, -15]], "#1b1b1b");
  line(ctx, -5, -21.5, -10.5 - wind * 0.8, -13 + hs * 1.3, "#607d8b", 1);                                             // glossy highlight
  const fy = -18 - breathe;
  // Thin side locks (鬓发) framing the face, swaying gently
  const lk = Math.sin(T * 2.2) * 0.5;
  poly(ctx, [[-3, fy - 1], [-3.4 + lk, fy + 3.1], [-2.7 + lk, fy + 3.5], [-2.5, fy + 0.5]], "#1b1b1b");
  poly(ctx, [[3, fy - 0.5], [3.2 - lk, fy + 2.9], [2.6 - lk, fy + 3.2], [2.5, fy + 0.5]], "#1b1b1b");
  // Back of the head is covered in hair: a dark mass behind and slightly left of the face, running down into the ponytail
  ellipse(ctx, -0.9, fy - 0.2, 3.4, 4, "#1b1b1b");
  poly(ctx, [[-4, fy - 1], [-3.8, fy + 2.6], [-2.7, fy + 3.5], [-2.5, fy + 1]], "#1b1b1b");
  // Face: fair porcelain skin, simple and clean like the other heroes
  ellipse(ctx, 0, fy + 0.2, 3, 3.7, "#ffeadb");                                                                       // small oval face
  ctx.fillStyle = "#1b1b1b"; ctx.beginPath(); ctx.ellipse(0, fy - 0.4, 3.2, 3.9, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.fill(); // hairline
  line(ctx, -3, fy - 1.1, -0.8, fy - 2.8, "#546e7a", 0.8);                                                            // a glossy sweep in the fringe
  ellipse(ctx, -0.7, fy - 4.6, 2.2, 1.6, "#1b1b1b");                                                                   // high ponytail knot
  circle(ctx, -1.1, fy - 5, 0.55, "#455a64");
  rect(ctx, -1.8, fy - 3.8, 2.1, 0.8, "#eceff1");                                                                       // silver hair tie
  // Small silver hairpin with two dangling blue beads
  line(ctx, -2, fy - 5, 2.6, fy - 6.3, "#f5f7f8", 0.8);
  circle(ctx, 2.7, fy - 6.4, 0.65, "#b2ebf2", "#4dd0e1", 0.5);
  for (let i = 0; i < 2; i++) { const bx = 1.5 + i * 0.9, by = fy - 5.2 + i * 1.3 + Math.sin(T * 4 + i) * 0.4; line(ctx, 1.2 + i * 0.9, fy - 5.6, bx, by, "#eceff1", 0.5); circle(ctx, bx, by, 0.45, "#80deea"); }
  // A clean, featureless face like the other legends; only the tiny blue huadian (花钿) ornament on the brow
  circle(ctx, 0.35, fy - 1.2, 0.4, "#4dd0e1");
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 2, 2.5, 1.5, "#000"); ctx.globalAlpha = 1;             // soft shade under the chin
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
  for (let i = 0; i < 3; i++) line(ctx, 6, 3, 6 + (i - 1) * 1.6 + Math.sin(T * 6 + i) * 1.2, 8 + Math.sin(T * 5 + i) * 1, "#cfd8dc", 1.3);   // silver sword tassel (剑穗)
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

// ---------- Sir Adrien: a gallant paladin in white and gold plate, crimson cape, lance and kite shield ----------
function drawAdrien(h, a) {
  const { run, sw, breathe } = a;
  const T = state.time, charging = !!h.charge;
  const gold = "#e9c55a", goldDark = "#b8902a", plate = "#eceff1", plateDark = "#90a4ae", blue = "#1e3a8a", blueLight = "#3b5bb5", crimson = "#b71c1c", crimsonDark = "#7f0000";
  // Cape: crimson with a gold hem, streaming out behind when he moves (and whipping flat in a charge)
  const flow = 1 + run * 6 + Math.sin(h.phase * 0.5) * run * 1.5 + (charging ? 8 : 0);
  poly(ctx, [[-4, -14], [4, -14], [-1 - flow, 7 + run * 2 - (charging ? 6 : 0)], [-10 - flow, 4 + run * 3 - (charging ? 8 : 0)]], crimson, crimsonDark, 1);
  line(ctx, -1 - flow, 7 + run * 2 - (charging ? 6 : 0), -10 - flow, 4 + run * 3 - (charging ? 8 : 0), gold, 1.2);
  // Legs: steel greaves and dark boots
  line(ctx, -3, 4, -3 + sw, 11, plateDark, 3.5); line(ctx, 3, 4, 3 - sw, 11, plateDark, 3.5);
  rect(ctx, -5 + sw, 10, 5, 3, "#37474f"); rect(ctx, 1 - sw, 10, 5, 3, "#37474f");
  // Breastplate with a royal-blue tabard and a gold sun
  poly(ctx, [[-7, -12 - breathe], [7, -12 - breathe], [6, 5], [-6, 5]], plate, plateDark, 1);
  rect(ctx, -3.5, -11 - breathe, 7, 15 + breathe, blue);
  line(ctx, -3.5, -11 - breathe, -3.5, 4, gold, 0.8); line(ctx, 3.5, -11 - breathe, 3.5, 4, gold, 0.8);
  circle(ctx, 0, -5, 2.4, gold); for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + T * 0.5; line(ctx, Math.cos(an) * 2.8, -5 + Math.sin(an) * 2.8, Math.cos(an) * 4, -5 + Math.sin(an) * 4, gold, 0.8); }   // sun rays
  rect(ctx, -6.5, 1, 13, 2.5, "#4e342e"); circle(ctx, 0, 2.2, 1.3, gold);   // belt
  // Gold pauldrons
  ellipse(ctx, -6.5, -12 - breathe, 4.5, 2.8, gold, goldDark, 1); ellipse(ctx, 6.5, -12 - breathe, 4.5, 2.8, gold, goldDark, 1);
  // Head: fair skin, golden hair swept back, a slim gold circlet; a clean face like the other legends
  const fy = -18 - breathe;
  poly(ctx, [[-5, fy - 2], [-7, fy + 4], [-4, fy + 5], [-4, fy]], "#f0b84a");                                   // hair falling behind the jaw
  circle(ctx, 0, fy, 5.2, "#ffe0b2");
  ctx.fillStyle = "#f6c453"; ctx.beginPath(); ctx.arc(0, fy - 0.6, 5.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();   // hair
  poly(ctx, [[-5.2, fy - 1.5], [-2, fy - 6.5], [1.5, fy - 4.5], [3.5, fy - 6.8], [5.2, fy - 1.5]], "#f6c453");   // swept-back fringe
  line(ctx, -5.2, fy - 1.2, 5.2, fy - 1.2, gold, 1.2); circle(ctx, 0, fy - 1.4, 0.9, "#64b5f6");                  // circlet with a sapphire
  ctx.globalAlpha = 0.08; ellipse(ctx, 0, fy + 2.6, 4.2, 2.2, "#000"); ctx.globalAlpha = 1;                        // soft shade under the chin
  // Kite shield on the left arm: blue with a gold sun and rim
  const armSwing = -sw * 0.8;
  line(ctx, -5, -9, -9 + armSwing, -3, plateDark, 3);
  poly(ctx, [[-14 + armSwing, -9], [-5 + armSwing, -9], [-5 + armSwing, -1], [-9.5 + armSwing, 4], [-14 + armSwing, -1]], blue, gold, 1.5);
  circle(ctx, -9.5 + armSwing, -4, 2.2, gold); circle(ctx, -9.5 + armSwing, -4, 1, blueLight);
  // Lance: long ash shaft, steel tip, a blue pennant that flutters. Carried upright; levelled for a thrust or charge
  const level = charging ? 1 : h.swing > 0 ? Math.sin((h.swing / 0.25) * Math.PI) : 0;
  ctx.save();
  ctx.translate(5, -9);
  ctx.rotate(-1.15 + level * 1.15);                                      // from pointing up-forward to dead level
  line(ctx, 0, 0, 6, 0, plateDark, 3);                                   // arm
  line(ctx, 2, 3, 34, 3, "#d7ccc8", 2.6);                                // shaft
  circle(ctx, 4, 3, 2.2, gold);                                          // grip guard
  poly(ctx, [[34, 1.4], [42, 3], [34, 4.6]], "#eceff1", plateDark, 0.6); // steel tip
  const fl = Math.sin(T * 9 + h.phase) * 1.5 + level * 2;
  poly(ctx, [[28, 3], [28, -5], [20 - fl, -2 + fl * 0.3], [24, 3]], blueLight, blue, 0.6);   // pennant
  if (charging) { ctx.globalAlpha = 0.6; line(ctx, 42, 3, 50, 3, "#fff8dc", 2.5); ctx.globalAlpha = 1; }   // the tip gleams
  ctx.restore();
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
    circle(ctx, p.x, p.y + wob, r, i % 2 ? "#2e7d32" : "#43a047", "rgba(20,70,25,0.3)", 0.6);
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
  ellipse(ctx, 0, 0, 7.5, 5.5, "#43a047", "rgba(20,70,25,0.3)", 0.6);                                                 // head
  ellipse(ctx, 7, 1.5, 4.5, 3, "#66bb6a", "rgba(20,70,25,0.3)", 0.6);                                                 // snout
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
  const dark = "#4e342e", mid = "#5d4037", light = "#795548", white = "#fafafa";
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.dir, 1);
  // Broad wings: a smooth swept leading edge out to the tip, and a trailing edge notched into four
  // long primaries. The whole wing hinges at the shoulder as it flaps.
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * 2, 0); ctx.scale(side, 1); ctx.rotate(-flap * 0.55);
    ctx.fillStyle = mid; ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(9, -5, 21, -5);                                   // leading edge
    for (const [x1, y1, x2, y2] of [[21, -5, 19, 1], [17.5, -1, 16, 4], [14.5, 1.5, 13, 6], [11.5, 3.5, 10, 7.5]]) { ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); }   // primaries
    ctx.quadraticCurveTo(5, 6, 0, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath();                                 // lighter coverts along the leading edge
    ctx.moveTo(0, -1); ctx.quadraticCurveTo(9, -5, 19, -4.5); ctx.quadraticCurveTo(9, -1.5, 0, 1.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ellipse(ctx, 0, 1.5, 6.5, 3.4, dark);                                                             // body
  poly(ctx, [[-5, 0], [-13, -2.5], [-14, 2], [-13, 5.5], [-5, 3]], white);                          // fanned white tail
  for (let i = -1; i <= 1; i++) line(ctx, -6, 1.5, -13, 1.5 + i * 3, "#e0e0e0", 0.7);              // tail feather lines
  // White head with a heavy hooked yellow beak and a sharp dark eye
  ellipse(ctx, 6.5, -1, 3.6, 3, white);
  poly(ctx, [[8.8, -2.6], [13.2, -1.4], [12.6, 0.8], [10.2, 0.6], [9, -0.4]], "#f9a825");          // beak
  poly(ctx, [[13.2, -1.4], [12.6, 0.8], [13.6, 1.2]], "#ef8f00");                                  // the hook
  circle(ctx, 7.6, -1.8, 0.8, "#212121"); circle(ctx, 7.9, -2, 0.3, "#fff");
  line(ctx, 6.2, -3.2, 8.6, -2.8, "#9e9e9e", 0.6);                                                 // a stern brow
  if (g.dive && !g.dive.struck) for (const tx of [3, 5]) line(ctx, tx, 4, tx + 2, 8, "#f9a825", 1.2);   // talons out on a dive
  ctx.restore();
}

// Cinder: a chubby red baby dragon with stubby wings, a cream belly and little horns
function drawDragon(g) {
  const OUT = "rgba(127,0,0,0.22)", HORN_OUT = "rgba(188,170,164,0.3)";           // subtle outlines
  const flap = Math.sin(g.phase * 0.9) * 0.9, T = state.time;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.dir * 1.6, 1.6);                                                    // a bigger dragon, same design
  for (const side of [-1, 1]) {                                                 // bat-like wings
    const tipY = -6 - flap * 8;
    poly(ctx, [[-1, -3], [side * 5, -7 - flap * 3], [side * 13, tipY], [side * 12, tipY + 5], [side * 7, 0], [0, 1]], "#c62828", OUT, 0.8);
    line(ctx, -1, -3, side * 13, tipY, OUT, 1); line(ctx, -1, -3, side * 12, tipY + 5, OUT, 0.8);
  }
  {                                                                             // tail: thick at the root, tapering to the tip
    const w = Math.sin(T * 4) * 1.5, tipX = -14.5 + w, midX = -10.5 + w * 0.5;
    poly(ctx, [[-5.5, -0.2], [midX, 2.6], [tipX, 5.6], [tipX, 6.4], [midX, 5.2], [-5.5, 3.8]], "#d32f2f");
  }
  {                                                                             // the tip of the tail burns like a candle
    const tx = -16.1 + Math.sin(T * 4) * 1.5, ty = 5.4, fl = 1 + Math.sin(T * 13) * 0.18, lean = Math.sin(T * 7) * 0.8;
    ctx.globalAlpha = 0.9;
    poly(ctx, [[tx - 2.6, ty + 1], [tx - 3.2 + lean, ty - 3 * fl], [tx - 1.5 + lean * 1.6, ty - 7 * fl], [tx + 0.4 + lean, ty - 3 * fl], [tx + 1.4, ty + 1]], "#ff7043");
    poly(ctx, [[tx - 1.4, ty + 0.5], [tx - 1.6 + lean, ty - 2 * fl], [tx - 0.9 + lean * 1.2, ty - 4.2 * fl], [tx + 0.2 + lean, ty - 2 * fl], [tx + 0.6, ty + 0.5]], "#ffeb3b");
    ctx.globalAlpha = 1;
  }
  ellipse(ctx, 0, 1, 7, 5, "#e53935", OUT, 0.8);                          // round body
  ellipse(ctx, 1, 2.5, 4, 3, "#ffe0b2");                                        // cream belly
  for (const lx of [-3, 3]) line(ctx, lx, 5, lx, 8, "#c62828", 2.2);            // stubby legs
  circle(ctx, 7, -3, 5, "#e53935", OUT, 0.8);                             // head
  ellipse(ctx, 11, -1.5, 3.5, 2.5, "#ef5350");                                  // snout
  for (const hx of [5, 8]) poly(ctx, [[hx - 1, -7], [hx, -10.5], [hx + 1, -7]], "#ffe0b2", HORN_OUT, 0.5);   // horns
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
  if (d.def.kind === "lion") { drawLion(d); return; }
  const run = Math.min(1, d.speedNow / d.def.speed);
  const sw = Math.sin(d.phase) * 4 * run;
  const bob = Math.abs(Math.sin(d.phase)) * 1.5 * run;
  const sit = !d.moving && !d.target;
  const wag = Math.sin(state.time * (sit ? 9 : 5)) * (sit ? 4 : 2);
  const lungeBite = d.bite > 0 ? Math.sin((d.bite / 0.2) * Math.PI) * 3 : 0;
  shadow(ctx, d.x, d.y + 8, 10, 3);
  ctx.save();
  ctx.translate(d.x + lungeBite * Math.sign(d.face || 1), d.y - bob);
  ctx.scale(Math.sign(d.face || 1) * Math.max(0.2, Math.abs(d.face)) * 0.82, 0.82);                      // a little smaller than the heroes
  if (sit) {
    ellipse(ctx, -5, 0, 7, 5, "#5d4037");
    line(ctx, 3, 0, 3, 7, "#8d6e63", 2.5); line(ctx, 6, 0, 6, 7, "#8d6e63", 2.5);
    poly(ctx, [[-10, 2], [8, 2], [7, -12], [-6, -4]], "#c89b5a");
    poly(ctx, [[-9, 0], [3, -6], [6, -12], [-5, -4]], "#2b2b2b");
    line(ctx, -10, 2, -16 + wag, -4, "#2b2b2b", 3.5);
    circle(ctx, 9, -16, 5.5, "#c89b5a");
    poly(ctx, [[5, -20], [6, -27], [9, -20]], "#2b2b2b");
    poly(ctx, [[9, -20.5], [12, -27], [13, -20]], "#2b2b2b");
    ellipse(ctx, 14, -14.5, 4, 2.8, "#2b2b2b");
    circle(ctx, 17.5, -15, 1.3, "#111");
    circle(ctx, 11, -17, 1.1, "#3e2723");
    rect(ctx, 6, -12, 7, 2, "#c62828");
  } else {
    for (const [lx, k] of [[-7, 1], [-3, -1], [5, 1], [9, -1]]) line(ctx, lx, 0, lx + sw * k, 7, "#8d6e63", 2.5);
    ellipse(ctx, 0, -5, 12, 6, "#c89b5a");
    poly(ctx, [[-10, -7], [-6, -11], [6, -11], [10, -7], [6, -5], [-6, -5]], "#2b2b2b");
    ellipse(ctx, 1, -2, 7, 2.5, "#e3c79a");
    line(ctx, -12, -6, -19 + wag * 0.5, -12 + wag, "#2b2b2b", 3.5);
    circle(ctx, 12, -9 + (d.target ? 2 : 0), 5.5, "#c89b5a");
    poly(ctx, [[8, -13], [9, -20], [12, -13]], "#2b2b2b");
    poly(ctx, [[12, -13.5], [15, -20], [16, -13]], "#2b2b2b");
    ellipse(ctx, 17, -7.5, 4, 2.8, "#2b2b2b");
    circle(ctx, 20.5, -8, 1.3, "#111");
    if (d.bite > 0) line(ctx, 15, -6, 20, -5.5, "#fff", 1.2);
    circle(ctx, 14, -10, 1.1, "#3e2723");
    rect(ctx, 8, -6, 6, 2, "#c62828");
  }
  ctx.restore();
  const w = 20, x = d.x - w / 2, y = d.y - 24;
  rect(ctx, x, y, w, 3, "#222");
  rect(ctx, x, y, w * (d.hp / d.maxHp), 3, "#ffab91");
}

// Leon: a golden lion with a deep russet mane, a tufted tail and a proud stance
function drawLion(d) {
  const run = Math.min(1, d.speedNow / d.def.speed);
  const sw = Math.sin(d.phase) * 5 * run, bob = Math.abs(Math.sin(d.phase)) * 1.6 * run;
  const sit = !d.moving && !d.target;
  const flick = Math.sin(state.time * (sit ? 3 : 6)) * 3;
  const lunge = d.bite > 0 ? Math.sin((d.bite / 0.2) * Math.PI) * 4 : 0;
  const coat = "#d9a441", coatDark = "#b9842c", belly = "#efd194", mane = "#8b4a1f", maneDark = "#6b3514";
  shadow(ctx, d.x, d.y + 8, 13, 3.5);
  ctx.save();
  ctx.translate(d.x + lunge * Math.sign(d.face || 1), d.y - bob);
  ctx.scale(Math.sign(d.face || 1) * Math.max(0.2, Math.abs(d.face)), 1);
  // tail with a tuft, sweeping behind
  line(ctx, -13, -6, -22 + flick * 0.4, -14 + flick, coatDark, 2.5);
  circle(ctx, -22.5 + flick * 0.4, -15 + flick, 2.6, maneDark);
  if (sit) {                                                                  // sitting tall, haunches down
    ellipse(ctx, -5, -1, 9, 6, coatDark);                                      // haunch
    line(ctx, 3, -2, 3, 7, coat, 3); line(ctx, 7, -2, 7, 7, coat, 3);          // forelegs
    ellipse(ctx, 3, 7, 3, 1.4, coatDark); ellipse(ctx, 7, 7, 3, 1.4, coatDark);
    poly(ctx, [[-13, 2], [10, 2], [10, -14], [-5, -8]], coat);                 // body rising to the shoulders
    ellipse(ctx, 4, -3, 5, 4, belly);
  } else {
    for (const [lx, k] of [[-8, 1], [-4, -1], [6, 1], [10, -1]]) { line(ctx, lx, -1, lx + sw * k, 7, coat, 3); ellipse(ctx, lx + sw * k, 7, 2.6, 1.3, coatDark); }
    ellipse(ctx, 0, -7, 14, 7, coat);                                          // body
    ellipse(ctx, 1, -3, 8, 2.8, belly);
  }
  // the mane: a big ragged ring of russet around the head, lighter tips on top
  const hx = sit ? 11 : 13, hy = sit ? -17 : (d.target ? -8 : -11);
  for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 1.9, r = 9 + (i % 2) * 2; circle(ctx, hx - 3 + Math.cos(a) * r * 0.8, hy + Math.sin(a) * r, 4.2, i % 3 === 0 ? maneDark : mane); }
  circle(ctx, hx - 3, hy, 8.5, mane);
  // the face
  circle(ctx, hx, hy, 6, coat);
  ellipse(ctx, hx + 3.5, hy + 1.5, 3.4, 2.4, belly);                           // muzzle
  circle(ctx, hx + 6, hy + 0.5, 1.4, "#3e2723");                               // nose
  circle(ctx, hx + 1.5, hy - 2, 1.1, "#3e2723");                               // eye
  for (const ex of [-2, 2]) circle(ctx, hx + ex, hy - 6.5, 2.2, coat, coatDark, 0.6);   // round ears
  if (d.bite > 0) poly(ctx, [[hx + 4, hy + 3], [hx + 8, hy + 2.5], [hx + 5, hy + 5]], "#fff");   // teeth
  ctx.restore();
  const w = 20, x = d.x - w / 2, y = d.y - 30;
  rect(ctx, x, y, w, 3, "#222");
  rect(ctx, x, y, w * (d.hp / d.maxHp), 3, "#ffe082");
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
    const fx = lx + sw * k;
    line(ctx, lx, 0, fx, 9, "#4e342e", 5);
    ellipse(ctx, fx + 1, 10.5, 3.6, 1.8, "#4e342e");                                                   // paw
    for (const c of [-1.6, 0, 1.6]) line(ctx, fx + 2.5 + c * 0.8, 10 + Math.abs(c) * 0.3, fx + 5 + c, 11 + Math.abs(c) * 0.4, "#eceff1", 1);   // claws pointing forward
  }
  // Body: a big shaggy mound, lighter muzzle and belly
  const fur = ctx.createRadialGradient(-2, -10, 2, 0, -4, 20);
  fur.addColorStop(0, "#8d6e63"); fur.addColorStop(1, "#4e342e");
  const by = -5 + (idle ? Math.sin(T * 1.5) * 0.4 : 0);
  ellipse(ctx, 0, by, 17, 10, fur, "rgba(62,39,35,0.45)", 0.8);                                     // a smooth, rounded back
  ellipse(ctx, 2, 0, 9, 4, "#a1887f");
  circle(ctx, -15, -6, 3, "#5d4037");                                          // stubby tail
  // Head, raised when swiping
  const hy = -12 - swipe * 6, hx = 14 - swipe * 3;
  circle(ctx, hx, hy, 7.5, "#6d4c41", "rgba(62,39,35,0.45)", 0.8);
  for (const ex of [-4, 4]) { circle(ctx, hx + ex, hy - 6.5, 2.6, "#5d4037", "rgba(62,39,35,0.45)", 0.7); circle(ctx, hx + ex, hy - 6.5, 1.3, "#a1887f"); }   // round ears
  ellipse(ctx, hx + 6, hy + 1.5, 4.5, 3.2, "#a1887f");                          // muzzle
  circle(ctx, hx + 9.5, hy + 0.5, 1.6, "#212121");                               // nose
  circle(ctx, hx + 3, hy - 1.5, 1.2, "#212121");                                 // eye
  if (d.bite > 0) {                                                             // roaring, with a raised paw
    line(ctx, hx + 4, hy + 3.5, hx + 9, hy + 4, "#3e2723", 1.4);
    poly(ctx, [[hx + 5, hy + 3.5], [hx + 6, hy + 3.5], [hx + 5.5, hy + 5.5]], "#fff");
    line(ctx, 9, -8, 18 + swipe * 4, -16 - swipe * 6, "#4e342e", 5);
    for (const c of [-2, 0, 2]) line(ctx, 18 + swipe * 4 + c * 0.6, -17 - swipe * 6, 22 + swipe * 4 + c * 1.1, -18 - swipe * 6 + c * 0.6, "#eceff1", 1.2);   // claws out along the swipe
  }
  ctx.restore();
  const w = 26, x = d.x - w / 2, y = d.y - 30;
  rect(ctx, x, y, w, 3, "#222");
  rect(ctx, x, y, w * (d.hp / d.maxHp), 3, "#ffab91");
}

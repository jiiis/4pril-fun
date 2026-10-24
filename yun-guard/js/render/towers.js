import { ctx, rect, circle, ellipse, poly, line, shadow } from "./gfx.js";
import { TOWERS } from "../config.js";
import { state } from "../state.js";
import { addLight } from "./lights.js";
import { archerHeight, mageHeight, teslaHeight, ballistaHeight, archerSlots, visLevel, abilityDef } from "../towers.js";

// Each tower is drawn with simple shapes and looks different at every level.
// (x, y) is the centre of its build spot, t.angle points at the last target,
// t.anim counts down after a shot, t.lastShot is when the crew last fired.
export function drawTower(t) {
  const { x, y } = t;
  const lv = visLevel(t);                                      // level 4 reuses the level-3 artwork plus ability ornaments
  // Long soft shadow cast to the lower-right, taller towers cast longer ones
  const tall = t.def === TOWERS.archer ? archerHeight(lv) : t.def === TOWERS.mage ? mageHeight(lv) : t.def === TOWERS.tesla ? teslaHeight(lv) : t.def === TOWERS.ballista ? ballistaHeight(lv) + 8 : 30;
  ctx.save();
  ctx.translate(x + 10, y + 10);
  ctx.transform(1, 0, -0.6, 0.35, 0, 0);
  const sg = ctx.createRadialGradient(0, -tall * 0.4, 2, 0, -tall * 0.4, tall * 1.1);
  sg.addColorStop(0, "rgba(10,30,5,0.3)"); sg.addColorStop(1, "rgba(10,30,5,0)");
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, -tall * 0.4, 20, tall * 1.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  shadow(ctx, x, y + 10, 22, 8, 40);
  if (t.def === TOWERS.archer) drawArcher(t, x, y, lv);
  else if (t.def === TOWERS.mage) drawMage(t, x, y, lv);
  else if (t.def === TOWERS.barracks) drawBarracks(t, x, y, lv);
  else if (t.def === TOWERS.tesla) drawTesla(t, x, y, lv);
  else if (t.def === TOWERS.ballista) drawBallista(t, x, y, lv);
  else drawCannon(t, x, y, lv);
  if (t.ability) drawAbility(t, x, y);
}

// Level-4 ornaments: each ability dresses the tower differently so you can tell them apart at a glance
function drawAbility(t, x, y) {
  const T = state.time + x * 0.013;
  const topY = t.def === TOWERS.archer ? y - archerHeight(3) - 30 : t.def === TOWERS.mage ? y - mageHeight(3) - 44 : t.def === TOWERS.tesla ? y - teslaHeight(3) - 26 : t.def === TOWERS.ballista ? y - ballistaHeight(3) - 14 : y - 30;
  switch (t.ability) {
    case "volley":                                                                       // golden quivers bristling with arrows on the parapet
      for (const qx of [-16, 16]) { rect(ctx, x + qx - 3, y - archerHeight(3) - 6, 6, 10, "#8d6e63", "#4e342e", 1); for (let i = 0; i < 3; i++) { line(ctx, x + qx - 2 + i * 2, y - archerHeight(3) - 6, x + qx - 3 + i * 2.5, y - archerHeight(3) - 14, "#d7ccc8", 1); poly(ctx, [[x + qx - 3 + i * 2.5, y - archerHeight(3) - 14], [x + qx - 4.5 + i * 2.5, y - archerHeight(3) - 11], [x + qx - 1.5 + i * 2.5, y - archerHeight(3) - 11]], "#ffd54f"); } }
      flag(x - 20, y - archerHeight(3) - 26, 12, "#ffd54f", 3);
      break;
    case "poison":                                                                       // green vats bubbling at the foot, a sickly haze above
      for (const vx of [-14, 14]) { rect(ctx, x + vx - 4, y - 2, 8, 8, "#4e342e", "#3e2723", 1); ellipse(ctx, x + vx, y - 2, 4, 1.6, "#7cb342"); for (let i = 0; i < 2; i++) { const k = (((T * 0.7 + i / 2 + vx * 0.37) % 1) + 1) % 1; ctx.globalAlpha = 0.5 * (1 - k); circle(ctx, x + vx + Math.sin(T * 3 + i) * 2, y - 3 - k * 10, 1 + k * 2, "#aed581"); } }
      ctx.globalAlpha = 0.25 + Math.sin(T * 2) * 0.08; circle(ctx, x, topY + 10, 18, "#9ccc65"); ctx.globalAlpha = 1;
      for (const vx of [-14, 14]) addLight(ctx, x + vx, y - 3, 8, "green");                 // the vats glow faintly
      break;
    case "storm":                                                                        // a dark storm cloud circling the spire, flickering
      for (let i = 0; i < 4; i++) { const a = T * 1.2 + i * 1.57; ctx.globalAlpha = 0.65; circle(ctx, x + Math.cos(a) * 16, topY + Math.sin(a) * 5, 6 + (i % 2) * 2, "#4a3f7a"); }
      ctx.globalAlpha = 1;
      if (Math.sin(T * 9) > 0.92) { const lx = x + Math.sin(T * 7) * 10; line(ctx, lx, topY + 4, lx + 3, topY + 12, "#e1bee7", 1.5); line(ctx, lx + 3, topY + 12, lx - 1, topY + 20, "#e1bee7", 1.5); }
      break;
    case "curse":                                                                        // skull totems on the walls with a violet glow
      for (const sx of [-14, 14]) { line(ctx, x + sx, y + 2, x + sx, y - 12, "#3e2723", 2); circle(ctx, x + sx, y - 15, 3.5, "#eeeeee", "#9e9e9e", 0.8); circle(ctx, x + sx - 1.2, y - 15.5, 0.9, `rgba(156,39,176,${0.6 + Math.sin(T * 4) * 0.4})`); circle(ctx, x + sx + 1.2, y - 15.5, 0.9, `rgba(156,39,176,${0.6 + Math.sin(T * 4) * 0.4})`); }
      ctx.globalAlpha = 0.18 + Math.sin(T * 2.5) * 0.06; circle(ctx, x, y - 20, 26, "#7b1fa2"); ctx.globalAlpha = 1;
      for (const sx of [-14, 14]) addLight(ctx, x + sx, y - 15.5, 9, "magic");
      break;
    case "cluster":                                                                      // racks of extra shells beside the gun
      for (const sx of [-15, 15]) { rect(ctx, x + sx - 5, y + 2, 10, 5, "#5d4037", "#3e2723", 1); for (let i = 0; i < 3; i++) circle(ctx, x + sx - 3 + i * 3, y + 1, 1.7, "#263238", "#000", 0.5); }
      break;
    case "napalm":                                                                       // braziers burning on the corners
      for (const bx of [-16, 16]) { rect(ctx, x + bx - 3, y - 4, 6, 5, "#424242", "#212121", 1); fire(x + bx, y - 4, 4, bx); }
      break;
    case "paladin":                                                                      // a tall white-and-gold banner and a soft holy light
      ctx.globalAlpha = 0.16 + Math.sin(T * 1.5) * 0.05; circle(ctx, x, y - 14, 30, "#fff8e1"); ctx.globalAlpha = 1;
      addLight(ctx, x, y - 14, 30, "gold");
      line(ctx, x + 16, y + 4, x + 16, y - 36, "#ffd54f", 2);
      poly(ctx, [[x + 17, y - 36], [x + 28, y - 33 + Math.sin(T * 5) * 2], [x + 17, y - 22]], "#ffffff", "#ffd54f", 1);
      line(ctx, x + 21, y - 33, x + 21, y - 26, "#ffd54f", 1.2); line(ctx, x + 19, y - 30.5, x + 23, y - 30.5, "#ffd54f", 1.2);
      break;
    case "berserk":                                                                      // red war banners and spiked palisade
      for (const bx of [-18, 18]) flag(x + bx, y - 30, 14, "#c62828", bx);
      for (let i = -12; i <= 12; i += 6) poly(ctx, [[x + i - 2, y + 6], [x + i + 2, y + 6], [x + i, y - 4]], "#5d4037", "#3e2723", 1);
      break;
    case "executioner":                                                                  // skulls and a black banner hung on the platform
      for (const [sx, sy] of [[-17, -6], [-10, 1], [17, -4]]) { circle(ctx, x + sx, y + sy, 3.4, "#eeeeee", "#9e9e9e", 0.8); circle(ctx, x + sx - 1.1, y + sy - 0.4, 0.8, "#212121"); circle(ctx, x + sx + 1.1, y + sy - 0.4, 0.8, "#212121"); }
      flag(x + 19, y - ballistaHeight(3) - 22, 22, "#212121", 4);
      circle(ctx, x + 23, y - ballistaHeight(3) - 14, 1.6, "#e53935");
      break;
    case "harpoon":                                                                      // coiled rope, a rack of barbed harpoons and an iron anchor
      for (let i = 0; i < 3; i++) { line(ctx, x - 20 + i * 3, y - 6, x - 17 + i * 3, y - 26, "#8d6e63", 1.6); poly(ctx, [[x - 17 + i * 3, y - 26], [x - 20 + i * 3, y - 21], [x - 14 + i * 3, y - 21]], "#90a4ae", "#37474f", 0.6); }
      ellipse(ctx, x + 18, y + 4, 7, 3.5, null, "#c2a77a", 2); ellipse(ctx, x + 18, y + 2, 7, 3.5, null, "#c2a77a", 2);
      break;
    case "overcharge":                                                                   // a second ring of golden arcs around the orb
      for (let i = 0; i < 5; i++) { const a = T * 7 + i * 1.26, r = 16 + Math.sin(T * 11 + i) * 2; line(ctx, x + Math.cos(a) * r, topY + Math.sin(a) * r * 0.6, x + Math.cos(a + 0.6) * r, topY + Math.sin(a + 0.6) * r * 0.6, "#ffeb3b", 1.4); }
      break;
    case "field": {                                                                      // a crackling ring on the ground marking the field
      ctx.globalAlpha = 0.35; circle(ctx, x, y + 6, 24, null, "#4fc3f7", 1.5); ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) { const a = T * 3 + i * 1.05; const px = x + Math.cos(a) * 24, py = y + 6 + Math.sin(a) * 24 * 0.4; line(ctx, px, py, px + Math.sin(T * 20 + i) * 3, py - 4 - Math.cos(T * 17 + i) * 2, "#e1f5fe", 1.2); }
      break;
    }
  }
}

// Monsters to the left of the tower? Then the crew turns to face left.
const facing = (t) => (Math.cos(t.angle) >= 0 ? 1 : -1);
// Has the crew been idle for a while? Then they relax.
const relaxed = (t) => state.time - (t.lastShot ?? -99) > 2.5;

function bricks(x, y, w, h, rows, color) {
  for (let i = 1; i < rows; i++) line(ctx, x, y + (h * i) / rows, x + w, y + (h * i) / rows, color, 1);
  for (let i = 1; i < rows; i++) line(ctx, x + w * (i % 2 ? 0.33 : 0.66), y + (h * (i - 1)) / rows, x + w * (i % 2 ? 0.33 : 0.66), y + (h * i) / rows, color, 1);
}

// A pennant on a pole that ripples in the wind (shared with the castle banner and signpost flag)
export function flag(px, py, len, color, seed = 0) {
  const T = state.time * 5 + seed;
  rect(ctx, px - 1, py, 2, len, "#3e2723");
  const w1 = Math.sin(T) * 2, w2 = Math.sin(T + 1.2) * 3;
  poly(ctx, [[px + 1, py], [px + 7, py + 2 + w1], [px + 13, py + 4 + w2], [px + 7, py + 6 + w1], [px + 1, py + 8]], color, "rgba(0,0,0,0.25)", 0.8);
}

// A little flame and a wisp of smoke
function fire(px, py, size, seed = 0) {
  const T = state.time * 11 + seed;
  const fl = Math.sin(T) * size * 0.25, fl2 = Math.sin(T * 1.7 + 1) * size * 0.2;
  poly(ctx, [[px - size * 0.5, py], [px + size * 0.5, py], [px + fl, py - size * 1.4 - fl2]], "#ff9800");
  poly(ctx, [[px - size * 0.25, py], [px + size * 0.25, py], [px + fl * 0.6, py - size * 0.9 - fl2]], "#ffeb3b");
  addLight(ctx, px, py - size * 0.7, size * 6.5, "flame");
  const k = (((state.time * 0.6 + seed) % 1) + 1) % 1;
  ctx.globalAlpha = 0.25 * (1 - k);
  circle(ctx, px + Math.sin(state.time * 2 + seed) * 2, py - size * 1.6 - k * 14, 2 + k * 3, "#9e9e9e");
  ctx.globalAlpha = 1;
}

// Chimney smoke puffs
function smokeColumn(px, py, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const k = (state.time * 0.35 + seed + i / 3) % 1;
    ctx.globalAlpha = 0.28 * (1 - k);
    circle(ctx, px + Math.sin(state.time + i * 2) * 2 + k * 4, py - k * 22, 2.5 + k * 4, "#cfd8dc");
  }
  ctx.globalAlpha = 1;
}

// =====================================================================
//  ARCHER TOWER
// =====================================================================
function drawArcher(t, x, y, lv) {
  const h = archerHeight(lv);
  if (lv === 1) {
    rect(ctx, x - 14, y - 6, 28, 14, "#8d6e63", "#4e342e");
    for (const xx of [-8, 0, 8]) line(ctx, x + xx, y - 6, x + xx, y + 8, "#6d4c41", 1);
  } else {
    rect(ctx, x - 17, y - 14, 34, 24, lv === 3 ? "#8d8d8d" : "#9e9e9e", "#4e4e4e");
    bricks(x - 17, y - 14, 34, 24, 3, "#7a7a7a");
    if (lv === 3) rect(ctx, x - 17, y - 4, 34, 3, "#455a64");
  }
  if (lv === 1) {
    for (const xx of [-10, 10]) line(ctx, x + xx, y - h, x + xx, y - 6, "#a1703f", 4);
    line(ctx, x - 10, y - h, x + 10, y - 6, "#7a4e25", 2);
    line(ctx, x + 10, y - h, x - 10, y - 6, "#7a4e25", 2);
    for (let i = 0; i < 4; i++) line(ctx, x - 2, y - 10 - i * (h - 12) / 4, x + 2, y - 10 - i * (h - 12) / 4, "#7a4e25", 1.5);
    line(ctx, x - 2, y - h, x - 2, y - 6, "#7a4e25", 1); line(ctx, x + 2, y - h, x + 2, y - 6, "#7a4e25", 1);
  } else {
    rect(ctx, x - 12, y - h, 24, h - 14, "#a1703f", "#5d4037");
    line(ctx, x - 12, y - h, x + 12, y - 14, "#7a4e25", 2);
    line(ctx, x + 12, y - h, x - 12, y - 14, "#7a4e25", 2);
    if (lv === 3) {
      rect(ctx, x - 12, y - h / 2 - 2, 24, h / 2 - 12, "#9e9e9e", "#5d4037");
      bricks(x - 12, y - h / 2 - 2, 24, h / 2 - 12, 2, "#7a7a7a");
      rect(ctx, x - 3, y - h + 8, 6, 9, "#3e2723"); line(ctx, x, y - h + 8, x, y - h + 17, "#8d6e63", 1);
    } else {
      rect(ctx, x - 2, y - h / 2 - 6, 4, 10, "#3e2723");
    }
  }
  rect(ctx, x - 21, y - h - 6, 42, 6, "#6d4c41", "#3e2723");
  if (lv >= 2) {
    line(ctx, x - 20, y - h - 18, x + 20, y - h - 18, "#5d4037", 2);
    for (const px of [-20, -10, 0, 10, 20]) line(ctx, x + px, y - h - 18, x + px, y - h - 6, "#5d4037", 2);
  }
  if (lv === 3) {
    for (const px of [-19, 19]) line(ctx, x + px, y - h - 6, x + px, y - h - 44, "#5d4037", 3);
    poly(ctx, [[x - 25, y - h - 42], [x, y - h - 58], [x + 25, y - h - 42]], "#c62828", "#7f0000");   // a steady canopy
    for (let i = 1; i < 4; i++) line(ctx, x - 25 + i * 6, y - h - 42 - i * 4, x + 25 - i * 6, y - h - 42 - i * 4, "rgba(0,0,0,0.15)", 1);
    rect(ctx, x - 5, y - h - 13, 10, 7, "#5d4037", "#3e2723", 1);
    rect(ctx, x + 13, y - h - 14, 8, 6, "#424242", "#212121", 1);           // brazier
    line(ctx, x + 17, y - h - 8, x + 17, y - h - 6, "#424242", 2);
    fire(x + 17, y - h - 14, 5, x);
  }
  if (lv === 2) flag(x, y - h - 40, 22, "#ffd54f", x);
  const dir = facing(t), idle = relaxed(t);
  const looks = [["#5d4037", "#2e7d32"], ["#f9a825", "#c62828"], ["#3e2723", "#1565c0"]];
  archerSlots(lv).forEach((s, i) => drawArcherGirl(x + s.dx, y - h - 6 + s.dy, dir, t.shooter === i ? t.anim : 0, looks[i][0], looks[i][1], t.angle, lv === 3, idle, i * 2.1 + x * 0.01));
}

// A small archer girl standing with her feet at (px, py). anim > 0 = just fired.
// When idle she shifts her weight, glances around and lets her bow hang loose.
function drawArcherGirl(px, py, dir, anim, hair, dress, angle, fire = false, idle = false, seed = 0) {
  const T = state.time + seed;
  const bob = idle ? Math.sin(T * 2) * 0.6 : 0;
  const glance = idle ? Math.sin(T * 0.9) * 0.8 : 0;
  const hairSway = Math.sin(T * 2.6) * 0.6;
  ctx.save();
  ctx.translate(px, py - bob);
  ctx.scale(dir, 1);
  line(ctx, -2, 0, -2, -5 + bob, "#5d4037", 2);
  line(ctx, 2, 0, 2, -5 + bob, "#5d4037", 2);
  poly(ctx, [[-4.5, -5], [4.5, -5], [3, -12], [-3, -12]], dress, "#1b1b1b", 1);
  rect(ctx, -3, -15, 6, 3.5, dress);
  rect(ctx, -3.5, -12, 7, 1.5, "#4e342e");
  rect(ctx, -5.5, -16, 2.5, 7, "#6d4c41");
  line(ctx, -4.5, -16, -4.5, -19, "#eeeeee", 1);
  circle(ctx, -0.5, -19, 4.4, hair);
  ellipse(ctx, -5 + hairSway, -16.5, 2, 3.5, hair);
  circle(ctx, 0, -18.5, 3.8, "#ffcc80");
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -18.5, 3.9, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  circle(ctx, 1.6 + glance, -18.5, 0.7, "#212121");
  // Bow arm: aimed at the target, or hanging loose and swaying when nothing is about
  let a;
  if (idle && anim <= 0) a = 0.75 + Math.sin(T * 1.3) * 0.08;
  else { a = dir === 1 ? angle : Math.PI - angle; a = Math.max(-0.8, Math.min(0.8, Math.atan2(Math.sin(a), Math.cos(a)))); }
  ctx.save();
  ctx.translate(0, -13);
  ctx.rotate(a);
  const drawn = anim > 0.25;
  line(ctx, 0, 0, 7, 0, "#ffcc80", 2);
  ctx.strokeStyle = "#6d4c41"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(7, 0, 7, -1.25, 1.25); ctx.stroke();
  const ex = 7 + 7 * Math.cos(1.25), ey = 7 * Math.sin(1.25);
  ctx.strokeStyle = "#eeeeee"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(ex, -ey);
  if (drawn) ctx.lineTo(1, 0); ctx.lineTo(ex, ey); ctx.stroke();
  if (drawn) {
    line(ctx, 1, 0, 15, 0, "#cfd8dc", 1.2);
    if (fire) { circle(ctx, 16, 0, 3, "rgba(255,152,0,0.8)"); circle(ctx, 16, -0.5, 1.5, "#ffeb3b"); addLight(ctx, 16, 0, 9, "flame"); }
  }
  ctx.restore();
  ctx.restore();
}

// =====================================================================
//  MAGE TOWER
// =====================================================================
function drawMage(t, x, y, lv) {
  const h = mageHeight(lv);
  const body = ["#a1887f", "#9c8fc4", "#5e4b9e"][lv - 1];
  const trim = ["#5d4037", "#3f2b7a", "#ffd54f"][lv - 1];
  const mortar = ["#8d6e63", "#7e6fae", "#4a3a85"][lv - 1];
  rect(ctx, x - 13, y - h, 26, h + 8, body, trim);
  bricks(x - 13, y - h, 26, h + 8, 5, mortar);
  for (let i = 0; i < lv; i++) {                                              // windows glow and flicker
    const wy = y - h * (0.25 + i * 0.3);
    ctx.fillStyle = "#2a1a5e";
    ctx.beginPath(); ctx.arc(x, wy, 3.5, Math.PI, 0); ctx.lineTo(x + 3.5, wy + 6); ctx.lineTo(x - 3.5, wy + 6); ctx.closePath(); ctx.fill();
    const glow = 0.6 + Math.sin(state.time * 4 + i * 2 + x) * 0.3;
    circle(ctx, x, wy + 1, 1.5 + glow * 0.6, lv === 1 ? `rgba(255,213,79,${glow})` : `rgba(186,104,200,${glow})`);
    addLight(ctx, x, wy + 1, 11, lv === 1 ? "lantern" : "magic");
  }
  if (lv === 1) {
    rect(ctx, x - 16, y - h - 4, 32, 5, "#6d4c41", "#3e2723");
    line(ctx, x - 15, y - h - 12, x + 15, y - h - 12, "#5d4037", 1.5);
    for (const px of [-15, -5, 5, 15]) line(ctx, x + px, y - h - 12, x + px, y - h - 4, "#5d4037", 1.5);
  } else {
    poly(ctx, [[x - 9, y - h - 2], [x, y - h - 30], [x + 9, y - h - 2]], lv === 3 ? "#1a237e" : "#283593", "#1a237e");
    if (lv === 3) { line(ctx, x, y - h - 30, x, y - h - 38, "#ffd54f", 2); circle(ctx, x, y - h - 39, 2.5 + Math.sin(state.time * 5) * 0.5, "#ffd54f"); }
    ellipse(ctx, x, y - h, 17, 5, lv === 3 ? "#3f2b7a" : "#6d5aa8", trim, 1.5);
    ctx.strokeStyle = trim; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y - h - 8, 17, 5, 0, Math.PI, 0, true); ctx.stroke();
    for (const px of [-15, -8, 0, 8, 15]) line(ctx, x + px, y - h - 8 - Math.sqrt(1 - (px / 17) ** 2) * 5, x + px, y - h, trim, 1.5);
    for (let i = 0; i < lv; i++) {                                            // runes pulse in turn
      const p = 0.45 + Math.sin(state.time * 3 + i * 1.5) * 0.45;
      circle(ctx, x - 8 + i * 8, y - h + 12, 1.4 + p, `rgba(186,104,200,${0.4 + p * 0.6})`);
    }
  }
  if (lv === 3) {
    for (let i = 0; i < 3; i++) {
      const a = state.time * 1.6 + (i * Math.PI * 2) / 3;
      const cx = x + Math.cos(a) * 24, cy = y - h - 16 + Math.sin(a) * 7;
      ctx.globalAlpha = 0.5; circle(ctx, cx, cy, 6, "rgba(186,104,200,0.6)"); ctx.globalAlpha = 1;
      poly(ctx, [[cx, cy - 5], [cx + 3, cy], [cx, cy + 5], [cx - 3, cy]], "#e1bee7", "#8e24aa", 1);
    }
  }
  drawWizard(x, y - h - 2, facing(t), t.anim, lv, relaxed(t), x * 0.01);
}

// The wizard sways, his robe and beard stir, his staff drifts while he waits
function drawWizard(px, py, dir, anim, lv, idle, seed) {
  const T = state.time + seed;
  const raise = anim > 0 ? Math.sin((anim / 0.4) * Math.PI) * 6 : 0;
  const sway = idle ? Math.sin(T * 1.4) * 1.2 : 0;
  const hem = Math.sin(T * 2.3) * 1;
  const robe = ["#5c6bc0", "#4527a0", "#311b92"][lv - 1];
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(dir, 1);
  poly(ctx, [[-6 - hem, 0], [6 + hem, 0], [3.5 + sway * 0.3, -14], [-3.5 + sway * 0.3, -14]], robe, "#1a1047", 1);
  if (lv === 3) { line(ctx, -5.5, -1, 5.5, -1, "#ffd54f", 1.2); line(ctx, sway * 0.3, -1, sway * 0.3, -13, "#ffd54f", 1); }
  else for (const sy of [-4, -9]) circle(ctx, sway * 0.3, sy, 0.8, "#ffd54f");
  ctx.translate(sway * 0.5, 0);
  circle(ctx, 0, -17, 3.8, "#ffcc80");
  if (lv === 2) ellipse(ctx, 0.5 + hem * 0.3, -14.5, 2.5, 3, "#eeeeee");
  if (lv === 3) poly(ctx, [[-3, -15], [3, -15], [1.5 + hem * 0.6, -6], [-1.5 + hem * 0.6, -6]], "#eeeeee", "#bdbdbd", 0.5);
  if (lv === 1) ellipse(ctx, -2, -19, 4, 2.5, "#6d4c41");
  const tip = Math.sin(T * 1.8) * 1.2;                                            // hat tip nods
  poly(ctx, [[-6, -19.5], [6, -19.5], [1 + tip, -31 - lv]], robe, "#1a1047", 1);
  if (lv >= 2) circle(ctx, -1, -24, 1, "#ffd54f");
  if (lv === 3) { circle(ctx, 2.5, -27, 0.8, "#ffd54f"); circle(ctx, -3, -21, 0.7, "#ffd54f"); }
  circle(ctx, 1.4 + (idle ? Math.sin(T * 0.8) * 0.5 : 0), -17.5, 0.7, "#212121");
  const drift = idle ? Math.sin(T * 1.1) * 1.5 : 0;
  line(ctx, 2, -12, 10 + drift, -14 - raise, "#ffcc80", 2);
  line(ctx, 10 + drift, 0, 10 + drift, -28 - raise, lv === 3 ? "#ffd54f" : "#5d4037", 2.5);
  const oy = -32 - raise + Math.sin(T * 2.5) * 1, r = 5 + lv * 2 + (anim > 0 ? 4 : 0) + Math.sin(T * 3) * 0.6;
  const glow = ctx.createRadialGradient(10 + drift, oy, 1, 10 + drift, oy, r);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.4, lv === 1 ? "rgba(255,213,79,0.85)" : "rgba(186,104,200,0.85)");
  glow.addColorStop(1, "rgba(186,104,200,0)");
  circle(ctx, 10 + drift, oy, r, glow);
  circle(ctx, 10 + drift, oy, 2.8, "#f3e5f5");
  addLight(ctx, 10 + drift, oy, 30 + lv * 6, "magic");
  ctx.restore();
}

// =====================================================================
//  LIGHTNING SPIRE
//  A stone plinth, an iron mast wound with copper coils, and a crackling crystal orb on top.
//  Level 2 adds a second coil and a brass cage; level 3 a tall spire with three floating crystals.
// =====================================================================
function drawTesla(t, x, y, lv) {
  const h = teslaHeight(lv), T = state.time + x * 0.01;
  const charged = t.anim > 0 ? t.anim / 0.4 : 0;
  const hum = 0.5 + Math.sin(T * 6) * 0.2;
  // Plinth
  poly(ctx, [[x - 17, y + 8], [x + 17, y + 8], [x + 12, y - 4], [x - 12, y - 4]], lv === 3 ? "#546e7a" : "#78909c", "#37474f", 1.2);
  line(ctx, x - 14, y + 2, x + 14, y + 2, "#455a64", 1);
  for (const px of [-8, 0, 8]) { circle(ctx, x + px, y + 5, 1.2, `rgba(79,195,247,${hum})`); addLight(ctx, x + px, y + 5, 5, "arc"); }   // glowing studs
  // Mast
  const mast = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
  mast.addColorStop(0, "#90a4ae"); mast.addColorStop(0.5, "#37474f"); mast.addColorStop(1, "#263238");
  rect(ctx, x - 5, y - h, 10, h - 4, mast, "#1b1b1b", 1);
  // Copper coils (one per level), with a bright wire wrap
  for (let i = 0; i < lv; i++) {
    const cy = y - 12 - i * (h - 24) / Math.max(1, lv - 1) * 0.8 - (lv === 1 ? 6 : 0);
    rect(ctx, x - 9, cy - 7, 18, 14, "#b87333", "#5d2e0a", 1);
    for (let k = 0; k < 5; k++) line(ctx, x - 9, cy - 6 + k * 3, x + 9, cy - 5 + k * 3, "#e6a15a", 0.9);
    line(ctx, x - 9, cy - 7, x - 9, cy + 7, "#ffcc80", 0.8);
  }
  if (lv >= 2) {                                                                                  // brass cage around the top
    for (const px of [-13, 13]) { line(ctx, x + px, y - h + 2, x + px * 0.75, y - h - 22, "#c9a227", 1.6); circle(ctx, x + px * 0.75, y - h - 22, 1.6, "#ffe082"); }
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x, y - h + 2, 13, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // The orb
  const oy = y - h - 10, r = 7 + lv + charged * 3;
  const halo = ctx.createRadialGradient(x, oy, 1, x, oy, r * 2.2);
  halo.addColorStop(0, `rgba(129,212,250,${0.5 + charged * 0.4})`); halo.addColorStop(1, "rgba(129,212,250,0)");
  circle(ctx, x, oy, r * 2.2, halo);
  const orb = ctx.createRadialGradient(x - r * 0.3, oy - r * 0.3, 1, x, oy, r);
  orb.addColorStop(0, "#ffffff"); orb.addColorStop(0.4, "#81d4fa"); orb.addColorStop(1, "#0277bd");
  circle(ctx, x, oy, r, orb, "#01579b", 1);
  addLight(ctx, x, oy, 34 + lv * 6 + charged * 16, "arc");
  // Arcs crawling over the orb, wilder right after a shot
  const arcs = 2 + lv + Math.round(charged * 3);
  for (let i = 0; i < arcs; i++) {
    const a0 = T * 5 + i * 2.1, a1 = a0 + 1.2 + Math.sin(T * 9 + i) * 0.5;
    const p0 = { x: x + Math.cos(a0) * r, y: oy + Math.sin(a0) * r }, p1 = { x: x + Math.cos(a1) * r * 1.1, y: oy + Math.sin(a1) * r * 1.1 };
    const mx = (p0.x + p1.x) / 2 + Math.sin(T * 23 + i) * 4, my = (p0.y + p1.y) / 2 + Math.cos(T * 19 + i) * 4;
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(mx, my); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  if (lv === 3) {                                                                                  // three crystals orbit the orb
    for (let i = 0; i < 3; i++) {
      const a = T * 1.8 + (i * Math.PI * 2) / 3, cx = x + Math.cos(a) * 22, cy = oy + 2 + Math.sin(a) * 7;
      ctx.globalAlpha = 0.6; circle(ctx, cx, cy, 5, "rgba(129,212,250,0.5)"); ctx.globalAlpha = 1;
      poly(ctx, [[cx, cy - 6], [cx + 3, cy], [cx, cy + 6], [cx - 3, cy]], "#e1f5fe", "#0288d1", 1);
      line(ctx, cx, cy, x + (cx - x) * 0.3, oy + (cy - oy) * 0.3, `rgba(129,212,250,${0.3 + Math.sin(T * 7 + i) * 0.2})`, 1);
    }
  }
}

// =====================================================================
//  CANNON
// =====================================================================
// A heavy wooden siege crossbow on a swivel: the bow arms are the long way across, the bolt lies on its rail
function drawBallista(t, x, y, lv) {
  const T = state.time + x * 0.01, recoil = t.recoil > 0 ? Math.min(1, t.recoil / 0.32) : 0;
  // The platform: a plank deck on stout legs, bigger and iron-bound with each level
  const deck = lv === 1 ? "#8d6e63" : lv === 2 ? "#795548" : "#6d4c41", edge = "#3e2723";
  rect(ctx, x - 20, y - 6, 40, 14, deck, edge);
  for (const xx of [-13, -4, 5, 14]) line(ctx, x + xx, y - 6, x + xx, y + 8, "rgba(0,0,0,0.25)", 1);
  rect(ctx, x - 20, y - 8, 40, 3.2, lv === 3 ? "#546e7a" : "#a1887f", edge, 0.8);
  if (lv >= 2) for (const xx of [-17, 17]) { rect(ctx, x + xx - 1.8, y - 6, 3.6, 14, "#78909c", "#37474f", 0.8); circle(ctx, x + xx, y - 1, 1, "#cfd8dc"); }
  if (lv === 3) for (const xx of [-8, 8]) circle(ctx, x + xx, y + 3, 1.2, "#cfd8dc");
  // The weapon pivots toward the target: draw it in its own rotated frame, bow arms across the line of fire
  const idle = relaxed(t) ? Math.sin(T * 0.5) * 0.12 : 0, pivotY = y - ballistaHeight(lv) + 8;
  rect(ctx, x - 3, pivotY, 6, y - 8 - pivotY, "#5d4037", edge, 1);                                  // the swivel post
  ctx.save(); ctx.translate(x, pivotY); ctx.rotate(t.angle + idle);
  const len = 22 + lv * 4, arm = 13 + lv * 2.5, pull = recoil * 5;
  rect(ctx, -9, -2.4, len + 6, 4.8, "#a1887f", edge, 1);                                           // the stock and rail
  line(ctx, -9, 0, len - 2, 0, "rgba(255,255,255,0.18)", 1);
  // bow arms sweep back, string is drawn tight when loaded
  const armCol = lv === 1 ? "#6d4c41" : lv === 2 ? "#4e342e" : "#37474f";
  ctx.strokeStyle = armCol; ctx.lineWidth = 3.2 + lv * 0.5; ctx.lineCap = "round";
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(len * 0.55, s * 2); ctx.quadraticCurveTo(len * 0.55 - 3, s * arm * 0.7, len * 0.3 - 3, s * arm); ctx.stroke(); }
  ctx.strokeStyle = "#efebe9"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(len * 0.3 - 3, -arm); ctx.lineTo(len * 0.1 - 3 + pull * 0.2 - (recoil > 0 ? 0 : 6), 0); ctx.lineTo(len * 0.3 - 3, arm); ctx.stroke();
  // the bolt: shaft, iron head and fletching; it leaves on a shot and a new one is slid on
  const boltOff = recoil > 0 ? len : 0;
  if (recoil < 0.85) { line(ctx, -4, 0, len + 8 + boltOff * 0.0, 0, "#d7ccc8", 2.4); poly(ctx, [[len + 8, -3], [len + 15, 0], [len + 8, 3]], "#cfd8dc", "#37474f", 0.8); poly(ctx, [[-4, 0], [-8, -3], [-6, 0], [-8, 3]], lv === 3 ? "#c62828" : "#8d6e63"); }
  rect(ctx, len * 0.45, -3.4, 3, 6.8, "#757575", "#37474f", 0.8);                                   // the iron collar
  circle(ctx, 0, 0, 3.2, "#546e7a", "#263238", 1);
  ctx.restore();
  // A crewman cranks the winch behind it, glancing up now and then
  const dir = facing(t), gx = x - dir * 17, gy = y + 8;
  ctx.save(); ctx.translate(gx, gy); ctx.scale(dir, 1);
  const crank = recoil === 0 && !relaxed(t) ? Math.sin(T * 5) * 1.6 : 0;
  line(ctx, -2, 0, -2, -5, "#37474f", 2); line(ctx, 2, 0, 2, -5, "#37474f", 2);
  rect(ctx, -4, -14, 8, 9, lv === 3 ? "#455a64" : "#8d6e63", "#4e342e", 1);
  circle(ctx, 0, -17.5, 3.6, "#ffcc80");
  ctx.fillStyle = lv === 3 ? "#cfd8dc" : "#6d4c41"; ctx.beginPath(); ctx.arc(0, -18.5, 4, Math.PI, 0); ctx.fill();
  line(ctx, 3, -10, 8, -9 + crank, "#ffcc80", 2.2);
  ctx.restore();
  if (lv === 3) flag(x + 20, y - ballistaHeight(3) - 18, 26, "#c62828", x);
}

function drawCannon(t, x, y, lv) {
  const recoil = t.recoil > 0 ? (t.recoil / 0.2) * 6 : 0;
  if (lv === 1) {
    rect(ctx, x - 16, y - 12, 32, 22, "#8d6e63", "#4e342e");
    for (const xx of [-12, -6, 0, 6, 12]) line(ctx, x + xx, y - 12, x + xx, y + 10, "#6d4c41", 1.2);
    for (const xx of [-12, -6, 0, 6, 12]) poly(ctx, [[x + xx - 3, y - 12], [x + xx, y - 16], [x + xx + 3, y - 12]], "#8d6e63", "#4e342e", 1);
  } else {
    const wall = lv === 3 ? "#546e7a" : "#8d8d8d", edge = lv === 3 ? "#263238" : "#424242";
    rect(ctx, x - 18, y - 16, 36, 26, wall, edge);
    for (let i = -18; i < 18; i += 9) rect(ctx, x + i, y - 22, 5, 7, wall, edge);
    if (lv === 3) for (const [rx, ry] of [[-15, -13], [15, -13], [-15, 6], [15, 6]]) circle(ctx, x + rx, y + ry, 1.3, "#b0bec5");
    else bricks(x - 18, y - 16, 36, 26, 2, "#616161");
  }
  if (lv >= 2) for (const wx of [x - 7, x + 7]) { circle(ctx, wx, y - 8, 4.5, "#5d4037", "#3e2723", 1.5); circle(ctx, wx, y - 8, 1.2, "#3e2723"); }
  const len = [15, 21, 23][lv - 1];
  const offsets = lv === 3 ? [-4.5, 4.5] : [0];
  const idleAngle = relaxed(t) ? Math.sin(state.time * 0.5 + x) * 0.15 : 0;    // barrel drifts a little while waiting
  for (const off of offsets) {
    ctx.save();
    ctx.translate(x, y - 14);
    ctx.rotate(t.angle + idleAngle);
    ctx.translate(0, off);
    rect(ctx, -recoil, -4.5, len, 9, "#212121", "#000");
    rect(ctx, -recoil + 3, -5.5, 3, 11, lv === 3 ? "#ffd54f" : "#424242", "#000", 1);
    rect(ctx, len - 4 - recoil, -5.5, 5, 11, lv === 3 ? "#ffd54f" : "#424242", "#000");
    ctx.restore();
  }
  circle(ctx, x, y - 14, lv === 3 ? 9 : 7, "#424242", "#000", 2);
  if (lv >= 2) for (const [dx, dy] of [[-22, 8], [-16, 8], [-19, 3]]) circle(ctx, x + dx, y + dy, 3, "#212121");
  if (lv === 3) flag(x + 20, y - 44, 26, "#c62828", x);
  // Gunner with a torch: shifts his weight, wipes his brow now and then, torch always flickering
  const T = state.time + x * 0.01;
  const dir = facing(t), gx = x - dir * 24, torchUp = t.recoil > 0 ? 6 : 0;
  const bob = Math.sin(T * 2.1) * 0.6, wipe = Math.sin(T * 0.6) > 0.93;
  ctx.save();
  ctx.translate(gx, y + 8 - bob);
  ctx.scale(dir, 1);
  line(ctx, -2, 0, -2, -5 + bob, "#37474f", 2); line(ctx, 2, 0, 2, -5 + bob, "#37474f", 2);
  rect(ctx, -4, -14, 8, 9, lv === 3 ? "#37474f" : "#8d6e63", "#4e342e", 1);
  circle(ctx, 0, -17.5, 3.6, "#ffcc80");
  ctx.fillStyle = lv === 3 ? "#ffd54f" : "#616161"; ctx.beginPath(); ctx.arc(0, -18.5, 4, Math.PI, 0); ctx.fill();
  circle(ctx, 1.4 + Math.sin(T * 0.9) * 0.5, -17.5, 0.7, "#212121");
  if (wipe) line(ctx, -3, -11, -2, -19, "#ffcc80", 2);                        // back arm wipes the brow
  else line(ctx, -3, -11, -6, -6, "#ffcc80", 2);
  line(ctx, 3, -11, 10, -16 - torchUp, "#ffcc80", 2);
  line(ctx, 10, -12 - torchUp, 10, -22 - torchUp, "#5d4037", 2);
  fire(10, -22 - torchUp, 3, x);
  ctx.restore();
}

// =====================================================================
//  BARRACKS
// =====================================================================
function drawBarracks(t, x, y, lv) {
  if (lv === 1) {
    rect(ctx, x - 18, y - 14, 36, 24, "#8d6e63", "#4e342e");
    for (const xx of [-12, -6, 0, 6, 12]) line(ctx, x + xx, y - 14, x + xx, y + 10, "#6d4c41", 1.2);
    poly(ctx, [[x - 22, y - 14], [x, y - 30], [x + 22, y - 14]], "#c9a95c", "#8d6e63");
    for (let i = 1; i < 5; i++) line(ctx, x - 22 + i * 4.4, y - 14 - i * 3.2, x + 22 - i * 4.4, y - 14 - i * 3.2, "rgba(0,0,0,0.12)", 1);
    ctx.fillStyle = "#4e342e";
    ctx.beginPath(); ctx.arc(x, y, 5, Math.PI, 0); ctx.lineTo(x + 5, y + 10); ctx.lineTo(x - 5, y + 10); ctx.closePath(); ctx.fill();
    for (const px of [-24, 24]) { rect(ctx, x + px - 2, y - 6, 4, 16, "#8d6e63", "#4e342e", 1); poly(ctx, [[x + px - 2, y - 6], [x + px, y - 10], [x + px + 2, y - 6]], "#8d6e63"); }
    smokeColumn(x + 10, y - 26, x * 0.01);                                     // cooking fire smoke through the thatch
    addLight(ctx, x, y + 4, 14, "lantern");                                     // and firelight through the door
    return;
  }
  if (lv === 3) {
    for (const px of [-22, 22]) {
      rect(ctx, x + px - 5, y - 30, 10, 40, "#9e9e9e", "#4e4e4e");
      for (let i = -5; i < 5; i += 4) rect(ctx, x + px + i, y - 35, 3, 6, "#9e9e9e", "#4e4e4e", 1);
      rect(ctx, x + px - 1.5, y - 22, 3, 6, "#263238");
    }
  }
  rect(ctx, x - 18, y - 18, 36, 28, lv === 3 ? "#bdbdbd" : "#bcaaa4", "#5d4037");
  bricks(x - 18, y - 18, 36, 28, 3, lv === 3 ? "#9e9e9e" : "#a1887f");
  ctx.fillStyle = "#4e342e";
  ctx.beginPath(); ctx.arc(x, y, 6, Math.PI, 0); ctx.lineTo(x + 6, y + 10); ctx.lineTo(x - 6, y + 10); ctx.closePath(); ctx.fill();
  circle(ctx, x + 3, y + 4, 0.8, "#ffd54f");
  poly(ctx, [[x - 22, y - 18], [x, y - 34], [x + 22, y - 18]], lv === 3 ? "#ffb300" : "#b71c1c", "#3e2723");
  for (let i = 1; i < 4; i++) line(ctx, x - 22 + i * 5.5, y - 18 - i * 4, x + 22 - i * 5.5, y - 18 - i * 4, "rgba(0,0,0,0.15)", 1);
  rect(ctx, x - 12, y - 32, 5, 8, "#6d6d6d", "#424242", 1);                    // chimney
  smokeColumn(x - 9.5, y - 33, x * 0.01);
  circle(ctx, x, y - 20, 5, "#1565c0", "#ffd54f");
  if (lv === 2) {
    flag(x + 15, y - 48, 16, "#1565c0", x);
    const wob = Math.sin(state.time * 1.7 + x) * 0.08;                        // training dummy wobbles
    ctx.save(); ctx.translate(x - 26, y + 10); ctx.rotate(wob);
    line(ctx, 0, 0, 0, -16, "#6d4c41", 2); line(ctx, -5, -12, 5, -12, "#6d4c41", 2);
    circle(ctx, 0, -18, 3, "#c9a95c", "#8d6e63", 1);
    ctx.restore();
  }
  if (lv === 3) for (const px of [-22, 22]) flag(x + px, y - 50, 16, "#ffd54f", x + px);
}

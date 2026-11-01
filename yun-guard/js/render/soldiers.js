import { ctx, rect, circle, ellipse, poly, line, shadow, bodyShadow } from "./gfx.js";
import { state } from "../state.js";

// Soldiers look tougher as their barracks levels up:
// level 1 militia in leather, level 2 men-at-arms in steel, level 3 royal guard in gold.
const GEAR = {
  1: { tunic: "#8d6e63", trim: "#4e342e", helmet: "#795548", edge: "#775d54", helmetEdge: "#654c3d", shield: "#6d4c41", shieldTrim: "#a1887f", sword: "#b0bec5" },
  2: { tunic: "#1565c0", trim: "#0d47a1", helmet: "#9e9e9e", edge: "#205994", helmetEdge: "#858e8c", shield: "#c62828", shieldTrim: "#ffd54f", sword: "#eceff1" },
  3: { tunic: "#cfd8dc", trim: "#546e7a", helmet: "#ffd54f", edge: "#aab8bb", helmetEdge: "#c3a650", shield: "#1565c0", shieldTrim: "#ffd54f", sword: "#ffffff" },
};

const SOLDIER_ART_SCALE = 0.7;
const OUTLINE_WIDTH = 0.55, DETAIL_OUTLINE_WIDTH = 0.45;

function outlinedLimb(x1, y1, x2, y2, color, width, edge) {
  line(ctx, x1, y1, x2, y2, edge, width + OUTLINE_WIDTH * 2);
  line(ctx, x1, y1, x2, y2, color, width);
}


export function drawSoldier(s) {
  if (s.hp <= 0) return;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(SOLDIER_ART_SCALE, SOLDIER_ART_SCALE);
  ctx.translate(-s.x, -s.y);
  if (s.specialization) drawSummon(s);
  else drawGuard(s);
  ctx.restore();
  if (s.specialization === "brood" && !s.hatchling && s.target?.def.flying && s.swing > 0) {
    const progress = 1 - Math.min(1, s.swing / 0.2);
    const startX = s.x + 10 * s.dir * SOLDIER_ART_SCALE;
    const startY = s.y - 2 * SOLDIER_ART_SCALE;
    const dx = s.target.x - startX, dy = s.target.y - 18 - startY;
    const length = Math.hypot(dx, dy) || 1;
    const x = startX + dx * progress, y = startY + dy * progress;
    line(ctx, x, y, x - dx / length * 4, y - dy / length * 4, "#d7d39b", 1.4);
  }
}

function drawGuard(s) {
  const g = GEAR[s.level || 1];
  const T = state.time, idle = !s.moving && !s.target;
  const sw = s.moving ? Math.sin(s.phase) * 3 : 0;
  // Idle life: shifting weight, looking left and right, the odd practice swing
  const bob = idle ? Math.sin(T * 2.4 + s.phase) * 0.7 : 0;
  // Practice swings: a short swing roughly every 2 to 3 seconds, each soldier on his own rhythm
  const practice = idle && Math.sin(T * 2.6 + s.phase * 3) > 0.72;
  const dir = idle ? (Math.sin(T * 0.3 + s.phase) > 0 ? 1 : -1) : s.dir;
  const swinging = s.swing > 0 || practice;
  shadow(ctx, s.x, s.y + 13, 7, 3, 16);

  ctx.save();
  ctx.translate(s.x, s.y - bob);
  ctx.scale(dir, 1);
  outlinedLimb(-3, 6, -3 + sw, 13 + bob, "#37474f", 3, "#303d44");                // legs
  outlinedLimb(3, 6, 3 - sw, 13 + bob, "#37474f", 3, "#303d44");
  rect(ctx, -5, -4, 10, 11, g.tunic, g.edge, OUTLINE_WIDTH);                       // tunic / armour
  if (s.level === 3) { line(ctx, -5, 0, 5, 0, g.trim, 1); line(ctx, 0, -4, 0, 7, "#ffd54f", 1); }
  rect(ctx, -5, 4, 10, 2, "#4e342e");                               // belt
  circle(ctx, 0, -9, 5, "#ffcc80", "#d8ac71", OUTLINE_WIDTH);                                 // head
  circle(ctx, 1.6 + (idle ? Math.sin(T * 1.1 + s.phase) * 0.6 : 0), -9.5, 0.7, "#212121");   // eye glances about
  ctx.fillStyle = g.helmet;                                         // helmet
  ctx.beginPath(); ctx.arc(0, -10, 5.5, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = g.helmetEdge; ctx.lineWidth = OUTLINE_WIDTH; ctx.stroke();
  rect(ctx, -5.5, -10, 11, 2, g.helmet);
  line(ctx, -5.5, -8, 5.5, -8, g.helmetEdge, DETAIL_OUTLINE_WIDTH);
  if (s.level === 3) {                                              // red plume sways
    const pw = Math.sin(T * 3 + s.phase) * 1.2;
    poly(ctx, [[-1, -15], [1, -15], [3 + pw, -22], [-5 + pw, -20]], "#c62828", "#a62c2c", DETAIL_OUTLINE_WIDTH);
  }
  if (s.level === 1) line(ctx, -5, -9, 5, -9, "#5d4037", 1);
  // Sword: raised behind, swings forward on attack (or practice)
  if (swinging) line(ctx, -5, 0, 12, -6, g.sword, 2);
  else line(ctx, -6, 0, -10, -13, g.sword, 2);
  // Shield: round at low levels, kite shield for the royal guard; lifts a little when fighting
  const sy = s.target ? -2 : 0;
  if (s.level === 3) poly(ctx, [[3, -4 + sy], [11, -4 + sy], [11, 2 + sy], [7, 6 + sy], [3, 2 + sy]], g.shield, g.shieldTrim, OUTLINE_WIDTH);
  else circle(ctx, 7, 1 + sy, 4.5, g.shield, g.shieldTrim, OUTLINE_WIDTH);
  ctx.restore();

  const w = 18, x = s.x - w / 2, y = s.y - 20;
  rect(ctx, x, y, w, 3, "#222");
  rect(ctx, x, y, w * (s.hp / s.maxHp), 3, "#42a5f5");
}

function drawSummon(s) {
  const T = state.time, walk = s.moving ? Math.sin(s.phase) : 0;
  const cloud = s.specialization === "cloud", brood = s.specialization === "brood";
  if (brood) {
    const scale = s.hatchling ? 0.55 : 1;
    bodyShadow(ctx, s.x - s.dir * scale, s.y + 4 * scale, 10 * scale, 6 * scale);
  } else shadow(ctx, s.x, s.y + 10, cloud ? 7 : 16, 4, 26);
  ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.dir, 1);
  if (cloud) {
    const lift = 4 + Math.sin(T * 2 + s.phase) * 1.2 + (s.moving ? Math.abs(walk) * 3 : 0) + (s.target?.def.flying && !s.recovery ? 14 : 0);
    const thrust = Math.sin(Math.min(1, s.swing / 0.2) * Math.PI) * 7;
    ctx.translate(0, -lift); ctx.globalAlpha = s.recovery > 0 ? 0.65 : 1;
    const silk = "#e2e9d5";
    poly(ctx, [[-6, -7], [4, -7], [6, 2], [10, 10], [0, 7], [-7, 10], [-4, 1]], silk, "#bcc7b5", OUTLINE_WIDTH);
    for (const dx of [-2, 3]) line(ctx, dx, -3, dx + Math.sin(T * 2 + s.phase) * 1.2, 7, "#a3b9ae", 0.75);
    line(ctx, -5, -5, 4, -5, "#b78e4d", 1.4);
    circle(ctx, 0, -13, 4.5, "#f0dfbd", "#ccb99d", OUTLINE_WIDTH);
    poly(ctx, [[-5, -14], [-3, -19], [2, -20], [5, -14]], "#47777d", "#3d666b", DETAIL_OUTLINE_WIDTH);
    line(ctx, -3, -17, 3, -17, "#d0bd83", 0.8);
    line(ctx, 0, -12, 2, -12, "#597e86", 0.7);
    outlinedLimb(-4, 0, -11, 5, "#d4dfca", 2, "#b5c3ad");
    const tipX = s.swing > 0 ? 22 + thrust : 10, tipY = s.swing > 0 ? -7 : -23;
    line(ctx, 4, -2, tipX, tipY + 5, "#846b44", 1.5);
    poly(ctx, [[tipX, tipY], [tipX - 2, tipY + 7], [tipX + 2, tipY + 6]], "#f4edd2", "#c6d2b8", DETAIL_OUTLINE_WIDTH);
    line(ctx, tipX, tipY + 1, tipX, tipY + 6, "#9ac4c8", 0.6);
    line(ctx, -3, 7, -11 - walk * 2, 10, "rgba(168,208,209,0.6)", 1.6);
  } else if (brood) {
    const scale = s.hatchling ? 0.55 : 1;
    ctx.scale(scale, scale);
    for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) {
      const step = s.moving ? Math.sin(s.phase + i * 2 + side) * 2 : 0;
      line(ctx, i * 5, 0, i * 6 + 2, side * (5 + step), "#665638", 1.6);
      line(ctx, i * 6 + 2, side * (5 + step), i * 7 - 2, side * (9 + step), "#475035", 1.2);
    }
    ellipse(ctx, -1, -2, 10, 7, "#4b7040", "#405f37", OUTLINE_WIDTH);
    ellipse(ctx, -2, -4, 6, 2.5, "#759650");
    line(ctx, -9, -2, 7, -2, "#304e31", 0.7);
    for (const dx of [-5, 3]) line(ctx, dx, -7, dx + 1, -3, "#a4b772", 0.75);
    circle(ctx, 8, -2, 4, "#56663b", "#485632", OUTLINE_WIDTH);
    for (const side of [-1, 1]) {
      const bite = s.swing > 0 ? Math.sin(s.swing / 0.2 * Math.PI) * 1.8 : 0;
      line(ctx, 10, -2 + side * 2, 15, -2 + side * (3 - bite), "#e0ce91", 1.2);
    }
    circle(ctx, 9.8, -4.3, 0.75, "#e4c17c");
  } else drawJadeGuardian(s, walk);
  ctx.restore();
  const w = s.hatchling ? 12 : cloud ? 18 : brood ? 22 : 32;
  const top = s.y - (cloud ? 32 : brood ? 15 : 36);
  rect(ctx, s.x - w / 2, top, w, 3, "#222");
  rect(ctx, s.x - w / 2, top, w * Math.max(0, s.hp / s.maxHp), 3, cloud ? "#81d4fa" : "#80cbc4");
}


// A carved temple beast: planted paws, a sculpted mane and restrained jade inlays.
function drawJadeGuardian(s, walk) {
  const jade = "#3d8b77", edge = "#347662", pale = "#87b99d";
  const recoil = s.swing > 0 ? Math.sin(Math.PI * (1 - Math.min(1, s.swing / 0.45))) * 8 : 0;
  // The tail curls from the haunch; only its tip follows the walking rhythm.
  ctx.beginPath(); ctx.moveTo(-12, -2);
  ctx.bezierCurveTo(-27, -2, -27, -19 + walk, -19, -17 + walk);
  ctx.strokeStyle = edge; ctx.lineWidth = 4 + OUTLINE_WIDTH * 2; ctx.stroke();
  ctx.strokeStyle = jade; ctx.lineWidth = 4; ctx.stroke();
  ellipse(ctx, -19, -17 + walk, 4, 3, "#69a88a", "#599177", OUTLINE_WIDTH);

  outlinedLimb(-8, 1, -11 - walk * 2, 13, "#356e5e", 7, "#2d5f51");
  outlinedLimb(10, -1, 13 + walk, 13, "#356e5e", 7, "#2d5f51");
  // The shoulder sits behind the torso and mane; only the forepaw passes in front.
  outlinedLimb(9, -3, 18 + walk, 10 - recoil, "#559b80", 8, "#47846d");
  ellipse(ctx, -4, -3, 14, 12, jade, edge, OUTLINE_WIDTH);
  ellipse(ctx, -10, 1, 8, 9, "#559b80", "#47846d", OUTLINE_WIDTH);
  // A short carved spiral distinguishes the rear haunch without noisy texture.
  ctx.beginPath(); ctx.arc(-10, 0, 3.5, -1.4, 3.3);
  ctx.strokeStyle = "#9bbb8f"; ctx.lineWidth = 0.7; ctx.stroke();
  ellipse(ctx, -11 - walk * 2, 13, 6, 3, pale, "#719d85", OUTLINE_WIDTH);
  ellipse(ctx, 13 + walk, 13, 6, 3, pale, "#719d85", OUTLINE_WIDTH);

  // The mane is one curved silhouette, rather than separate mechanical armor plates.
  ctx.beginPath(); ctx.moveTo(-5, -28);
  ctx.bezierCurveTo(-14, -29, -14, -20, -10, -17);
  ctx.bezierCurveTo(-16, -11, -10, -5, -5, -6);
  ctx.quadraticCurveTo(-4, 1, 3, -2);
  ctx.quadraticCurveTo(11, 2, 14, -5);
  ctx.bezierCurveTo(23, -8, 22, -17, 18, -20);
  ctx.quadraticCurveTo(19, -31, 10, -30);
  ctx.quadraticCurveTo(2, -36, -5, -28); ctx.closePath();
  ctx.fillStyle = "#2e715f"; ctx.fill(); ctx.strokeStyle = "#286250"; ctx.lineWidth = OUTLINE_WIDTH; ctx.stroke();
  for (const side of [-1, 1]) {
    const x = 4 + side * 10;
    ctx.beginPath(); ctx.moveTo(x, -23); ctx.quadraticCurveTo(x + side * 4, -17, x, -12);
    ctx.strokeStyle = "#75a98c"; ctx.lineWidth = 0.8; ctx.stroke();
  }
  ellipse(ctx, -2, -28, 3, 3.5, pale, "#719d85", DETAIL_OUTLINE_WIDTH);
  ellipse(ctx, 12, -28, 3, 3.5, pale, "#719d85", DETAIL_OUTLINE_WIDTH);
  ellipse(ctx, 5, -20, 9, 9, pale, "#719d85", OUTLINE_WIDTH);
  // Broad brows, warm inlaid eyes and a compact feline muzzle.
  line(ctx, -1, -24, 3, -23, "#3a705b", 1.4);
  line(ctx, 7, -23, 12, -25, "#3a705b", 1.4);
  for (const x of [1, 9]) line(ctx, x, -21, x + 2, -21, "#f2df9b", 1.1);
  ellipse(ctx, 4, -15, 4, 3, "#bad1aa"); ellipse(ctx, 9, -15, 4, 3, "#bad1aa");
  poly(ctx, [[4, -18], [9, -18], [6.5, -15]], "#386b53");
  line(ctx, 6.5, -15, 6.5, -12, "#497b60", 0.7);
  poly(ctx, [[4, -7], [7, -3], [4, 1], [1, -3]], "#f1df9a");

  // A heavy forepaw strikes the ground, then recoils briefly before settling.
  ellipse(ctx, 19 + walk, 12 - recoil, 7, 4, pale, "#719d85", OUTLINE_WIDTH);
  for (const dx of [-2, 2]) line(ctx, 19 + walk + dx, 11 - recoil, 19 + walk + dx, 14 - recoil, "#5d8b70", 0.65);
}

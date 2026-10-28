import { ctx, rect, circle, ellipse, poly, line, shadow } from "./gfx.js";
import { state } from "../state.js";

// Soldiers look tougher as their barracks levels up:
// level 1 militia in leather, level 2 men-at-arms in steel, level 3 royal guard in gold.
const GEAR = {
  1: { tunic: "#8d6e63", trim: "#4e342e", helmet: "#795548", shield: "#6d4c41", shieldTrim: "#a1887f", sword: "#b0bec5" },
  2: { tunic: "#1565c0", trim: "#0d47a1", helmet: "#9e9e9e", shield: "#c62828", shieldTrim: "#ffd54f", sword: "#eceff1" },
  3: { tunic: "#cfd8dc", trim: "#546e7a", helmet: "#ffd54f", shield: "#1565c0", shieldTrim: "#ffd54f", sword: "#ffffff" },
};

export function drawSoldier(s) {
  if (s.hp <= 0) return;
  if (s.specialization) { drawSummon(s); return; }
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
  line(ctx, -3, 6, -3 + sw, 13 + bob, "#37474f", 3);                // legs
  line(ctx, 3, 6, 3 - sw, 13 + bob, "#37474f", 3);
  rect(ctx, -5, -4, 10, 11, g.tunic, g.trim);                       // tunic / armour
  if (s.level === 3) { line(ctx, -5, 0, 5, 0, g.trim, 1); line(ctx, 0, -4, 0, 7, "#ffd54f", 1); }
  rect(ctx, -5, 4, 10, 2, "#4e342e");                               // belt
  circle(ctx, 0, -9, 5, "#ffcc80");                                 // head
  circle(ctx, 1.6 + (idle ? Math.sin(T * 1.1 + s.phase) * 0.6 : 0), -9.5, 0.7, "#212121");   // eye glances about
  ctx.fillStyle = g.helmet;                                         // helmet
  ctx.beginPath(); ctx.arc(0, -10, 5.5, Math.PI, 0); ctx.fill();
  rect(ctx, -5.5, -10, 11, 2, g.helmet);
  if (s.level === 3) {                                              // red plume sways
    const pw = Math.sin(T * 3 + s.phase) * 1.2;
    poly(ctx, [[-1, -15], [1, -15], [3 + pw, -22], [-5 + pw, -20]], "#c62828");
  }
  if (s.level === 1) line(ctx, -5, -9, 5, -9, "#5d4037", 1);
  // Sword: raised behind, swings forward on attack (or practice)
  if (swinging) line(ctx, -5, 0, 12, -6, g.sword, 2);
  else line(ctx, -6, 0, -10, -13, g.sword, 2);
  // Shield: round at low levels, kite shield for the royal guard; lifts a little when fighting
  const sy = s.target ? -2 : 0;
  if (s.level === 3) poly(ctx, [[3, -4 + sy], [11, -4 + sy], [11, 2 + sy], [7, 6 + sy], [3, 2 + sy]], g.shield, g.shieldTrim, 1.2);
  else circle(ctx, 7, 1 + sy, 4.5, g.shield, g.shieldTrim);
  ctx.restore();

  const w = 18, x = s.x - w / 2, y = s.y - 20;
  rect(ctx, x, y, w, 3, "#222");
  rect(ctx, x, y, w * (s.hp / s.maxHp), 3, "#42a5f5");
}

function drawSummon(s) {
  const T = state.time, walk = s.moving ? Math.sin(s.phase) : 0;
  const cloud = s.specialization === "cloud", brood = s.specialization === "brood";
  shadow(ctx, s.x, s.y + 10, brood ? 10 : cloud ? 7 : 16, 4, 26);
  ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.dir, 1);
  if (cloud) {
    const lift = 4 + Math.sin(T * 3 + s.phase) * 2 + (s.moving ? Math.abs(walk) * 5 : 0) + (s.target?.def.flying && !s.recovery ? 14 : 0);
    ctx.translate(0, -lift); ctx.globalAlpha = s.recovery > 0 ? 0.55 : 0.9;
    poly(ctx, [[-7, 9], [-5, -6], [4, -6], [8, 9], [0, 5]], "#b3e5fc", "#4f83a0");
    circle(ctx, 0, -12, 5, "#e0f7fa", "#81d4fa");
    ellipse(ctx, 0, -19, 7, 2, null, "#ffd54f", 1);
    line(ctx, 4, 1, s.swing > 0 ? 21 : 10, s.swing > 0 ? -8 : -19, "#eceff1", 2);
    poly(ctx, s.swing > 0 ? [[21, -8], [15, -9], [18, -3]] : [[10, -23], [7, -16], [12, -17]], "#ffd54f");
    line(ctx, -4, 5, -13 - walk * 3, 11, "#81d4fa", 2);
  } else if (brood) {
    const scale = s.hatchling ? 0.55 : 1;
    ctx.scale(scale, scale);
    for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) {
      line(ctx, i * 5, 0, i * 7 + walk * side * 3, side * 9, "#5d4037", 2);
    }
    ellipse(ctx, -1, -2, 10, 7, s.hatchling ? "#aed581" : "#557c30", "#263c18", 1.5);
    line(ctx, -8, -2, 6, -2, "#c5d99a", 1);
    circle(ctx, 9, -2, 4, "#374b24");
    for (const side of [-1, 1]) line(ctx, 10, -2 + side * 2, 15 + (s.swing > 0 ? 2 : 0), -2 + side * 4, "#ffe082", 1.5);
    circle(ctx, 10, -4, 1, "#ffcc80");
  } else {
    line(ctx, -7, 6, -8 + walk * 3, 14, "#347566", 7);
    line(ctx, 7, 6, 8 - walk * 3, 14, "#347566", 7);
    poly(ctx, [[-14, -14], [12, -14], [10, 8], [-11, 8]], "#68ad91", "#235b50", 2);
    circle(ctx, 0, -22, 8, "#8bc9ac", "#235b50", 2);
    line(ctx, -5, -23, -1, -23, "#fff59d", 2); line(ctx, 2, -23, 6, -23, "#fff59d", 2);
    poly(ctx, [[0, -11], [5, -4], [0, 3], [-5, -4]], "#ffe082");
    const armY = s.swing > 0 ? 9 : -15;
    line(ctx, 11, -9, 21, armY, "#347566", 6);
    rect(ctx, 15, armY - 8, 16, 12, "#a3d4bd", "#235b50", 2);
    line(ctx, -11, -9, -18, 2 + walk * 2, "#347566", 6);
  }
  ctx.restore();
  const w = s.hatchling ? 12 : cloud ? 18 : brood ? 22 : 32;
  const top = s.y - (cloud ? 32 : brood ? 15 : 36);
  rect(ctx, s.x - w / 2, top, w, 3, "#222");
  rect(ctx, s.x - w / 2, top, w * Math.max(0, s.hp / s.maxHp), 3, cloud ? "#81d4fa" : "#80cbc4");
}

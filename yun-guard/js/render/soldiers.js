import { ctx, rect, circle, ellipse, poly, line, shadow } from "./gfx.js";
import { state } from "../state.js";
import { shaded } from "./tower-materials.js";

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
    const lift = 4 + Math.sin(T * 2 + s.phase) * 1.2 + (s.moving ? Math.abs(walk) * 3 : 0) + (s.target?.def.flying && !s.recovery ? 14 : 0);
    const thrust = Math.sin(Math.min(1, s.swing / 0.2) * Math.PI) * 7;
    ctx.translate(0, -lift); ctx.globalAlpha = s.recovery > 0 ? 0.65 : 0.95;
    const silk = shaded(-7, -8, 15, 18, "#e3e8d7", "#a4c5c6", "#628f9a");
    poly(ctx, [[-6, -7], [4, -7], [6, 2], [10, 10], [0, 7], [-7, 10], [-4, 1]], silk);
    for (const dx of [-3, 1, 4]) line(ctx, dx, -3, dx + Math.sin(T * 2 + s.phase) * 1.2, 7, "rgba(225,237,216,0.55)", 0.65);
    line(ctx, -5, -5, 4, -5, "#c1ad77", 1.4);
    circle(ctx, 0, -13, 4.5, shaded(-5, -18, 10, 9, "#f2edcf", "#cddfda", "#92b9be"));
    poly(ctx, [[-5, -14], [-3, -19], [2, -20], [5, -14]], "#779b9f");
    line(ctx, -3, -17, 3, -17, "#d0bd83", 0.8);
    line(ctx, 0, -12, 2, -12, "#597e86", 0.7);
    line(ctx, -4, 0, -11, 5, "#b1cecb", 2);
    const tipX = s.swing > 0 ? 22 + thrust : 10, tipY = s.swing > 0 ? -7 : -23;
    line(ctx, 4, -2, tipX, tipY + 5, "#9c946e", 1.5);
    poly(ctx, [[tipX, tipY], [tipX - 2, tipY + 7], [tipX + 2, tipY + 6]], "#edf2dd");
    line(ctx, tipX, tipY + 1, tipX, tipY + 6, "#9ac4c8", 0.6);
    line(ctx, -3, 7, -11 - walk * 2, 10, "rgba(168,208,209,0.6)", 1.6);
  } else if (brood) {
    const scale = s.hatchling ? 0.55 : 1;
    ctx.scale(scale, scale);
    for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) {
      const step = s.moving ? Math.sin(s.phase + i * 2 + side) * 2 : 0;
      line(ctx, i * 5, 0, i * 6 + 2, side * (5 + step), "#7b7952", 1.6);
      line(ctx, i * 6 + 2, side * (5 + step), i * 7 - 2, side * (9 + step), "#565d3d", 1.2);
    }
    ellipse(ctx, -1, -2, 10, 7, shaded(-11, -9, 20, 14, "#aab57e", "#708947", "#3e5d39"));
    ellipse(ctx, -2, -4, 6, 3, "rgba(215,218,155,0.2)");
    line(ctx, -9, -2, 7, -2, "#354f32", 0.8);
    for (let i = -1; i <= 1; i++) {
      line(ctx, i * 4 - 2, -7, i * 4 - 1, -3, "rgba(212,216,161,0.4)", 0.55);
      line(ctx, i * 4 - 1, -1, i * 4 - 2, 3, "rgba(34,61,33,0.25)", 0.55);
    }
    circle(ctx, 8, -2, 4, shaded(4, -6, 8, 8, "#a0a975", "#647a45", "#384e32"));
    for (const side of [-1, 1]) {
      const bite = s.swing > 0 ? Math.sin(s.swing / 0.2 * Math.PI) * 1.8 : 0;
      line(ctx, 10, -2 + side * 2, 15, -2 + side * (3 - bite), "#cfc798", 1.2);
    }
    circle(ctx, 9.8, -4.3, 0.75, "#e4c17c");
  } else {
    const impact = s.swing > 0 ? Math.min(1, s.swing / 0.45) : 0;
    const jade = shaded(-15, -16, 29, 25, "#acd1b7", "#73a68f", "#3d7167");
    line(ctx, -7, 6, -8 + walk * 3, 14, "#4d8372", 7);
    line(ctx, 7, 6, 8 - walk * 3, 14, "#4d8372", 7);
    rect(ctx, -12 + walk * 3, 11, 9, 4, "#729a83"); rect(ctx, 4 - walk * 3, 11, 9, 4, "#729a83");
    poly(ctx, [[-14, -15], [12, -15], [10, 8], [-11, 8]], jade);
    for (const side of [-1, 1]) {
      poly(ctx, [[side * 7, -13], [side * 16, -15], [side * 17, -7], [side * 8, -5]], "#8fbca0");
      line(ctx, side * 8, -12, side * 15, -12, "#ccdab1", 0.7);
    }
    rect(ctx, -9, 3, 18, 2, "#537a67");
    rect(ctx, -7, -29, 14, 14, shaded(-7, -29, 14, 14, "#b5d2b5", "#81af97", "#477b6c"));
    poly(ctx, [[-9, -27], [0, -32], [9, -27], [6, -25], [-6, -25]], "#719c84");
    for (const dx of [-4, 2]) line(ctx, dx, -23, dx + 2, -23, "#e4e8ae", 1.1);
    line(ctx, -3, -18, 3, -18, "#4c7c69", 0.8);
    poly(ctx, [[0, -11], [4, -4], [0, 1], [-4, -4]], "#dce8bc");
    const armY = -15 + impact * 22;
    line(ctx, 11, -9, 21, armY, "#527f6b", 6);
    rect(ctx, 15, armY - 8, 16, 12, shaded(15, armY - 8, 16, 12, "#c0d4b5", "#92b79b", "#527d6b"));
    line(ctx, 17, armY - 7, 28, armY - 7, "#e1dfb5", 0.8);
    line(ctx, 20, armY - 5, 26, armY + 1, "#547a65", 0.8);
    line(ctx, -11, -9, -18, 2 + walk * 2, "#527f6b", 6);
  }
  ctx.restore();
  const w = s.hatchling ? 12 : cloud ? 18 : brood ? 22 : 32;
  const top = s.y - (cloud ? 32 : brood ? 15 : 36);
  rect(ctx, s.x - w / 2, top, w, 3, "#222");
  rect(ctx, s.x - w / 2, top, w * Math.max(0, s.hp / s.maxHp), 3, cloud ? "#81d4fa" : "#80cbc4");
}

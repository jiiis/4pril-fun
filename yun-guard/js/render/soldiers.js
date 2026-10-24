import { ctx, rect, circle, poly, line, shadow } from "./gfx.js";
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

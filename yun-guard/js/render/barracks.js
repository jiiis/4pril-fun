import { ctx, rect, circle, ellipse, poly, line } from "./gfx.js";
import { state } from "../state.js";
import { skillRank } from "../towers.js";
import { addLight } from "./lights.js";
import { shaded, masonry, timber, tiledRoof, lantern, insetWindow } from "./tower-materials.js";

export function drawSummoningHall(t, x, y) {
  ctx.save();
  if (t.specialization === "cloud") drawMonastery(t, x, y);
  else if (t.specialization === "brood") drawNursery(t, x, y);
  else drawJadeHall(t, x, y);
  ctx.restore();
}

function drawMonastery(t, x, y) {
  const steps = skillRank(t, "cloudstep"), spears = skillRank(t, "skyspears");
  masonry(x - 28, y + 4, 56, 8);
  masonry(x - 24, y, 48, 6);
  masonry(x - 20, y - 27, 40, 28);
  for (const dx of [-21, 17]) timber(x + dx, y - 31, 4, 32);
  rect(ctx, x - 7, y - 15, 14, 18, "#293f40");
  for (const dx of [-5, 1]) rect(ctx, x + dx, y - 14, 4, 14, "#718f8c");
  for (const dx of [-16, 10]) insetWindow(x + dx, y - 20, 6, 9);
  tiledRoof(x, y - 29, 31, 19);
  masonry(x - 11, y - 43, 22, 9);
  tiledRoof(x, y - 44, 19, 13);
  line(ctx, x, y - 56, x, y - 62, "#b6a16a", 1.2);
  circle(ctx, x, y - 63, 1.5, "#d9c28a");
  lantern(x - 18, y - 4, x, 23);
  // A suspended bronze bell sways gently; the rigid building never bobs.
  const sway = Math.sin(state.time * 1.4 + x) * 0.07;
  ctx.save(); ctx.translate(x + 25, y - 23); ctx.rotate(sway);
  line(ctx, 0, 0, 0, 5, "#887d60", 0.8);
  poly(ctx, [[-3, 5], [3, 5], [4, 11], [-4, 11]], shaded(-4, 5, 8, 6, "#dbcca0", "#ae9561", "#756347"));
  line(ctx, -4, 11, 4, 11, "#e4d4a4", 0.8); circle(ctx, 0, 12, 1, "#8e754f");
  ctx.restore();
  for (let i = 0; i < steps; i++) {
    const dx = -10 + i * 10;
    masonry(x + dx - 4, y + 10, 8, 3, true);
    line(ctx, x + dx - 2, y + 10, x + dx + 2, y + 10, "#d9d9bd", 0.7);
  }
  for (let i = 0; i < 1 + spears; i++) {
    const dx = x + 21 + i * 2.5;
    line(ctx, dx, y + 5, dx, y - 13, "#9b8963", 0.8);
    poly(ctx, [[dx, y - 18], [dx - 1.5, y - 12], [dx + 1.5, y - 12]], "#d7e6dd");
  }
}

function drawNursery(t, x, y) {
  const chitin = skillRank(t, "chitin"), hatchery = skillRank(t, "hatchery"), last = skillRank(t, "lastbrood");
  masonry(x - 29, y + 3, 58, 9);
  // Curved shell shingles shelter a real framed entrance, with a warm incubation room inside.
  const shell = shaded(x - 25, y - 39, 50, 44, "#a8b18a", "#75865d", "#3d5946");
  ctx.fillStyle = shell; ctx.beginPath(); ctx.moveTo(x - 26, y + 3);
  ctx.bezierCurveTo(x - 30, y - 38, x + 4, y - 48, x + 21, y - 24);
  ctx.quadraticCurveTo(x + 29, y - 12, x + 27, y + 4); ctx.closePath(); ctx.fill();
  for (let row = 0; row < 5; row++) {
    const yy = y - 28 + row * 6, hw = 12 + row * 2.6;
    ctx.strokeStyle = "rgba(36,60,39,0.38)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(x, yy, hw, 5, 0, 0.1, Math.PI - 0.1); ctx.stroke();
    line(ctx, x - hw + 1, yy + 1, x - hw + 7, yy + 3, "rgba(222,223,169,0.3)", 0.7);
  }
  for (const dx of [-21, 18]) timber(x + dx, y - 16, 3, 21);
  masonry(x - 11, y - 10, 22, 17);
  rect(ctx, x - 8, y - 8, 16, 15, "#283d2b");
  rect(ctx, x - 7, y - 7, 14, 10, shaded(x - 7, y - 7, 14, 10, "#b69e61", "#81754b", "#49543a"));
  for (let i = 0; i < 3; i++) ellipse(ctx, x - 4 + i * 4, y, 2, 3.2, i % 2 ? "#c4bc87" : "#ded3a4");
  timber(x - 12, y - 12, 24, 3);
  lantern(x + 17, y - 5, x, 22);
  for (let i = 0; i < chitin; i++) {
    const yy = y - 24 + i * 7;
    poly(ctx, [[x - 24, yy], [x - 18, yy - 3], [x - 18, yy + 4], [x - 25, yy + 6]], "#91a18a");
    line(ctx, x - 24, yy, x - 19, yy - 2, "#c7c8a5", 0.7);
  }
  for (let i = 0; i < hatchery; i++) {
    timber(x - 24 + i * 9, y + 6, 8, 6);
    ellipse(ctx, x - 20 + i * 9, y + 5, 2.5, 3, "#d0cba2");
  }
  for (let i = 0; i < last; i++) {
    const xx = x + 26 + i * 2.5;
    ellipse(ctx, xx, y + 5, 2.5, 4, "#9aa480");
    line(ctx, xx - 1, y + 2, xx + 1, y + 7, "#c4c4a0", 0.6);
  }
}

function drawJadeHall(t, x, y) {
  const heart = skillRank(t, "stoneheart"), earth = skillRank(t, "earthbreaker");
  masonry(x - 29, y + 3, 58, 9);
  masonry(x - 24, y - 1, 48, 7, true);
  for (const dx of [-24, 15]) {
    masonry(x + dx, y - 32, 9, 34, true);
    masonry(x + dx - 2, y - 35, 13, 5);
    for (let i = 0; i < 3; i++) {
      line(ctx, x + dx + 2, y - 23 + i * 7, x + dx + 6, y - 26 + i * 7, "rgba(214,221,178,0.5)", 0.65);
    }
  }
  rect(ctx, x - 15, y - 26, 30, 28, shaded(x - 15, y - 26, 30, 28, "#46594f", "#2c443d", "#1f3632"));
  masonry(x - 13, y - 3, 26, 5, true);
  tiledRoof(x, y - 35, 31, 17);
  masonry(x - 9, y - 48, 18, 5, true);
  // A fixed jade heart powers the guardian; only its inner luminance breathes.
  const pulse = 0.8 + Math.sin(state.time * 1.5 + x) * 0.06;
  ctx.globalAlpha = pulse;
  poly(ctx, [[x, y - 25], [x + 6, y - 15], [x, y - 7], [x - 6, y - 15]], shaded(x - 6, y - 25, 12, 18, "#e3e7ba", "#a6d0b0", "#5d9f91"));
  poly(ctx, [[x, y - 24], [x, y - 8], [x - 4, y - 15]], "rgba(248,244,192,0.45)");
  ctx.globalAlpha = 1;
  addLight(ctx, x, y - 15, 25 + heart * 2, "green");
  for (let i = 0; i < heart; i++) {
    const yy = y - 28 + i * 7;
    for (const side of [-1, 1]) poly(ctx, [[x + side * 18, yy], [x + side * 22, yy - 2], [x + side * 22, yy + 3], [x + side * 18, yy + 5]], "#d2c696");
  }
  for (let i = 0; i < earth; i++) {
    masonry(x - 25 + i * 17, y + 10, 14, 4, true);
    line(ctx, x - 21 + i * 17, y + 10, x - 16 + i * 17, y + 12, "#b6c4a0", 0.8);
  }
}

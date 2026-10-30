import { ctx, rect, circle, ellipse, poly, line } from "./gfx.js";
import { state } from "../state.js";
import { specializationDef, skillRank } from "../towers.js";

function crescent(x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI * 0.25, Math.PI * 1.75);
  ctx.quadraticCurveTo(x - radius * 0.2, y, x + radius * Math.SQRT1_2, y + radius * Math.SQRT1_2);
  ctx.fill();
}

export function drawArcherSpecialization(tower, x, y) {
  ctx.save();
  if (tower.specialization === "falcon") {
    rect(ctx, x - 19, y - 10, 38, 22, "#85735a", "#514739", 1.5);
    for (const side of [-1, 1]) {
      line(ctx, x + side * 12, y - 10, x + side * 12, y - 78, "#775338", 5);
      line(ctx, x, y - 18, x + side * 12, y - 58, "#a47b4c", 2);
      line(ctx, x + side * 12, y - 58, x + side * 24, y - 58, "#c4a66c", 3);
    }
    rect(ctx, x - 24, y - 69, 48, 7, "#9a734b", "#5f4937", 1);
    poly(ctx, [[x - 27, y - 80], [x, y - 99], [x + 27, y - 80]], "#9d6b42", "#553e30", 1.5);
    for (let i = -2; i <= 2; i++) line(ctx, x + i * 7, y - 83 + Math.abs(i) * 2, x + i * 8, y - 78, "#d6b77d", 1);
    ellipse(ctx, x, y - 71, 11, 4, "#c5a46b", "#69513a", 1);
    for (let i = 0; i < 4; i++) line(ctx, x - 10 + i * 5, y - 72, x - 5 + i * 4, y - 76, "#e0c58b", 1);
    poly(ctx, [[x - 4, y - 35], [x + 4, y - 41], [x + 2, y - 28], [x - 2, y - 24]], "#ead7a5", "#8d744b", 1);
    line(ctx, x, y - 38, x - 1, y - 25, "#947342", 1);
  } else if (tower.specialization === "thorn") {
    ellipse(ctx, x, y + 5, 24, 11, "#344d32", "#263b27", 1.5);
    ctx.strokeStyle = "#5c7042"; ctx.lineWidth = 11; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.bezierCurveTo(x - 22, y - 24, x + 18, y - 37, x, y - 67); ctx.stroke();
    ctx.strokeStyle = "#91a466"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.bezierCurveTo(x - 15, y - 28, x + 12, y - 38, x, y - 67); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? -1 : 1, yy = y - 14 - i * 9, xx = x + side * (6 + i % 3 * 2);
      line(ctx, xx, yy, xx + side * 15, yy - 10, "#53763b", 2.5);
      poly(ctx, [[xx + side * 7, yy - 5], [xx + side * 20, yy - 18], [xx + side * 18, yy - 3]], "#8baa55", "#435f32", 1);
    }
    ellipse(ctx, x, y - 69, 13, 9, "#748a48", "#344a2c", 1.5);
    poly(ctx, [[x - 10, y - 68], [x, y - 86], [x + 10, y - 68]], "#c5d38a", "#5c7440", 1);
    circle(ctx, x, y - 70, 4 + Math.max(0, tower.anim) * 3, "#e2d8a7");
    for (const side of [-1, 1]) line(ctx, x, y + 2, x + side * 29, y + 9, "#718148", 3);
  } else {
    rect(ctx, x - 20, y - 12, 40, 23, "#46576a", "#2e3b4b", 1.5);
    for (const side of [-1, 1]) {
      poly(ctx, [[x + side * 8, y - 11], [x + side * 18, y - 11], [x + side * 23, y - 57], [x + side * 13, y - 64]], "#718298", "#35465b", 1.5);
      line(ctx, x + side * 15, y - 20, x + side * 18, y - 58, "#bdd3df", 1.2);
    }
    rect(ctx, x - 23, y - 64, 46, 5, "#a3b5c9", "#455a70", 1);
    ctx.strokeStyle = "#c8def1"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 74, 16, Math.PI * 0.1, Math.PI * 1.9); ctx.stroke();
    crescent(x, y - 75, 11, "#e2ebff");
    for (const side of [-1, 1]) { circle(ctx, x + side * 14, y - 43, 3, "#bad7ff"); line(ctx, x + side * 14, y - 49, x + side * 14, y - 58, "#9caec6", 1); }
    const pulse = Math.max(0, tower.anim) / 0.4;
    circle(ctx, x, y - 31, 3 + pulse * 2, "#d5e6ff");
    line(ctx, x - 12, y - 14, x + 12, y - 14, "#b4c7db", 1);
  }
  ctx.restore();
}

export function drawBramblePatches(tower) {
  if (tower.specialization !== "thorn") return;
  const spec = specializationDef(tower), barbs = skillRank(tower, "barbedgrowth");
  ctx.save();
  for (const patch of tower.patches || []) {
    const growth = Math.min(1, patch.age / spec.growth), radius = patch.radius * (0.2 + growth * 0.8);
    circle(ctx, patch.x, patch.y, radius, "rgba(78,114,47,0.14)", state.selected === tower.spot ? "rgba(178,209,119,0.65)" : null, 1);
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.4 + tower.spot, reach = radius * (0.35 + i % 4 * 0.18);
      const dx = Math.cos(angle), dy = Math.sin(angle), x = patch.x + dx * reach, y = patch.y + dy * reach;
      ctx.strokeStyle = i % 2 ? "#5f7a3d" : "#748b49"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(patch.x + dx * 4, patch.y + dy * 4);
      ctx.quadraticCurveTo(x - dy * 7, y + dx * 7 - 4 * growth, x, y); ctx.stroke();
      poly(ctx, [[x, y], [x - dx * 5 - dy * 4, y - dy * 5 + dx * 4], [x + dx * 3, y + dy * 3]], barbs ? "#a59a68" : "#92ad5c", "#4d6634", 0.5);
      if (barbs && i % 2 === 0) line(ctx, x - dx * 3, y - dy * 3, x - dy * (3 + barbs), y + dx * (3 + barbs), "#cbbd89", 1);
    }
  }
  ctx.restore();
}

export function drawArcherAir(tower) {
  if (!tower.falcons?.length && !tower.moonMarks?.size) return;
  ctx.save();
  for (const bird of tower.falcons || []) {
    const flying = bird.target || bird.returning;
    const aim = bird.target || { x: tower.x, y: tower.y - 72 };
    const angle = flying ? Math.atan2(aim.y - bird.y, aim.x - bird.x) : 0;
    const wing = flying ? 5 + Math.sin(bird.phase) * 5 : 2;
    ctx.save(); ctx.translate(bird.x, bird.y); ctx.rotate(angle);
    poly(ctx, [[-2, -1], [-8, -wing - 2], [2, -4], [5, -1]], "#bd9a65", "#694d37", 0.8);
    poly(ctx, [[-2, 1], [-8, wing + 2], [2, 4], [5, 1]], "#decb9d", "#75583a", 0.8);
    ellipse(ctx, 0, 0, 5, 2.5, "#e4d6b2", "#75583a", 0.7);
    poly(ctx, [[-4, -1.5], [-10, -2], [-9, 2], [-4, 1.5]], "#806044");
    circle(ctx, 4, -0.5, 2.4, "#eadbb8"); circle(ctx, 4.8, -1.2, 0.6, "#31271e");
    poly(ctx, [[6, -1], [9, 0], [6, 1]], "#bd914d");
    ctx.restore();
  }
  for (const [enemy, life] of tower.moonMarks || []) {
    if (enemy.dead || enemy.reached) continue;
    ctx.globalAlpha = Math.min(1, life);
    crescent(enemy.x, enemy.y - enemy.def.size - (enemy.def.flying ? 18 : 0) - 8, 5, "#d3e4ff");
  }
  ctx.restore();
}

export function drawMoonShot(shot) {
  ctx.save();
  shot.trail.forEach((point, index) => {
    ctx.globalAlpha = (index + 1) / shot.trail.length * 0.45;
    circle(ctx, point.x, point.y, 1.4, "#b9d4ff");
  });
  ctx.globalAlpha = 1;
  const angle = Math.atan2(shot.ty - shot.y, shot.tx - shot.x), dx = Math.cos(angle), dy = Math.sin(angle), y = shot.y - shot.z;
  line(ctx, shot.x - dx * 9, y - dy * 9, shot.x + dx * 6, y + dy * 6, "#cbdcf2", 1.5);
  poly(ctx, [[shot.x + dx * 10, y + dy * 10], [shot.x + dx * 4 - dy * 2.5, y + dy * 4 + dx * 2.5], [shot.x + dx * 4 + dy * 2.5, y + dy * 4 - dx * 2.5]], "#f3f7ff");
  line(ctx, shot.x - dx * 8, y - dy * 8, shot.x - dx * 12 - dy * 3, y - dy * 12 + dx * 3, "#7ca4d5", 1.5);
  ctx.restore();
}

export function drawArmorRend(enemy) {
  if (!enemy.armorRend) return;
  const x = enemy.x + enemy.def.size * 0.5 + 4, y = enemy.y - enemy.def.size * 0.6 - (enemy.def.flying ? 18 : 0);
  for (let i = 0; i < 3; i++) line(ctx, x - 3 + i * 3, y + 3, x + i * 3, y - 3, "#edc786", 1.3);
}

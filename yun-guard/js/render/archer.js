import { ctx, rect, circle, ellipse, poly, line } from "./gfx.js";
import { state } from "../state.js";
import { addLight } from "./lights.js";
import { shaded, masonry, timber, tiledRoof, lantern, insetWindow } from "./tower-materials.js";
import { specializationDef, skillRank } from "../towers.js";

function crescent(x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI * 0.25, Math.PI * 1.75);
  ctx.quadraticCurveTo(x - radius * 0.2, y, x + radius * Math.SQRT1_2, y + radius * Math.SQRT1_2);
  ctx.fill();
}

export function drawArcherSpecialization(t, x, y) {
  ctx.save();
  // All paths keep the veteran archers' deck and firing positions.
  masonry(x - 20, y - 15, 40, 27, t.specialization === "thorn");
  for (const dx of [-16, 11]) timber(x + dx, y - 57, 5, 44);
  masonry(x - 12, y - 32, 24, 18, t.specialization === "thorn");
  insetWindow(x - 3, y - 26, 6, 9);
  timber(x - 24, y - 58, 48, 6);
  for (const dx of [-22, 20]) timber(x + dx, y - 69, 2, 11);
  line(ctx, x - 22, y - 69, x + 22, y - 69, "#c5ab7c", 1.1);
  if (t.specialization === "falcon") drawRoost(t, x, y);
  else if (t.specialization === "thorn") drawWeavers(t, x, y);
  else drawMoonShrine(t, x, y);
  ctx.restore();
}

function drawRoost(t, x, y) {
  const quarry = skillRank(t, "quarry"), rend = skillRank(t, "talonrend"), pair = skillRank(t, "huntingpair");
  for (const dx of [-26, 23]) timber(x + dx, y - 92, 3, 37);
  timber(x - 25, y - 90, 50, 5);
  tiledRoof(x, y - 91, 32, 20, "red");
  // Individual perches and straw-lined nesting boxes, rather than a floating roof and feather.
  for (const side of [-1, 1]) {
    line(ctx, x + side * 25, y - 72, x + side * 36, y - 72, "#c7aa77", 2.2);
    line(ctx, x + side * 25, y - 64, x + side * 36, y - 72, "#806444", 1.2);
    if (side < 0 || pair) {
      rect(ctx, x + side * 30 - 5, y - 84, 10, 8, "#806347");
      ellipse(ctx, x + side * 30, y - 77, 5, 1.5, "#d7bd86");
      for (let i = 0; i < 4; i++) line(ctx, x + side * 30 - 4 + i * 2, y - 78, x + side * 30 - 2 + i * 2, y - 80, "#bda06a", 0.6);
    }
  }
  lantern(x + 24, y - 43, x, 23);
  for (let i = 0; i < quarry; i++) {
    const xx = x - 12 + i * 8;
    rect(ctx, xx - 2, y - 7, 4, 10, "#776349");
    line(ctx, xx - 1, y - 7, xx + 1, y + 2, "#ccb78d", 0.65);
  }
  for (let i = 0; i < rend; i++) {
    line(ctx, x - 24, y - 24 - i * 6, x - 18, y - 24 - i * 6, "#c7b78e", 1);
    poly(ctx, [[x - 21, y - 27 - i * 6], [x - 19, y - 24 - i * 6], [x - 23, y - 24 - i * 6]], "#bbc7be");
  }
  for (let i = 1; i < pair; i++) line(ctx, x + 12, y - 83 + i * 2.5, x + 23, y - 83 + i * 2.5, "#b49b6b", 0.7);
}

function drawWeavers(t, x, y) {
  const roots = skillRank(t, "deeproots"), barbs = skillRank(t, "barbedgrowth"), drift = skillRank(t, "seeddrift");
  for (const dx of [-27, 24]) timber(x + dx, y - 91, 3, 37);
  tiledRoof(x, y - 92, 33, 19);
  // Living vines climb the fixed trellis; leaves move lightly in the wind, never the load-bearing frame.
  for (const side of [-1, 1]) {
    ctx.strokeStyle = "#667c48"; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(x + side * 24, y + 6);
    ctx.bezierCurveTo(x + side * 36, y - 25, x + side * 30, y - 47, x + side * 27, y - 91); ctx.stroke();
    line(ctx, x + side * 24 - 0.6, y - 12, x + side * 24 - 0.6, y - 23, "#a7af73", 0.7);
    for (let i = 0; i < 7; i++) {
      const yy = y - 8 - i * 12, xx = x + side * (25 + Math.sin(i * 2) * 3), sway = Math.sin(state.time * 1.6 + i + x) * 0.7;
      poly(ctx, [[xx, yy], [xx + side * (9 + sway), yy - 7], [xx + side * 8, yy - 1]], i % 2 ? "#7c9558" : "#a0af6f");
      line(ctx, xx + side, yy - 1, xx + side * 7, yy - 5, "#c0c691", 0.55);
      if (barbs && i % 2 === 0) poly(ctx, [[xx, yy + 2], [xx + side * (3 + barbs), yy - 1], [xx + side, yy + 4]], "#b9ab7c");
    }
  }
  timber(x - 16, y + 5, 32, 6);
  for (let i = 0; i < 3 + roots; i++) {
    const xx = x - 12 + i * 5;
    ellipse(ctx, xx, y + 4, 3, 1.4, "#45543a");
    line(ctx, xx, y + 4, xx - 1, y - 1 - roots, "#97a969", 1);
  }
  lantern(x - 25, y - 45, x, 23);
  for (let i = 0; i < drift; i++) {
    const xx = x + 8 + i * 5;
    line(ctx, xx, y - 83, xx, y - 76, "#8e9569", 0.6);
    ellipse(ctx, xx, y - 74, 2, 3, "#c0bd8e");
  }
}

function drawMoonShrine(t, x, y) {
  const marks = skillRank(t, "lunarmarks"), thread = skillRank(t, "silverthread");
  for (const side of [-1, 1]) {
    const xx = x + side * 25;
    masonry(xx - 3, y - 91, 6, 38);
    line(ctx, xx - 1, y - 89, xx - 1, y - 57, "#dce0cd", 0.7);
  }
  tiledRoof(x, y - 95, 32, 19);
  timber(x - 26, y - 93, 52, 3);
  // The crescent is an actual silver bow mounted above the crew; its string recoils on a ricochet launch.
  const recoil = Math.max(0, 0.18 - (state.time - (t.moonFired ?? -99))) / 0.18;
  ctx.save(); ctx.translate(34, 9);
  line(ctx, x - 10, y - 69, x - 22, y - 64, "#8b9d97", 2);
  ctx.strokeStyle = shaded(x - 14, y - 90, 28, 24, "#f1ebcf", "#c1d0ce", "#6d8e98"); ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(x, y - 77, 13, -Math.PI * 0.8, Math.PI * 0.8); ctx.stroke();
  ctx.strokeStyle = "#d7e6dc"; ctx.lineWidth = 0.65;
  ctx.beginPath(); ctx.moveTo(x - 10.5, y - 84.5); ctx.lineTo(x - 10.5 - recoil * 3, y - 77); ctx.lineTo(x - 10.5, y - 69.5); ctx.stroke();
  for (let i = 0; i <= marks; i++) {
    const xx = x - 12 + i * 8;
    poly(ctx, [[xx, y - 90], [xx + 1.6, y - 87], [xx, y - 84], [xx - 1.6, y - 87]], "#cedfdf");
  }
  circle(ctx, x + 1, y - 77, 2.1, "#e4efed");
  addLight(ctx, x + 1, y - 77, 23, "arc");
  ctx.restore();
  for (let i = 0; i < thread; i++) {
    const yy = y - 43 + i * 6;
    line(ctx, x - 12, yy, x + 12, yy, "#b4c4b9", 0.8);
    circle(ctx, x - 12, yy, 1.2, "#d5cfab"); circle(ctx, x + 12, yy, 1.2, "#d5cfab");
  }
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

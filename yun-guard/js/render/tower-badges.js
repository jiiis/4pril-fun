import { ctx } from "./gfx.js";
import { specializationDef, abilityDef, skillRank } from "../towers.js";
import { drawIcon } from "../icons.js";

export function drawTowerBadge(tower) {
  const specialization = specializationDef(tower), path = specialization || abilityDef(tower);
  const skills = specialization ? Object.entries(specialization.skills) : [];
  const count = Math.min(tower.level, 3);
  const width = skills.length ? 34 : path ? 20 : 21;
  const height = path ? 14 : 10;
  const x = tower.x - width / 2, y = tower.y + 14;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, width, height, 5);
  ctx.fillStyle = "rgba(29, 40, 36, 0.75)"; ctx.fill();
  ctx.strokeStyle = "rgba(205, 181, 123, 0.7)"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = "#dfc88e";
  if (path) drawIcon(ctx, path.icon, x + (skills.length ? 4 : 5), y + 2, 10);
  else {
    ctx.fillStyle = "#e5d5ab";
    for (let i = 0; i < count; i++) {
      ctx.beginPath(); ctx.arc(tower.x + (i - (count - 1) / 2) * 5, y + height / 2, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (let row = 0; row < skills.length; row++) {
    const [key, skill] = skills[row], rank = skillRank(tower, key);
    for (let i = 0; i < skill.costs.length; i++) {
      ctx.fillStyle = i < rank ? "#dfc88e" : "#65726a";
      ctx.beginPath(); ctx.arc(x + 20 + i * 4, y + height / 2 + (row - (skills.length - 1) / 2) * 3.5, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

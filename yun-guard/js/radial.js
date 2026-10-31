import { state } from "./state.js";
import { TOWERS, ABILITIES, ARMOR_CLASSES, DAMAGE_TYPES, W, H } from "./config.js";
import { SPECIALIZATIONS } from "./specializations.js";
import { canUpgrade, canSpecialise, upgradeCost, abilityCost, sellValue, specializationDef, abilityDef, skillRank, skillCost, towerDamage, towerRange, towerRate, soldierDamage, soldierHp, soldierCount, escortCount, foundationDamage, foundationRate, foundationRange } from "./towers.js";
import { icon } from "./icons.js";

const SIZE = 300, REACH = 108;
const SKILL_ICONS = { cloudstep: "waves", skyspears: "ballista", chitin: "shield", hatchery: "people", lastbrood: "burst", stoneheart: "heart", earthbreaker: "bomb" };
const escape = (text) => String(text).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const gold = (value) => `<span class="radial-gold">${icon("coins")} ${value}</span>`;

function choices(tower, page) {
  if (!tower) return Object.entries(TOWERS).map(([key, def]) => ({ label: def.short || def.name, emblem: def.icon, action: "build", data: `data-type="${key}"`, cost: def.cost, build: true }));
  if (page === "paths" && canSpecialise(tower)) {
    const specs = SPECIALIZATIONS[tower.type];
    return Object.entries(specs || ABILITIES[tower.type]).map(([key, def]) => ({
      id: `path:${key}`, label: def.name, emblem: def.icon, description: def.desc,
      action: specs ? "specialize" : "ability", data: specs ? `data-specialization="${key}"` : `data-ability="${key}"`,
      cost: def.cost ?? abilityCost(tower), skills: def.skills, preview: true,
    }));
  }
  const spec = specializationDef(tower);
  if (page === "skills" && spec) return Object.entries(spec.skills).map(([key, skill]) => ({
    id: `skill:${key}`, label: skill.name, emblem: skill.icon || SKILL_ICONS[key] || spec.icon, action: "skill", data: `data-skill="${key}"`,
    cost: skillCost(tower, key), rank: skillRank(tower, key), ranks: skill.costs.length,
    current: skillRank(tower, key) ? skill.descriptions[skillRank(tower, key) - 1] : "Not trained yet.",
    description: skill.descriptions[skillRank(tower, key)] || "All ranks learned.", preview: true,
  }));
  const actions = [];
  if (canUpgrade(tower)) actions.push({ label: "Upgrade", emblem: "plus", action: "upgrade", cost: upgradeCost(tower) });
  else if (canSpecialise(tower)) actions.push({ label: "Paths", emblem: "sparkles", action: "radial-page", data: 'data-page="paths"' });
  else if (spec) actions.push({ label: "Skills", emblem: "sparkles", action: "radial-page", data: 'data-page="skills"' });
  actions.push({ label: "Details", emblem: "panel", action: "details" });
  if (tower.def.soldiers) actions.push({ label: "Rally", emblem: "flag", action: "rally" });
  actions.push({ label: "Sell", emblem: "coins", action: "sell", refund: sellValue(tower) });
  // Keep Details to the right of development, with Sell below or bottom-right.
  const angles = actions.length === 4 ? [-135, -45, 135, 45] : actions.length === 3 ? [-150, -30, 90] : [180, 0];
  return actions.map((choice, i) => ({ ...choice, angle: angles[i] }));
}

function node(choice, i, count, selected) {
  // Half a slot of rotation: two at the sides, three with two above, four on diagonals.
  const angle = choice.angle != null ? choice.angle * Math.PI / 180 : count === 1 ? 0 : -Math.PI / 2 + Math.PI / count + (i - (choice.build ? 1 : 0)) * 2 * Math.PI / count;
  const x = Math.round(Math.cos(angle) * REACH), y = Math.round(Math.sin(angle) * REACH);
  const attrs = choice.preview ? `data-action="radial-preview" data-preview="${choice.id}" aria-pressed="${selected}"` : `data-action="${choice.action}" ${choice.data || ""}`;
  const affordable = choice.cost == null || state.gold >= choice.cost;
  const cost = choice.cost == null ? "" : `data-cost="${choice.cost}" ${choice.preview || affordable ? "" : "disabled"}`;
  const finishStyle = `;--wear-x:${(i * 37 + 13) % 100}%;--wear-y:${(i * 61 + 29) % 100}%;--wear-angle:${i * 47 + 17}deg`;
  return `<button class="radial-action radial-charm ${choice.build ? "tile" : "radial-inner"} ${choice.refund != null ? "radial-sell" : ""} ${selected ? "selected" : ""} ${choice.preview && !affordable ? "unaffordable" : ""}" ${attrs} ${cost}
    style="--orbit-x:${x}px;--orbit-y:${y}px${finishStyle}" title="${escape(choice.label)}" aria-label="${escape(choice.label)}${choice.rank != null ? `, rank ${choice.rank} of ${choice.ranks}` : ""}${choice.cost != null ? `, ${choice.cost} gold` : ""}">
    <span class="radial-stitch" aria-hidden="true"></span>${choice.rank != null ? `<span class="radial-rank">${choice.rank}/${choice.ranks}</span>` : ""}${icon(choice.emblem)}
    <span class="radial-price" ${choice.cost == null && choice.refund == null && choice.rank == null ? 'aria-hidden="true"' : ""}>${choice.cost ?? (choice.refund != null ? `+${choice.refund}` : choice.rank != null ? "MAX" : "&nbsp;")}</span></button>`;
}

function towerSummary(tower) {
  if (!tower) return `<p>Choose a defense around the foundation. On touch screens, tap once to preview its range, then again to build.</p>`;
  const spec = specializationDef(tower), ability = abilityDef(tower), type = spec?.type || tower.def.type;
  const stats = tower.def.soldiers ? [["Damage", soldierDamage(tower)], ["Health", soldierHp(tower)], ["Units", soldierCount(tower)]]
    : [["Damage", towerDamage(tower)], ["Range", towerRange(tower)], ["Rate", `${towerRate(tower).toFixed(2)}/s`]];
  const strong = Object.values(ARMOR_CLASSES).filter((c) => c.multipliers[type] > 1).map((c) => c.name).join(", ");
  const weak = Object.values(ARMOR_CLASSES).filter((c) => c.multipliers[type] < 1).map((c) => c.name).join(", ");
  const armor = spec?.skills.chitin?.armor[skillRank(tower, "chitin")] ?? spec?.armor ?? 0;
  if (escortCount(tower)) stats.push(["Guards", escortCount(tower)]);
  const crew = tower.type === "archer" && spec ? `<p><strong>Veteran fire arrows</strong></p><div class="radial-stats"><span><small>Damage</small><b>${foundationDamage(tower)}</b></span><span><small>Range</small><b>${foundationRange(tower)}</b></span><span><small>Rate</small><b>${foundationRate(tower).toFixed(2)}/s</b></span></div>` : "";
  return `<div class="radial-stats">${stats.map(([label, value]) => `<span><small>${label}</small><b>${value}</b></span>`).join("")}</div>
    ${crew}<p>${escape(spec?.desc || tower.def.desc)}</p><div class="radial-facts"><strong>${DAMAGE_TYPES[type].name} · primary attack</strong>
    ${strong ? `<span>Effective vs ${strong}</span>` : ""}${weak ? `<span>Resisted by ${weak}</span>` : ""}<small>Class matchups apply before armor amount.</small>
    ${tower.def.soldiers ? `<span>${icon("shield")} ${tower.specialization === "brood" ? "Adult" : "Unit"} armor: ${Math.round(armor * 100)}%</span>` : ""}</div>
    ${ability ? `<p><strong>${ability.name}</strong> · ${escape(ability.desc)}</p>` : ""}`;
}

function previewCard(tower, selected) {
  const detail = selected === "tower";
  const title = detail ? specializationDef(tower || {})?.name || abilityDef(tower || {})?.name || tower?.def.name || "Choose your defense" : selected.label;
  const subtitle = detail ? tower ? "Tower details" : "Build details" : selected.rank != null ? `Skill · rank ${selected.rank}/${selected.ranks}` : "Specialization";
  const content = detail ? towerSummary(tower) : selected.rank != null
    ? `<div class="radial-training" aria-label="${selected.rank} of ${selected.ranks} ranks">${Array.from({ length: selected.ranks }, (_, i) => `<i class="${i < selected.rank ? "trained" : ""}"></i>`).join("")}</div><p><small>Current</small>${escape(selected.current)}</p>${selected.cost !== null ? `<p><small>Next rank</small>${escape(selected.description)}</p>` : ""}`
    : `<p>${escape(selected.description)}</p>${selected.skills ? `<div class="radial-skill-names">${Object.values(selected.skills).map((skill) => `<span>${escape(skill.name)}</span>`).join("")}</div><p class="radial-card-note">${tower.def.soldiers ? "Strengthens your defense with specialist units. Skills are bought separately." : "Keeps veteran fire arrows and adds a specialist attack. Skills are bought separately."}</p>` : ""}`;
  const maxed = !detail && selected.rank != null && selected.cost === null;
  const button = detail ? "" : `<footer><button class="radial-purchase" data-action="${selected.action}" ${selected.data} ${maxed ? "disabled" : `data-cost="${selected.cost}" ${state.gold < selected.cost ? "disabled" : ""}`}>
    <span>${maxed ? "Fully trained" : selected.rank != null ? selected.rank ? "Upgrade skill" : "Learn skill" : "Choose path"}</span>${maxed ? icon("check") : gold(selected.cost)}</button></footer>`;
  return `<aside class="radial-card" aria-label="${escape(title)} details"><header><div><small>${subtitle}</small><h3>${escape(title)}</h3></div><button class="radial-preview-back" data-action="radial-dismiss" aria-label="Back to choices">${icon("chevronLeft")}</button></header><div class="radial-card-content">${content}</div>${button}</aside>`;
}

export function radialMenu(tower, page = "main", preview = null) {
  const options = choices(tower, page);
  if (page !== "main") options.push({ label: "Back", emblem: "chevronLeft", action: "radial-back" });
  const selected = preview === "tower" ? "tower" : options.find((choice) => choice.id === preview) || null;
  const label = page === "paths" ? "Choose a path" : page === "skills" ? "Develop your skills" : tower ? `${tower.def.short || tower.def.name} · Lv ${tower.level}` : "Choose a tower";
  return `<div class="radial-orbit">${options.map((choice, i) => node(choice, i, options.length, preview === "tower" ? choice.action === "details" : choice.id === preview)).join("")}
    <span class="radial-hint hint">${escape(label)}</span></div>${selected ? previewCard(tower, selected) : ""}`;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function placeRadial(menu, { point, board, origin, width, height, top, bottom }) {
  const safeTop = Math.max(12, top), safeBottom = height - Math.max(12, bottom), available = Math.max(72, safeBottom - safeTop);
  const card = menu.querySelector(".radial-card"), cardWidth = Math.min(288, width - 24);
  const anchor = menu.querySelector(".radial-action.selected");
  const anchorX = anchor ? parseFloat(anchor.style.getPropertyValue("--orbit-x")) : 0;
  const anchorY = anchor ? parseFloat(anchor.style.getPropertyValue("--orbit-y")) : 0;
  let scale = Math.min(1, Math.max(0.5, available / SIZE), (width - 24) / SIZE);
  const side = width >= SIZE * scale + cardWidth + 36;
  const compact = !!card && !side && available < 294;
  if (card && !side && !compact) scale = Math.min(scale, Math.max(0.5, (available - 180) / SIZE));
  menu.classList.toggle("radial-compact-preview", compact);
  const radius = SIZE * scale / 2;
  const px = board.left - origin.left + point.x * board.width / W, py = board.top - origin.top + point.y * board.height / H;
  // The orbit follows the tower, including beyond the viewport; only the detail card is constrained.
  const x = px, y = py;
  if (card) {
    const cardHeight = side || compact ? available : Math.max(132, Math.min(300, available - radius * 2 - 12));
    card.style.width = `${cardWidth}px`;
    card.style.maxHeight = `${cardHeight}px`;
    card.style.height = `${Math.min(300, cardHeight)}px`;
    const h = card.offsetHeight;
    if (compact) {
      card.style.left = `${clamp(px - cardWidth / 2, 12, width - cardWidth - 12)}px`;
      card.style.top = `${clamp(py - h / 2, safeTop, safeBottom - h)}px`;
    } else if (side) {
      const onRight = anchorX ? anchorX > 0 : px <= width / 2;
      card.style.left = `${clamp(onRight ? x + radius + 12 : x - radius - 12 - cardWidth, 12, width - cardWidth - 12)}px`;
      card.style.top = `${clamp(y + anchorY * scale - h / 2, safeTop, safeBottom - h)}px`;
    } else {
      const below = py <= (safeTop + safeBottom) / 2;
      card.style.left = `${clamp(x + anchorX * scale - cardWidth / 2, 12, width - cardWidth - 12)}px`;
      card.style.top = `${clamp(below ? y + radius + 12 : y - radius - 12 - h, safeTop, safeBottom - h)}px`;
    }
  }
  menu.style.setProperty("--radial-scale", scale);
  menu.style.setProperty("--radial-left", `${x - SIZE / 2}px`);
  menu.style.setProperty("--radial-top", `${y - SIZE / 2}px`);
}

import { state } from "./state.js";
import { TOWERS, ARMOR_CLASSES, DAMAGE_TYPES, ABILITIES } from "./config.js";
import { SPECIALIZATIONS } from "./specializations.js";
import { towerRange, towerDamage, towerRate, upgradeCost, sellValue, canUpgrade, canSpecialise, abilityCost, abilityDef, soldierCount, soldierHp, soldierDamage, specializationDef, skillRank, skillCost } from "./towers.js";
import { icon } from "./icons.js";

const ATTACK_ICONS = { physical: "sword", arrow: "bow", pierce: "ballista", siege: "bomb", magic: "sparkles" };
const ARMOR_ICONS = { light: "armorLight", plated: "armorPlated", fortified: "armorFortified", warded: "armorWarded" };
const price = (amount) => `<span class="purchase-price">${icon("coins")} ${amount}</span>`;
const stat = (label, value) => `<span class="stat"><small>${label}</small><b>${value}</b></span>`;
const disabled = (cost) => state.gold < cost ? "disabled" : "";
const heading = (title, note = "") => `<div class="section-heading"><h3>${title}</h3>${note ? `<span>${note}</span>` : ""}</div>`;
const armorBadge = (key, value = "") => `<span class="armor-badge armor-${key}">${icon(ARMOR_ICONS[key])}${ARMOR_CLASSES[key].name}${value ? `<b>${value}</b>` : ""}</span>`;


function panel(title, subtitle, emblem, meta, body, actions = "") {
  return `<header class="inspector-header"><span class="inspector-emblem">${icon(emblem)}</span>
    <div class="inspector-identity"><small>${subtitle}</small><h2>${title}</h2></div>${meta}
    <button class="inspector-close" data-action="close" aria-label="Close inspector" title="Close (Esc)">${icon("x")}</button></header>
    <div class="inspector-content">${body}</div>
    <footer class="inspector-actions">${actions || `<span class="inspector-tip">Select the map to close · Esc</span>`}</footer>`;
}

function armorGuide() {
  return `<details class="combat-guide"><summary>${icon("shield")} Armor & damage guide ${icon("chevronRight")}</summary>
    <div class="combat-guide-content"><p>Class matchups apply first. Armor amount then reduces damage according to penetration. Skills can use a different attack type.</p>
    ${Object.entries(ARMOR_CLASSES).map(([key, def]) => `<div>${armorBadge(key)}<span>${def.desc}</span></div>`).join("")}
    <p>Heavy piercing ignores half of armor amount; Siege ignores 75%; Arcane bypasses armor amount. Class resistance still applies.</p></div></details>`;
}

function attackProfile(type) {
  const matchups = Object.entries(ARMOR_CLASSES);
  const badges = (entries) => entries.map(([key, def]) => armorBadge(key, `×${def.multipliers[type]}`)).join("");
  const strong = matchups.filter(([, def]) => def.multipliers[type] > 1);
  const weak = matchups.filter(([, def]) => def.multipliers[type] < 1);
  const factor = DAMAGE_TYPES[type].armorFactor;
  const penetration = factor === 0 ? "Bypasses armor amount" : factor === 1 ? "Full armor amount applies" : `${Math.round((1 - factor) * 100)}% armor penetration`;
  return `<details class="combat-profile"><summary><span class="attack-symbol attack-${type}">${icon(ATTACK_ICONS[type])}</span><span class="attack-title"><small>Primary attack</small><strong>${DAMAGE_TYPES[type].name}</strong></span><span class="combat-disclosure">Matchups</span>${icon("chevronRight")}</summary>
    <div class="attack-details"><p class="matchup-note">${penetration}</p>
    ${strong.length ? `<div class="matchup-row favorable"><small>Effective vs</small><div>${badges(strong)}</div></div>` : ""}
    ${weak.length ? `<div class="matchup-row unfavorable"><small>Resisted by</small><div>${badges(weak)}</div></div>` : ""}
    <p class="matchup-note">Class multipliers, before armor amount.</p>${armorGuide()}</div></details>`;
}

function journey(tower) {
  return `<ol class="tower-journey" aria-label="Tower progression">${[1, 2, 3, 4].map((level) => `<li class="${tower.level >= level ? "complete" : ""} ${tower.level === level ? "current" : ""}"><span>${tower.level > level ? icon("check") : level}</span><small>${level === 4 ? "Specialize" : `Tier ${level}`}</small></li>`).join("")}</ol>`;
}

function unitArmor(tower, spec) {
  const amount = spec?.skills.chitin?.armor[skillRank(tower, "chitin")] ?? spec?.armor ?? 0;
  return `<div class="unit-armor">${icon("shield")}<span>${tower.specialization === "brood" ? "Adult" : "Unit"} armor</span><span class="armor-meter" aria-hidden="true"><i style="width:${amount * 100}%"></i></span><b>${Math.round(amount * 100)}%</b></div><p class="matchup-note">Reduces incoming monster attack damage.</p>`;
}

export function towerInspector(tower, tab) {
  const spec = specializationDef(tower), ability = spec || abilityDef(tower), def = tower.def;
  const unitLabel = tower.specialization === "brood" ? "Adults" : spec ? "Units" : "Soldiers";
  tab ||= canSpecialise(tower) || spec ? "upgrades" : "overview";
  let overview = `<div class="stats">` + (def.soldiers
    ? stat("Damage", soldierDamage(tower)) + stat("Health", soldierHp(tower)) + stat(unitLabel, soldierCount(tower))
    : stat("Damage", towerDamage(tower)) + stat("Range", towerRange(tower)) + stat("Rate", `${towerRate(tower).toFixed(2)}/s`)) + `</div>`;
  overview += `<p class="tower-description">${spec?.desc || def.desc}</p>`;
  overview += attackProfile(spec?.type || def.type);
  if (def.soldiers) overview += unitArmor(tower, spec);
  const tabs = `<div class="inspector-tabs" role="tablist" aria-label="Tower details">${["overview", "upgrades"].map((key) => `<button role="tab" id="inspector-tab-${key}" aria-controls="inspector-panel-${key}" aria-selected="${tab === key}" data-action="tab" data-tab="${key}">${key === "overview" ? "Overview" : "Upgrades"}</button>`).join("")}</div>`;
  let body = journey(tower) + tabs + `<section id="inspector-panel-overview" role="tabpanel" aria-labelledby="inspector-tab-overview" data-panel="overview" ${tab !== "overview" ? "hidden" : ""}>${overview}</section>`;
  let development = "", actions = "";
  if (canUpgrade(tower)) {
    const cost = upgradeCost(tower);
    development += heading("Development", `Next: tier ${tower.level + 1}`) + `<p class="section-note">Improve ${def.soldiers ? "your squad's health, damage and rally range" : "damage, range and attack rate"}. Specialize after tier 3.</p>`;
    actions += `<button class="pill primary" data-action="upgrade" data-cost="${cost}" ${disabled(cost)}>${icon("plus")} Upgrade ${price(cost)}</button>`;
  } else if (canSpecialise(tower)) {
    const choices = SPECIALIZATIONS[tower.type] || ABILITIES[tower.type];
    development += heading("Choose your path", "One specialization") + `<p class="section-note">${SPECIALIZATIONS[tower.type] ? "Each path has its own independently upgradeable skills." : "Choose how this tower will fight at level 4."}</p><div class="specializations">`;
    for (const [key, choice] of Object.entries(choices)) {
      const cost = choice.cost ?? abilityCost(tower), action = SPECIALIZATIONS[tower.type] ? "specialize" : "ability";
      development += `<button class="specialization ${action === "ability" ? "tile" : ""}" data-action="${action}" data-${action === "ability" ? "ability" : "specialization"}="${key}" data-cost="${cost}" ${disabled(cost)}>
        <span class="skill-heading"><span class="path-symbol">${icon(choice.icon)}</span><strong>${choice.name}</strong>${price(cost)}</span>
        <span class="skill-desc">${choice.desc}</span>${choice.skills ? `<span class="path-skills">${Object.values(choice.skills).map((skill) => `<span>${skill.name}</span>`).join("")}</span>` : ""}</button>`;
    }
    development += `</div>`;
  } else if (spec) {
    development += heading("Skill branches", "Upgrade independently") + `<div class="skills">`;
    for (const [key, skill] of Object.entries(spec.skills)) {
      const rank = skillRank(tower, key), cost = skillCost(tower, key), maxed = cost === null;
      const pips = `<span class="skill-ranks" role="img" aria-label="Rank ${rank} of ${skill.costs.length}">${skill.costs.map((_, i) => `<i class="${i < rank ? "trained" : ""}"></i>`).join("")}</span>`;
      development += `<button class="skill ${maxed ? "maxed" : ""}" data-action="skill" data-skill="${key}" ${maxed ? "disabled" : `data-cost="${cost}" ${disabled(cost)}`}>
        <span class="skill-heading"><strong>${skill.name}</strong>${pips}<b>${rank}/${skill.costs.length}</b></span>
        ${rank ? `<span class="skill-current">Current · ${skill.descriptions[rank - 1]}</span>` : ""}
        ${maxed ? `<span class="skill-next"><span>Fully trained</span>${icon("check")}</span>` : `<span class="skill-desc">Next · ${skill.descriptions[rank]}</span><span class="skill-next"><span>${rank ? "Improve" : "Learn"} ${skill.name}</span>${price(cost)}</span>`}</button>`;
    }
    development += `</div>`;
  } else {
    development += heading("Specialization", "Complete") + `<p class="section-note">${ability?.desc || "Fully upgraded."}</p>`;
  }
  body += `<section id="inspector-panel-upgrades" role="tabpanel" aria-labelledby="inspector-tab-upgrades" data-panel="upgrades" ${tab !== "upgrades" ? "hidden" : ""}>${development}</section>`;
  if (def.soldiers) actions += `<button class="pill" data-action="rally" title="Move rally point">${icon("flag")} Rally</button>`;
  actions += `<button class="pill sell" data-action="sell" title="Sell for ${sellValue(tower)} gold">${icon("coins")} Sell <b>+${sellValue(tower)}</b></button>`;
  return panel(ability?.name || def.name, ability ? def.name : "Tower inspector", ability?.icon || def.icon, `<span class="inspector-level">Lv ${tower.level}</span>`, body, actions);
}

export function buildInspector() {
  const cards = Object.entries(TOWERS).map(([key, def]) => `<button class="tile build-card" data-action="build" data-type="${key}" data-cost="${def.cost}" data-desc="${def.desc}" ${disabled(def.cost)}>
    <span class="build-card-top"><span class="big">${icon(def.icon)}</span>${price(def.cost)}</span><span class="nm">${def.short || def.name}</span><span class="build-attack">${icon(ATTACK_ICONS[def.type])}${DAMAGE_TYPES[def.type].name}</span><span class="skill-desc">${def.desc}</span></button>`).join("");
  return panel("Build a tower", "An empty foundation", "plus", "", heading("Choose your defense") + `<div class="grid build-grid">${cards}</div>`, `<span class="hint">${icon("range")} Pick a tower to preview its range</span>`);
}

export function enemyInspector(enemy) {
  const def = enemy.def, key = def.armorClass || "light", armorClass = ARMOR_CLASSES[key];
  const name = enemy.type[0].toUpperCase() + enemy.type.slice(1);
  const counter = Object.entries(DAMAGE_TYPES).filter(([type]) => armorClass.multipliers[type] > 1).map(([type, attack]) => `<span class="attack-badge">${icon(ATTACK_ICONS[type])}${attack.name}<b>×${armorClass.multipliers[type]}</b></span>`).join("");
  const resist = Object.entries(DAMAGE_TYPES).filter(([type]) => armorClass.multipliers[type] < 1).map(([type, attack]) => `<span class="attack-badge">${icon(ATTACK_ICONS[type])}${attack.name}<b>×${armorClass.multipliers[type]}</b></span>`).join("");
  const body = `<div class="enemy-class">${armorBadge(key)}<span>${def.flying ? "Airborne" : "Ground"}</span></div><div class="stats">${stat("Base health", def.hp)}${stat("Armor amount", `${Math.round(def.armor * 100)}%`)}${stat("Speed", def.speed)}</div><p class="tower-description">${armorClass.desc}</p>
    ${heading("Defenses")}<div class="matchup-row favorable"><small>Counter with</small><div>${counter || "No class weakness"}</div></div>${resist ? `<div class="matchup-row unfavorable"><small>Resists</small><div>${resist}</div></div>` : ""}<p class="matchup-note">Class multipliers, before armor amount.</p>${armorGuide()}`;
  return panel(name, "Monster inspector", ARMOR_ICONS[key], "", body);
}

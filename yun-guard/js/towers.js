import { TOWERS, MAX_LEVEL, UPGRADE_COST_FACTOR, ABILITIES, ABILITY_COST_FACTOR, W, H } from "./config.js";
import { closestPointOnPath, clamp } from "./util.js";
import { map } from "./map.js";
import { SPECIALIZATIONS } from "./specializations.js";

const damageAt = (t, level) => t.def.damage * (1 + 0.6 * (level - 1));
const rateAt = (t, level) => t.def.rate * (1 + 0.08 * (level - 1));
const rangeAt = (t, level) => t.def.range + 18 * (level - 1);
const hpAt = (t, level) => Math.round(t.def.soldierHp * (1 + 0.6 * (level - 1)));

// Retained crews and guards use the same tier scaling as ordinary upgrades.
export const foundationDamage = (t) => Math.round(damageAt(t, 3));
export const foundationRate = (t) => rateAt(t, 3);
export const foundationRange = (t) => rangeAt(t, 3);
export const foundationHp = (t) => hpAt(t, 3);
export const escortCount = (t) => specializationDef(t)?.escorts || 0;

// Ordinary tiers scale base stats; specializations can define their own attack loop.
const FINAL = (t) => (t.level >= MAX_LEVEL ? 1 : 0);
export const towerRange = (t) => specializationDef(t)?.range ?? rangeAt(t, t.level) + 20 * FINAL(t);
export const towerDamage = (t) => specializationDef(t)?.damage ?? Math.round(damageAt(t, t.level) * (1 + 0.2 * FINAL(t)));
export const towerRate = (t) => specializationDef(t)?.rate ?? rateAt(t, t.level) * (1 + 0.15 * FINAL(t));
export const upgradeCost = (t) => Math.round(t.def.cost * UPGRADE_COST_FACTOR * t.level);
export const sellValue = (t) => Math.round(t.spent * 0.7);
export const canUpgrade = (t) => t.level < MAX_LEVEL - 1;               // plain upgrades up to level 3 ...
export const canSpecialise = (t) => t.level === MAX_LEVEL - 1;         // ... then choose an ability or specialization for level 4
export const abilityCost = (t) => Math.round(t.def.cost * ABILITY_COST_FACTOR);
export const specializationDef = (t) => SPECIALIZATIONS[t.type]?.[t.specialization] || null;
export const abilityDef = (t) => (t.ability ? ABILITIES[t.type]?.[t.ability] : null);
export const skillRank = (t, key) => t.skills?.[key] || 0;
export const skillCost = (t, key) => specializationDef(t)?.skills[key]?.costs[skillRank(t, key)] ?? null;
export function specialize(t, key) {
  const def = SPECIALIZATIONS[t.type]?.[key];
  if (!def || !canSpecialise(t)) return false;
  t.specialization = key; t.skills = {}; t.level = MAX_LEVEL;
  // Promote units in place: no teleport, free revive, lost wounds or gap in blocking.
  t.soldiers.forEach((soldier, index) => {
    soldier.escort = !!def.escorts && (key === "cloud" || index >= def.count);
  });
  t.hatchCd = null;
  t.cd = 0;
  t.spent += def.cost;
  return true;
}
export function trainSkill(t, key) {
  const cost = skillCost(t, key);
  if (cost === null) return false;
  t.skills[key] = skillRank(t, key) + 1;
  t.spent += cost;
  return true;
}
export const visLevel = (t) => Math.min(t.level, 3);                   // ordinary art has three tiers; paths provide their own art

// Archer structures stay close to the build pad width; projectiles use the same visual scale.
export const ARCHER_ART_SCALE = 0.75;
export const falconPerch = (t, index) => ({ x: t.x + (index ? 31 : -31) * ARCHER_ART_SCALE, y: t.y - 76 * ARCHER_ART_SCALE });
export const moonbowOrigin = (t) => ({ x: t.x + 35 * ARCHER_ART_SCALE, y: t.y - 68 * ARCHER_ART_SCALE });

// How tall the ranged towers are (used for drawing and for where shots start).
export const archerHeight = (lv) => 34 + Math.min(lv, 3) * 6;
export const mageHeight = (lv) => 36 + Math.min(lv, 3) * 6;
export const teslaHeight = (lv) => 34 + Math.min(lv, 3) * 8;
export const ballistaHeight = (lv) => 30 + Math.min(lv, 3) * 6;

// Where each archer stands on the platform: one girl at level 1, two at level 2, three at level 3.
export const archerSlots = (lv) =>
  lv === 1 ? [{ dx: 0, dy: 0 }]
  : lv === 2 ? [{ dx: -8, dy: 0 }, { dx: 8, dy: 0 }]
  : [{ dx: -11, dy: 0 }, { dx: 0, dy: -7 }, { dx: 11, dy: 0 }];

// Where a shot leaves the tower: the active archer's bow, the wizard's staff, or the cannon barrel.
export function shotOrigin(t) {
  if (t.def === TOWERS.archer) {
    const slots = archerSlots(t.level), s = slots[t.shooter % slots.length];
    return { x: t.x + s.dx * ARCHER_ART_SCALE, y: t.y + (-archerHeight(t.level) - 20 + s.dy) * ARCHER_ART_SCALE };
  }
  if (t.def === TOWERS.mage) return { x: t.x + 10, y: t.y - mageHeight(t.level) - 34 };
  if (t.def === TOWERS.ballista) return { x: t.x + Math.cos(t.angle) * 14, y: t.y - ballistaHeight(t.level) + Math.sin(t.angle) * 6 };
  if (t.def === TOWERS.tesla) return { x: t.x, y: t.y - teslaHeight(t.level) - 12 };
  return { x: t.x, y: t.y - 26 };
}

// Move a barracks' rally point. If the click is outside the barracks' range,
// the flag is placed on the edge of the range in that direction.
export function setRally(t, p) {
  const r = towerRange(t);
  const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy);
  const k = d > r ? r / d : 1;
  t.rally = { x: clamp(t.x + dx * k, 12, W - 12), y: clamp(t.y + dy * k, 16, H - 8) };
}

export const soldierCount = (t) => specializationDef(t)?.count ?? t.def.soldiers + (t.level >= 3 ? 1 : 0);
export const soldierHp = (t) => {
  const spec = specializationDef(t);
  if (spec) return spec.skills.chitin?.hp[skillRank(t, "chitin")] ?? spec.skills.stoneheart?.hp[skillRank(t, "stoneheart")] ?? spec.hp;
  return hpAt(t, t.level);
};
export const soldierDamage = (t) => specializationDef(t)?.skills.earthbreaker?.damage[skillRank(t, "earthbreaker")] ?? specializationDef(t)?.damage ?? towerDamage(t);
export const soldierRate = (t) => specializationDef(t)?.skills.earthbreaker?.rate[skillRank(t, "earthbreaker")] ?? specializationDef(t)?.rate ?? towerRate(t);

export function createTower(spotIndex, type) {
  const s = map.spots[spotIndex];
  const def = TOWERS[type];
  const t = { spot: spotIndex, type, x: s.x, y: s.y, def, level: 1, cd: 0, spent: def.cost, soldiers: [], angle: -Math.PI / 2, anim: 0, recoil: 0, shooter: 0 };
  if (def.soldiers) {
    // Rally on whichever road is nearest
    const p = map.paths.map((path) => closestPointOnPath(path, t)).sort((a, b) => a.d - b.d)[0];
    t.rally = { x: p.x, y: p.y };
  }
  return t;
}

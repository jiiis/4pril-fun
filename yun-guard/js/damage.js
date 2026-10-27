import { ARMOR_CLASSES, DAMAGE_TYPES } from "./config.js";

// Class matchup and armor amount are independent. Penetration reduces only armor amount, never class resistance.
export function damageMultiplier(def, type) {
  const armorClass = ARMOR_CLASSES[def.armorClass] || ARMOR_CLASSES.light;
  const attack = DAMAGE_TYPES[type];
  const armor = Math.max(0, Math.min(1, def.armor || 0));
  return (armorClass.multipliers[type] ?? 1) * (1 - armor * (attack?.armorFactor ?? 0));
}

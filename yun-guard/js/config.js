// ============================================================
//  GAME SETTINGS - change these to make the game your own!
// ============================================================

export const W = 1440;                  // a bigger world than the screen: you pan around it
export const H = 840;

export const START_GOLD = 400;
export const START_LIVES = 20;
export const TOTAL_WAVES = 15;
export const WAVE_BREAK = 26;          // seconds until the next wave comes by itself, counting from when the current wave has fully appeared
export const CALL_AT = 0.6;            // the next wave may be called once this share of the current wave has entered
export const SOLDIER_RESPAWN = 8;      // seconds for a fallen soldier to come back
export const ENGAGE_RANGE = 50;        // how far from their rally point soldiers will chase
export const ROAD_WIDTH = 84;           // average width; the drawn road wanders within ±10%
export const ROAD_EDGE = ROAD_WIDTH * 0.55 + 8;    // how far from the centre line the drawn road (at its widest, +10%) plus its earthen bank reaches
export const ENEMY_SCALE = 0.68;         // monsters are drawn at this fraction of their original artwork size
// Visual adjustment for ambient animals and their remains; foxes and fish keep their current size.
export function critterSizeFactor(type) {
  if (type === "fox" || type === "fish") return 1;
  return type === "deer" || type === "cow" ? 0.9 : 0.8;
}
export const SPOT_RADIUS = 19;          // size of the stone build pads

// The world is generated randomly on a grid every time the game starts (see map.js).
// The road, build spots, scenery and animals all come from that generator.
export const CELL = 60;                 // grid cell size in pixels
export const COLS = W / CELL;           // 24
export const ROWS = H / CELL;           // 14

// Armor class determines matchups; armor amount then mitigates the attack according to its penetration.
// Keep these values and all balance changes documented in ../BALANCE.md.
export const DAMAGE_TYPES = {
  physical: { name: "Steel", armorFactor: 1 },
  arrow:    { name: "Piercing", armorFactor: 1 },
  pierce:   { name: "Heavy piercing", armorFactor: 0.5 },
  siege:    { name: "Siege", armorFactor: 0.25 },
  magic:    { name: "Arcane", armorFactor: 0 },
};
export const ARMOR_CLASSES = {
  light: {
    name: "Light", desc: "Piercing attacks excel. No class resistance.",
    multipliers: { physical: 1, arrow: 1.2, pierce: 1.2, siege: 1, magic: 1 },
  },
  plated: {
    name: "Plated", desc: "Resists arrows and blades. Counter with arcane attacks.",
    multipliers: { physical: 0.85, arrow: 0.8, pierce: 0.8, siege: 1, magic: 1.4 },
  },
  fortified: {
    name: "Fortified", desc: "Resists projectiles and arcane attacks. Counter with siege damage.",
    multipliers: { physical: 0.8, arrow: 0.65, pierce: 0.65, siege: 1.5, magic: 0.65 },
  },
  warded: {
    name: "Warded", desc: "Resists arcane attacks. Counter with steel or piercing attacks.",
    multipliers: { physical: 1.2, arrow: 1.2, pierce: 1.2, siege: 1.1, magic: 0.6 },
  },
};

// Tower attack patterns and armor matchups are separate: splash and chains do not bypass class resistance.
export const TOWERS = {
  archer:   { name: "Archer Tower", short: "Archer", icon: "bow", cost: 70,  range: 150, damage: 10, rate: 1.7,  type: "arrow", color: "#8bc34a", desc: "Fast piercing arrows. Strong vs light and warded; weak vs plating." },
  mage:     { name: "Mage Tower",   short: "Mage", icon: "sparkles", cost: 100, range: 136, damage: 26, rate: 0.85, type: "magic",    color: "#b388ff", desc: "Arcane bolts counter plating. Warded and fortified enemies resist." },
  cannon:   { name: "Cannon",       short: "Cannon", icon: "bomb", cost: 125, range: 162, damage: 36, rate: 0.5,  type: "siege", color: "#6d4c41", desc: "Siege blasts counter fortified groups. Cannot hit flyers.", splash: 48 },
  // Lightning Spire: chain lightning leaps from the first monster to the next few nearby (one more hop per level). Reaches flyers.
  tesla:    { name: "Lightning Spire", short: "Spire", icon: "zap", cost: 140, range: 143, damage: 24, rate: 0.6, type: "magic", color: "#4fc3f7", desc: "Arcane lightning chains through groups. Warded and fortified enemies resist.", chain: 3, chainRange: 70, chainFalloff: 0.75 },
  // Ballista: slow and very long-ranged. One huge bolt flies through the target and on, hitting every monster along the line,
  // and punches through most armour. Reaches flyers.
  ballista: { name: "Ballista",     short: "Ballista", icon: "ballista", cost: 170, range: 192, damage: 62, rate: 0.25, type: "pierce", color: "#a1887f", desc: "Heavy piercing bolts hit a line and ignore half of armor amount. Slow.", line: true, lineWidth: 9 },
  // Barracks: range = how far away the soldiers' rally point can be. damage/rate = each soldier's attack.
  barracks: { name: "Barracks",     short: "Barracks", icon: "shield", cost: 90,  range: 117,  damage: 6,  rate: 1,    type: "physical", color: "#ef9a9a", desc: "Soldiers block ground enemies. Steel counters wards; plating resists.", soldiers: 2, soldierHp: 80 },
};
export const MAX_LEVEL = 4;
// Level 4 offers an ability, or a specialization with independently ranked skills.
export const ABILITY_COST_FACTOR = 1.2;   // ability price = tower cost × this
export const ABILITIES = {
  mage: {
    storm:  { name: "Arcane Storm", icon: "tornado", desc: "Bolts burst on impact, hitting everything within 36.", splash: 36 },
    curse:  { name: "Curse", icon: "skull", desc: "Cursed monsters take 40% more damage from everything for 4s.", curse: { time: 4, factor: 1.4 } },
  },
  cannon: {
    cluster:{ name: "Cluster Bombs", icon: "burst", desc: "Each shell scatters 3 bomblets around the impact.", bomblets: 3, bombletDamage: 0.45, bombletSplash: 30 },
    napalm: { name: "Napalm", icon: "flame", desc: "Shells leave burning ground for 4s: 10 dmg/s to anything walking through.", fire: { time: 4, dps: 10, radius: 40 } },
  },
  ballista: {
    execute: { name: "Executioner", icon: "skull", desc: "Bolts deal double damage to any monster below 25% health.", execute: { below: 0.25, factor: 2 } },
    harpoon: { name: "Harpoons", icon: "anchor", desc: "Every monster hit is slowed 50% for 3s; the first one is pinned almost still.", pin: { slow: 0.5, time: 3, firstSlow: 0.85, firstTime: 1.6 } },
  },
  tesla: {
    overcharge: { name: "Overcharge", icon: "zap", desc: "Lightning makes 3 more hops and leaps 40% further.", extraHops: 3, rangeFactor: 1.4 },
    field:  { name: "Static Field", icon: "radio", desc: "Everything in range is slowed 25% and zapped for 4 dmg/s.", field: { slow: 0.25, dps: 4 } },
  },
};
// Level 3 archer towers shoot fire arrows: the monster keeps burning after the hit.
export const FIRE_ARROW = { burnTime: 3, burnDps: 7 };   // Arcane burning: bypasses armor amount; class resistance still applies
export const UPGRADE_COST_FACTOR = 0.6;   // upgrade price = tower cost × this × current level
export const CORPSE_TIME = 7;             // seconds a fallen monster stays on the road

// April: click her, then click anywhere to send her there. She fights whatever comes close.
export const APRIL = {
  name: "April",
  hp: 260, damage: 16, rate: 1.3,   // hits per second
  speed: 115, armor: 0.3,
  engage: 70,                       // how far she will chase a monster from where she stands (sword only)
  // Levelling: kills she (or Max) lands earn XP. Each level adds damage and health.
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
  regen: 5,                         // HP healed per second while resting
  respawn: 12,                      // seconds to return after falling
};

// Avril: an archer. Light on her feet and weak up close, but she
// shoots frost arrows that slow monsters and slowly heals friends near her.
export const AVRIL = {
  name: "Avril",
  hp: 190, damage: 8, rate: 1.1,
  speed: 110, armor: 0.1,
  engage: 40,
  ranged: { kind: "bow", range: 160, damage: 14, rate: 1.15 },   // she shoots at anything further away than melee reach
  frost: { slow: 0.35, slowPerLevel: 0.03, time: 2.2 },          // hit monsters are slowed; colder with her level
  healRange: 90, healPerSecond: 3,                   // soothes soldiers, April and Max nearby
  regen: 6,
  respawn: 12,
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
};

// Her eagle. He circles above her and dives on monsters near her. Being airborne, he can even strike flying monsters.
export const EAGLE = {
  name: "Sky",
  damage: 7, rate: 0.9,             // a dive every so often
  engage: 110,                      // attacks monsters this close to Avril
  speed: 220,
  kind: "eagle",
};

// Candice: a young fire mage. Fragile, but her fireballs splash and set monsters ablaze. Her baby dragon breathes fire from above.
export const EMBER = {
  name: "Candice",
  hp: 170, damage: 7, rate: 1.0,
  speed: 100, armor: 0.05,
  engage: 36,
  ranged: { kind: "fire", range: 150, damage: 20, rate: 0.8, splash: 34, burnTime: 2.5, burnDps: 6 },
  regen: 6,
  respawn: 12,
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
};

// Willow: a forest druid. Every few seconds her vines root every monster near her, and her bear holds the line.
export const WILLOW = {
  name: "Willow",
  hp: 230, damage: 11, rate: 1.1,
  speed: 108, armor: 0.2,
  engage: 55,
  root: { range: 95, every: 6, duration: 2.4 },     // vines burst from the ground and hold monsters still
  regen: 7,
  respawn: 12,
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
};

// 寒 (Hán): a cool, elegant warrior in frost-white hanfu. Her sword sweeps through several monsters at once, and her loong rides the wind above her.
export const MEILIN = {
  name: "寒 Hán",
  hp: 240, damage: 13, rate: 1.2,
  speed: 112, armor: 0.25,
  engage: 65,
  cleave: { extra: 2, reach: 34, factor: 0.7 },     // each strike also hits up to 2 more monsters nearby for 70% damage
  regen: 5,
  respawn: 12,
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
};

// Adrien: a gallant paladin in white and gold. When a monster is near but not yet at his lance's point he
// lowers it and charges, running every monster in his path through and leaving them reeling. His lion Leon fights beside him.
export const ADRIEN = {
  name: "Adrien",
  hp: 280, damage: 14, rate: 1.1,
  speed: 112, armor: 0.35,
  engage: 75,
  charge: { every: 6, range: 120, min: 40, speed: 460, factor: 1.8, stun: 1.0, width: 24 },   // the lance charge
  regen: 5,
  respawn: 12,
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
};

export const HERO_KINDS = { april: APRIL, avril: AVRIL, ember: EMBER, willow: WILLOW, meilin: MEILIN, adrien: ADRIEN };

// Leon, Adrien's lion. Proud and fierce: slower than the dog but hits harder and takes more.
export const LION = {
  name: "Leon",
  hp: 210, damage: 13, rate: 1.1,
  speed: 150, armor: 0.2,
  follow: 30,
  engage: 75,
  regen: 6,
  respawn: 9,
  kind: "lion",
};

// Yun (云), Mei Lin's loong. A long serpentine dragon that coils through the sky, then dives and
// sweeps along the road, striking every monster in its path. It can reach flying monsters.
export const LOONG = {
  name: "Yun",
  damage: 10, rate: 0.35,           // one sweep every ~3 seconds
  engage: 130,
  speed: 260,
  kind: "loong",
};

// Cinder, Candice's baby dragon. Circles above her and spits little fireballs at monsters near her (flying ones too).
export const DRAGON = {
  name: "Cinder",
  damage: 6, rate: 0.7, splash: 22, burnTime: 1.5, burnDps: 5,
  engage: 120,
  speed: 170,
};

// Bramble, Willow's bear. Big, slow and very hard to move: he holds monsters in place while she works.
export const BEAR = {
  name: "Bramble",
  hp: 300, damage: 15, rate: 0.9,
  speed: 125, armor: 0.25,
  follow: 30,
  engage: 80,
  regen: 7,
  respawn: 10,
};

// Her German Shepherd. He follows her around and bites anything that comes close to her.
export const DOG = {
  name: "Max",
  hp: 130, damage: 9, rate: 1.6,
  speed: 160, armor: 0.1,
  follow: 26,                       // how far behind her he trots
  engage: 70,                       // attacks monsters this close to April
  regen: 6,
  respawn: 8,
  kind: "dog",
};
BEAR.kind = "bear";
DRAGON.kind = "dragon";

// Monster types. armor is mitigation amount before attack penetration; armorClass supplies the matchup multiplier.
// attack = damage to soldiers per hit.
// Special traits:
//   flying      - soars over soldiers and heroes; cannon and ground melee cannot reach it
//   armorClass  - class matchup, separate from armor amount; frostImmune - cannot be chilled
//   healAura    - heals other monsters within healRange by that much per second
export const ENEMIES = {
  // Every monster is the same on every level and in every wave: these numbers never scale (and they are
  // tough: with slow, sparse waves the challenge comes from each monster taking real punishment).
  // Speeds are slow (a goblin takes a long while to cross the map); the kinds still differ a lot.
  goblin:   { hp: 362,  speed: 30,  armor: 0,   armorClass: "light", gold: 10,  lives: 1, attack: 19,  size: 18 },
  wolf:     { hp: 273,  speed: 52,  armor: 0,   armorClass: "light", gold: 13,  lives: 1, attack: 25,  size: 20 },
  bat:      { hp: 254,  speed: 42,  armor: 0,   armorClass: "light", gold: 13,  lives: 1, attack: 12,  size: 18, flying: true },
  orc:      { hp: 1269, speed: 20,  armor: 0.4, armorClass: "plated", gold: 26, lives: 2, attack: 46, size: 25 },
  skeleton: { hp: 815,  speed: 24,  armor: 0.6, armorClass: "plated", gold: 23, lives: 1, attack: 32, size: 20, frostImmune: true },
  shaman:   { hp: 998, speed: 22,  armor: 0.1, armorClass: "warded", gold: 36, lives: 1, attack: 24,  size: 20, healAura: 6, healRange: 70 },
  golem:    { hp: 4712, speed: 12,  armor: 0.7, armorClass: "fortified", gold: 90, lives: 3, attack: 90, size: 31, frostImmune: true, brambleResistance: 0.5 },
  troll:    { hp: 8156, speed: 16,  armor: 0.3, armorClass: "light", gold: 153, lives: 5, attack: 113, size: 38, brambleResistance: 0.5 },
  //   split       - when killed, bursts into that many smaller monsters
  //   steals      - instead of costing lives, it runs off with this much gold if it reaches the castle
  //   raise       - necromancers turn a nearby corpse into a skeleton every few seconds
  slime:      { hp: 635,  speed: 25,  armor: 0,   armorClass: "light", gold: 13,  lives: 1, attack: 17,  size: 19, split: { type: "slimeling", count: 2 }, noCorpse: true },
  slimeling:  { hp: 200,  speed: 38,  armor: 0,   armorClass: "light", gold: 5,  lives: 1, attack: 10,  size: 11, noCorpse: true },
  thief:      { hp: 500,  speed: 48,  armor: 0,   armorClass: "light", gold: 36, lives: 0, attack: 17,  size: 18, steals: 25 },
  necromancer:{ hp: 1450, speed: 18,  armor: 0.1, armorClass: "warded", gold: 62, lives: 2, attack: 29,  size: 22, raise: { every: 5, range: 90 } },
  wyvern:     { hp: 2538, speed: 27,  armor: 0.2, armorClass: "plated", gold: 82, lives: 3, attack: 58, size: 30, flying: true },
};

// What appears in each wave, weakest kinds first and the nastiest last. n = wave number (1, 2, 3 ...).
// Levels get harder only through what shows up and how many: on higher levels the tougher kinds are
// judged as if the wave were later (shift) and every group is a little bigger (count).
export function makeWave(n, d = { count: 1, shift: 0 }) {
  const m = n + d.shift, groups = [];
  const add = (type, count, gap) => groups.push({ type, count: Math.max(1, Math.round(count * d.count)), gap });
  add("goblin", 3 + n, 1.6);
  if (m >= 2) add("wolf", Math.ceil(m / 2) + 1, 1.0);
  if (m >= 3) add("bat", Math.ceil(m / 3) + 1, 1.2);
  if (m >= 5) add("slime", Math.ceil(m / 4), 1.8);
  if (m >= 4) add("thief", 1 + Math.floor(m / 8), 1.6);
  if (m >= 4) add("orc", Math.ceil(m / 3), 2.4);
  if (m >= 6) add("skeleton", Math.ceil(m / 4), 2.0);
  if (m >= 6) add("shaman", 1 + Math.floor((m - 6) / 4), 3.5);
  if (m >= 9 && m % 2 === 1) add("necromancer", 1 + Math.floor((m - 9) / 6), 5);
  if (m >= 8 && m % 2 === 0) add("golem", Math.ceil(m / 8), 6);
  if (m >= 10 && m % 2 === 0) add("wyvern", Math.ceil((m - 8) / 4), 4.5);
  if (n % 5 === 0) add("troll", Math.ceil(m / 8), 6);
  return groups;
}

// Spawn times for a wave. Monsters come in small bunches of two to four with only a short gap between the ones in a
// bunch, then a pause before the next bunch (shorter in the thick of the wave, longer at its ends). The big brutes
// travel alone or in pairs.
export function waveTimeline(groups) {
  const list = [];
  for (const g of groups) for (let i = 0; i < g.count; i++) list.push({ type: g.type, gap: g.gap });
  const N = list.length, out = [];
  let t = 0, i = 0;
  while (i < N) {
    const heavy = list[i].gap >= 4;
    const size = Math.min(N - i, heavy ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3));
    for (let k = 0; k < size; k++) { out.push({ type: list[i + k].type, at: t }); t += Math.min(0.9, list[i + k].gap * 0.45) * (0.8 + Math.random() * 0.4); }
    i += size;
    const bell = Math.sin(Math.PI * (i + 0.5) / N);                  // 0 at the ends, 1 in the middle
    t += (heavy ? 4.2 : 3.2) * (1.35 - 0.55 * bell) * (0.85 + Math.random() * 0.3);
  }
  return out;
}

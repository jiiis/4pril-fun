// ============================================================
//  GAME SETTINGS - change these to make the game your own!
// ============================================================

export const W = 1440;                  // a bigger world than the screen: you pan around it
export const H = 840;

export const START_GOLD = 400;
export const START_LIVES = 20;
export const TOTAL_WAVES = 15;
export const WAVE_BREAK = 9;           // seconds between waves (the countdown starts as soon as a wave has finished appearing)
export const SOLDIER_RESPAWN = 8;      // seconds for a fallen soldier to come back
export const ENGAGE_RANGE = 50;        // how far from their rally point soldiers will chase
export const ROAD_WIDTH = 64;           // average width; the drawn road wanders around this
export const SPOT_RADIUS = 19;          // size of the stone build pads

// The world is generated randomly on a grid every time the game starts (see map.js).
// The road, build spots, scenery and animals all come from that generator.
export const CELL = 60;                 // grid cell size in pixels
export const COLS = W / CELL;           // 24
export const ROWS = H / CELL;           // 14

// Tower types. "physical" damage is reduced by armour, "magic" is not.
export const TOWERS = {
  archer:   { name: "Archer Tower", short: "Archer", icon: "bow", cost: 70,  range: 115, damage: 10, rate: 1.7,  type: "physical", color: "#8bc34a", desc: "Fast arrows. Weak vs armour." },
  mage:     { name: "Mage Tower",   short: "Mage", icon: "sparkles", cost: 100, range: 105, damage: 26, rate: 0.85, type: "magic",    color: "#b388ff", desc: "Magic ignores armour." },
  cannon:   { name: "Cannon",       short: "Cannon", icon: "bomb", cost: 125, range: 125, damage: 36, rate: 0.5,  type: "physical", color: "#6d4c41", desc: "Slow, but hits a whole group.", splash: 48 },
  // Lightning Spire: chain lightning leaps from the first monster to the next few nearby (one more hop per level). Reaches flyers.
  tesla:    { name: "Lightning Spire", short: "Spire", icon: "zap", cost: 140, range: 110, damage: 24, rate: 0.6, type: "magic", color: "#4fc3f7", desc: "Chain lightning jumps between monsters.", chain: 3, chainRange: 70, chainFalloff: 0.75 },
  // Barracks: range = how far away the soldiers' rally point can be. damage/rate = each soldier's attack.
  barracks: { name: "Barracks",     short: "Barracks", icon: "shield", cost: 90,  range: 90,  damage: 6,  rate: 1,    type: "physical", color: "#ef9a9a", desc: "Soldiers block the road.", soldiers: 2, soldierHp: 80 },
};
export const MAX_LEVEL = 4;
// Level 4 is a specialisation: at level 3 you pick one of two abilities. Each tower type has its own pair.
export const ABILITY_COST_FACTOR = 1.2;   // ability price = tower cost × this
export const ABILITIES = {
  archer: {
    volley: { name: "Rapid Volley", icon: "chevrons", desc: "Every archer looses two arrows at once." },
    poison: { name: "Venom Arrows", icon: "skull", desc: "Arrows poison: 7 dmg/s for 4s, ignores armour, slows 15%.", poison: { time: 4, dps: 7, slow: 0.15 } },
  },
  mage: {
    storm:  { name: "Arcane Storm", icon: "tornado", desc: "Bolts burst on impact, hitting everything within 36.", splash: 36 },
    curse:  { name: "Curse", icon: "skull", desc: "Cursed monsters take 40% more damage from everything for 4s.", curse: { time: 4, factor: 1.4 } },
  },
  cannon: {
    cluster:{ name: "Cluster Bombs", icon: "burst", desc: "Each shell scatters 3 bomblets around the impact.", bomblets: 3, bombletDamage: 0.45, bombletSplash: 30 },
    napalm: { name: "Napalm", icon: "flame", desc: "Shells leave burning ground for 4s: 10 dmg/s to anything walking through.", fire: { time: 4, dps: 10, radius: 40 } },
  },
  barracks: {
    paladin:{ name: "Paladins", icon: "shieldCheck", desc: "Soldiers get +50% health, 30% armour and heal 5/s even in battle.", hpFactor: 1.5, armor: 0.3, regen: 5 },
    berserk:{ name: "Berserkers", icon: "axe", desc: "Soldiers hit 60% harder, 30% faster, and every swing cleaves nearby monsters.", damageFactor: 1.6, rateFactor: 1.3, cleave: 26 },
  },
  tesla: {
    overcharge: { name: "Overcharge", icon: "zap", desc: "Lightning makes 3 more hops and leaps 40% further.", extraHops: 3, rangeFactor: 1.4 },
    field:  { name: "Static Field", icon: "radio", desc: "Everything in range is slowed 25% and zapped for 4 dmg/s.", field: { slow: 0.25, dps: 4 } },
  },
};
// Level 3 archer towers shoot fire arrows: the monster keeps burning after the hit.
export const FIRE_ARROW = { burnTime: 3, burnDps: 7 };   // seconds of burning, damage per second (ignores armour)
export const UPGRADE_COST_FACTOR = 0.6;   // upgrade price = tower cost × this × current level
export const CORPSE_TIME = 7;             // seconds a fallen monster stays on the road

// The hero: click her, then click anywhere to send her there. She fights whatever comes close.
export const HERO = {
  name: "Lady April",
  hp: 260, damage: 16, rate: 1.3,   // hits per second
  speed: 115, armor: 0.3,
  engage: 70,                       // how far she will chase a monster from where she stands (sword only)
  // Levelling: kills she (or Max) lands earn XP. Each level adds damage and health.
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
  regen: 5,                         // HP healed per second while resting
  respawn: 12,                      // seconds to return after falling
};

// Princess Avril: an archer princess. Light on her feet and weak up close, but she
// shoots frost arrows that slow monsters and slowly heals friends near her. Key 2 selects her.
export const AVRIL = {
  name: "Princess Avril",
  hp: 190, damage: 8, rate: 1.1,
  speed: 110, armor: 0.1,
  engage: 40,
  ranged: { kind: "bow", range: 160, damage: 14, rate: 1.15 },   // she shoots at anything further away than melee reach
  frost: { slow: 0.35, slowPerLevel: 0.03, time: 2.2 },          // hit monsters are slowed; colder with her level
  healRange: 90, healPerSecond: 3,                   // soothes soldiers, Lady April and Max nearby
  regen: 6,
  respawn: 12,
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
};

// Her eagle. He circles above her and dives on monsters near her. Being airborne, he can even strike flying monsters.
export const EAGLE = {
  name: "Sky",
  damage: 7, rate: 0.9,             // a dive every so often
  engage: 110,                      // attacks monsters this close to Princess Avril
  speed: 220,
  kind: "eagle",
};

// Ember: a young fire mage. Fragile, but her fireballs splash and set monsters ablaze. Her baby dragon breathes fire from above.
export const EMBER = {
  name: "Ember",
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

// Sir Adrien: a gallant paladin in white and gold. When a monster is near but not yet at his lance's point he
// lowers it and charges, running every monster in his path through and leaving them reeling. His lion Leon fights beside him.
export const ADRIEN = {
  name: "Sir Adrien",
  hp: 280, damage: 14, rate: 1.1,
  speed: 112, armor: 0.35,
  engage: 75,
  charge: { every: 6, range: 120, min: 40, speed: 460, factor: 1.8, stun: 1.0, width: 24 },   // the lance charge
  regen: 5,
  respawn: 12,
  xpPerLevel: 40, maxLevel: 10, damageGrowth: 0.08, hpGrowth: 0.06,
};

export const HERO_KINDS = { april: HERO, avril: AVRIL, ember: EMBER, willow: WILLOW, meilin: MEILIN, adrien: ADRIEN };

// Leon, Sir Adrien's lion. Proud and fierce: slower than the dog but hits harder and takes more.
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

// Cinder, Ember's baby dragon. Circles above her and spits little fireballs at monsters near her (flying ones too).
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
  engage: 70,                       // attacks monsters this close to Lady April
  regen: 6,
  respawn: 8,
  kind: "dog",
};
BEAR.kind = "bear";
DRAGON.kind = "dragon";

// Monster types. armour 0.4 = blocks 40% of physical damage. attack = damage to soldiers per hit.
// Special traits:
//   flying      - soars over soldiers and heroes; only archers, mages and the eagle can reach it
//   magicWeak   - takes that many times damage from magic; frostImmune - cannot be chilled
//   healAura    - heals other monsters within healRange by that much per second
export const ENEMIES = {
  goblin:   { hp: 40,  speed: 70,  armor: 0,   gold: 4,  lives: 1, attack: 6,  size: 26 },
  wolf:     { hp: 30,  speed: 120, armor: 0,   gold: 5,  lives: 1, attack: 8,  size: 30 },
  bat:      { hp: 28,  speed: 95,  armor: 0,   gold: 5,  lives: 1, attack: 4,  size: 26, flying: true },
  orc:      { hp: 140, speed: 45,  armor: 0.4, gold: 10, lives: 2, attack: 14, size: 36 },
  skeleton: { hp: 90,  speed: 55,  armor: 0.6, gold: 9,  lives: 1, attack: 10, size: 30, magicWeak: 1.8, frostImmune: true },
  shaman:   { hp: 110, speed: 50,  armor: 0.1, gold: 14, lives: 1, attack: 7,  size: 30, healAura: 6, healRange: 70 },
  golem:    { hp: 520, speed: 26,  armor: 0.7, gold: 35, lives: 3, attack: 28, size: 46, frostImmune: true, magicWeak: 1.4 },
  troll:    { hp: 900, speed: 35,  armor: 0.3, gold: 60, lives: 5, attack: 35, size: 56 },
  //   split       - when killed, bursts into that many smaller monsters
  //   steals      - instead of costing lives, it runs off with this much gold if it reaches the castle
  //   raise       - necromancers turn a nearby corpse into a skeleton every few seconds
  slime:      { hp: 70,  speed: 55,  armor: 0,   gold: 5,  lives: 1, attack: 5,  size: 28, split: { type: "slimeling", count: 2 }, noCorpse: true },
  slimeling:  { hp: 22,  speed: 85,  armor: 0,   gold: 2,  lives: 1, attack: 3,  size: 16, noCorpse: true },
  thief:      { hp: 55,  speed: 110, armor: 0,   gold: 14, lives: 0, attack: 5,  size: 26, steals: 25 },
  necromancer:{ hp: 160, speed: 40,  armor: 0.1, gold: 24, lives: 2, attack: 9,  size: 32, raise: { every: 5, range: 90 } },
  wyvern:     { hp: 280, speed: 60,  armor: 0.2, gold: 32, lives: 3, attack: 18, size: 44, flying: true },
};

// What appears in each wave. n = wave number (1, 2, 3 ...).
export function makeWave(n, d = { count: 1, shift: 0 }) {
  // n is the wave number; on higher levels the nastier kinds are judged as if the wave were later (shift),
  // and every group is scaled by the level's crowd size.
  const m = n + d.shift, groups = [];
  const add = (type, count, gap) => groups.push({ type, count: Math.max(1, Math.round(count * d.count)), gap });
  add("goblin", 5 + n * 2.5, 0.8);
  if (m >= 2) add("wolf", m + 1, 0.45);
  if (m >= 3) add("bat", Math.floor(m / 2) + 2, 0.55);
  if (m >= 4) add("thief", Math.ceil(m / 4), 0.9);
  if (m >= 4) add("orc", Math.ceil(m * 0.7), 1.3);
  if (m >= 5) add("slime", Math.ceil(m / 2) + 1, 1);
  if (m >= 6) add("skeleton", Math.ceil(m * 0.6), 1.1);
  if (m >= 6) add("shaman", Math.ceil((m - 4) / 2), 2);
  if (m >= 8 && m % 2 === 0) add("golem", Math.ceil(m / 6), 4);
  if (m >= 9 && m % 2 === 1) add("necromancer", Math.ceil((m - 8) / 3), 3);
  if (m >= 10 && m % 2 === 0) add("wyvern", Math.ceil((m - 8) / 2), 2.5);
  if (n % 5 === 0) add("troll", Math.ceil(m / 4), 3);
  return groups;
}

// Monsters get 13% tougher each wave.
export const hpScale = (n) => 1 + (n - 1) * 0.13;

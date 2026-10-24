// Levels 1 to 100. Each level has its own fixed map and a difficulty that climbs steadily:
// more waves, tougher and faster monsters, bigger crowds, and the nastier kinds showing up sooner.
// The last level played is remembered on this device.
export const MAX_LEVEL = 100;
const KEY = "yunguard.level";

export function savedLevel() {
  try { const n = Math.floor(Number(localStorage.getItem(KEY))); return n >= 1 && n <= MAX_LEVEL ? n : 1; } catch (e) { return 1; }
}
export function saveLevel(n) { try { localStorage.setItem(KEY, String(n)); } catch (e) { /* private mode: fine */ } }

// Gold carried over: on finishing a level, 75% of what's left travels to the next one (remembered on this device)
// plus 10 gold for every villager still standing. The whole inheritance is capped at 600.
const CARRY_KEY = "yunguard.carry", CARRY_SHARE = 0.75, VILLAGER_BONUS = 10, CARRY_MAX = 600;
export function saveCarry(forLevel, goldLeft, livesLeft = 0) {
  const fromGold = Math.round(goldLeft * CARRY_SHARE), fromLives = livesLeft * VILLAGER_BONUS;
  const gold = Math.min(CARRY_MAX, fromGold + fromLives);
  try { localStorage.setItem(CARRY_KEY, JSON.stringify({ level: forLevel, gold })); } catch (e) { /* fine */ }
  return { gold, fromGold, fromLives, capped: fromGold + fromLives > CARRY_MAX };
}
export function carryFor(level) {                                   // the bonus waiting for this level, if any
  try { const c = JSON.parse(localStorage.getItem(CARRY_KEY) || "null"); return c && c.level === level ? Math.max(0, Math.floor(c.gold)) : 0; } catch (e) { return 0; }
}
export function clearProgress() { try { localStorage.removeItem(KEY); localStorage.removeItem(CARRY_KEY); } catch (e) { /* fine */ } }
export const clampLevel = (n) => Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(n) || 1)));

// A level always plays on the same map... until progress is reset, which reshuffles every level's map.
// The shuffle is remembered on this device so it survives refreshes and launching from the home screen.
const SALT_KEY = "yunguard.salt";
let salt = 0;
try { salt = Math.floor(Number(localStorage.getItem(SALT_KEY))) || 0; } catch (e) { /* fine */ }
export function reshuffleMaps() {
  salt = 1 + Math.floor(Math.random() * 999999);
  try { localStorage.setItem(SALT_KEY, String(salt)); } catch (e) { /* fine */ }
}
export const levelSeed = (L) => (((L + salt) * 2654435761 + 97) % 999983) + 1;

// Load the page with this query (e.g. "?level=8"), dropping any #seed. Same URL: reload (some phones ignore a plain assignment).
export function navigate(query = "") {
  const url = location.pathname + query;
  if (!location.hash && url === location.pathname + location.search) location.reload();
  else location.href = url;
}

// How much world a level gets: early levels have a handful of build pads and one road; by level 30 the full set
export function mapOptionsFor(L) {
  L = clampLevel(L);
  return {
    spots: Math.min(20, 8 + Math.floor((L - 1) * 0.45)),              // 8 pads at level 1, 20 from level 28
    // Roads beyond the main one, each with its own chance: a second creeps in early and is the rule from level 20,
    // a third from level 25 on (certain by 60), a fourth from level 45 (likely by 100). High levels are a tangle.
    extraRoutes: [
      L < 4 ? 0 : L < 10 ? 0.5 : L < 20 ? 0.85 : 1,
      L < 25 ? 0 : Math.min(1, (L - 25) * 0.03),
      L < 45 ? 0 : Math.min(0.85, (L - 45) * 0.016),
    ],
    rounds: 2 + Math.floor(L / 40),                                    // how hard the map tries to fit each extra road (up to 4 rounds at 100)
    entryChances: [L < 10 ? 0 : Math.min(1, (L - 10) / 60), L < 40 ? 0 : Math.min(0.85, (L - 40) / 70)],   // chance of a 2nd and a 3rd entrance, growing with level
    exitChances: [L < 10 ? 0 : Math.min(1, (L - 10) / 50)],               // chance of a 2nd exit
    minRoutes: L < 20 ? 1 : L < 60 ? 2 : 3,                              // and the layout is redone until at least this many roads exist (when wanted)
  };
}

export function levelConfig(L) {
  L = clampLevel(L);
  return {
    level: L,
    waves: Math.min(15, 9 + Math.floor((L - 1) / 4)),      // 9 waves at level 1, 15 from level 25
    // Monsters themselves never change between levels; only who turns up, and how many
    count: Math.min(1.4, 0.9 + (L - 1) * 0.006),             // crowd size, from a little thin to 1.4× (level 84+)
    shift: Math.floor((L - 1) / 8),                          // the tougher kinds arrive this many waves earlier (up to 12)
    gold: 360 + L * 7,                                       // a bigger purse to meet a bigger threat (367 → 1060)
    goldMul: 1 + (L - 1) * 0.012,                            // rewards keep up a little better
    lives: 20,
  };
}

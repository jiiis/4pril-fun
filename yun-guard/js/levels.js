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
const CARRY_KEY = "yunguard.carry", CARRY_SHARE = 0.75;
export function saveCarry(forLevel, goldLeft) {
  const gold = Math.round(goldLeft * CARRY_SHARE);
  try { localStorage.setItem(CARRY_KEY, JSON.stringify({ level: forLevel, gold })); } catch (e) { /* fine */ }
  return gold;
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
    secondRoute: L < 4 ? 0 : L < 10 ? 0.5 : 0.85,                     // one road to start with; a second one creeps in
  };
}

export function levelConfig(L) {
  L = clampLevel(L);
  return {
    level: L,
    waves: Math.min(28, 9 + Math.floor((L - 1) / 4)),      // 9 waves at level 1, 28 from level 77
    hp: 0.95 + (L - 1) * 0.036,                              // monsters' base toughness (0.95 → 4.5), on top of the per-wave growth
    speed: 1 + Math.min(0.25, (L - 1) * 0.0025),             // a little quicker, up to 25% faster
    count: Math.min(1.8, 0.8 + (L - 1) * 0.011),             // crowd size, from a little thin to nearly double
    shift: Math.floor((L - 1) / 6),                          // the tougher kinds arrive this many waves earlier
    gold: 360 + L * 7,                                       // a bigger purse to meet a bigger threat (367 → 1060)
    goldMul: 1 + (L - 1) * 0.012,                            // rewards keep up a little better
    lives: 20,
  };
}

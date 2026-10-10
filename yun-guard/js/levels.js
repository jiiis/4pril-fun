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

// A level always plays on the same map
export const levelSeed = (L) => ((L * 2654435761 + 97) % 999983) + 1;

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
    waves: Math.min(30, 8 + Math.floor((L - 1) / 4)),      // 8 waves at level 1, 30 from level 89
    hp: 0.85 + (L - 1) * 0.045,                              // monsters' base toughness, on top of the per-wave growth
    speed: 1 + Math.min(0.3, (L - 1) * 0.003),               // a little quicker, up to 30% faster
    count: Math.min(2, 0.7 + (L - 1) * 0.013),               // crowd size, from thin to double
    shift: Math.floor((L - 1) / 6),                          // the tougher kinds arrive this many waves earlier
    gold: 350 + L * 6,                                       // a bigger purse to meet a bigger threat
    goldMul: 1 + (L - 1) * 0.01,                             // rewards keep up a little
    lives: 20,
  };
}

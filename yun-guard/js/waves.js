import { state } from "./state.js";
import { WAVE_BREAK, CALL_AT, ENEMIES, makeWave, waveTimeline } from "./config.js";
import { map } from "./map.js";
import { addFloater } from "./combat.js";
import { setWaveButton, endGame } from "./ui.js";
import { sfx } from "./audio.js";

// One wave can be called ahead, Kingdom Rush style: once enough of the current wave has entered the road
// (CALL_AT) the button lights up; once the whole wave has appeared a countdown starts and the next wave
// comes by itself when it runs out. Calling early pays the seconds left as bonus gold. After a call the
// button rests (hourglass) until the new wave has progressed far enough in its turn.
export const canCallWave = () => state.wave > 0 && state.wave < state.totalWaves && !state.over && state.waveTotal > 0
  && 1 - state.spawnQueue.filter((q) => q.wave === state.wave).length / state.waveTotal >= CALL_AT;

export function startWave() {
  if (state.wave >= state.totalWaves || state.over) return;
  if (state.wave > 0 && !canCallWave()) return;

  // Bonus gold for calling the wave early (like Kingdom Rush).
  if (state.countdown !== null && state.countdown > 0) {
    const bonus = Math.ceil(state.countdown);
    state.gold += bonus;
    addFloater(480, 60, `+${bonus} gold early bonus!`, "#ffd54f", 18);
  }

  state.wave++;
  state.countdown = null;
  // The new wave starts entering right away, alongside whatever is left of the last one
  if (!state.spawnQueue.length) state.spawnTimer = 0;
  const t0 = state.spawnQueue.length ? state.spawnTimer + 0.4 : 0;
  const timeline = waveTimeline(makeWave(state.wave, state.diff));
  for (const m of timeline) state.spawnQueue.push({ type: m.type, at: t0 + m.at, wave: state.wave });
  state.spawnQueue.sort((a, b) => a.at - b.at);
  state.waveTotal = timeline.length;
  setWaveButton("busy");                                   // rests until this wave has entered far enough
  sfx("wave");
}

export function spawnEnemy(type) {
  const def = ENEMIES[type];
  const maxHp = def.hp;                                     // the same monster is the same everywhere
  const path = map.paths[Math.floor(Math.random() * map.paths.length)];   // each monster picks a route
  state.enemies.push({
    type, def, hp: maxHp, maxHp, path,
    x: path[0].x, y: path[0].y, next: 1, travelled: 0,
    phase: Math.random() * 6, dir: 1, hitFlash: 0,
  });
}

// A monster that appears mid-road: slimelings from a burst slime, or a skeleton a necromancer has raised.
// It takes over the route and progress of the monster it came from.
export function spawnEnemyAt(type, from, hpFactor = 1, at = from) {
  const def = ENEMIES[type];
  const maxHp = Math.round(def.hp * hpFactor);
  state.enemies.push({
    type, def, hp: maxHp, maxHp, path: from.path,
    x: at.x, y: at.y, next: from.next, travelled: from.travelled,
    phase: Math.random() * 6, dir: from.dir || 1, hitFlash: 0,
  });
}

// Called once every monster of the wave has appeared. The next wave is already on its way
// (call it early for bonus gold); the last wave is won once every monster is gone.
export function waveFinished() {
  if (state.wave >= state.totalWaves) {
    if (state.enemies.length === 0) endGame(true);
    return;
  }
  state.countdown = WAVE_BREAK;
  setWaveButton("ready", WAVE_BREAK);
}

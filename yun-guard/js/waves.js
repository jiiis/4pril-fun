import { state } from "./state.js";
import { WAVE_BREAK, ENEMIES, makeWave, hpScale } from "./config.js";
import { map } from "./map.js";
import { addFloater } from "./combat.js";
import { setWaveButton, endGame } from "./ui.js";
import { sfx } from "./audio.js";

export function startWave() {
  if (state.wave >= state.totalWaves || state.over || state.spawnQueue.length) return;

  // Bonus gold for calling the wave early (like Kingdom Rush).
  if (state.countdown !== null && state.countdown > 0) {
    const bonus = Math.ceil(state.countdown);
    state.gold += bonus;
    addFloater(480, 60, `+${bonus} gold early bonus!`, "#ffd54f", 18);
  }

  state.wave++;
  state.countdown = null;
  state.spawnQueue = [];
  let t = 0;
  for (const g of makeWave(state.wave, state.diff)) {
    for (let i = 0; i < g.count; i++) {
      state.spawnQueue.push({ type: g.type, at: t });
      t += g.gap * 0.7;                                   // monsters come thick and fast
    }
    t += 1.5;                                             // short pause between groups
  }
  state.spawnTimer = 0;
  setWaveButton("busy");
  sfx("wave");
}

export function spawnEnemy(type) {
  const def = ENEMIES[type];
  const maxHp = Math.round(def.hp * hpScale(Math.max(state.wave, 1)) * state.diff.hp);
  const path = map.paths[Math.floor(Math.random() * map.paths.length)];   // each monster picks a route
  state.enemies.push({
    type, def, hp: maxHp, maxHp, path, speedMul: state.diff.speed,
    x: path[0].x, y: path[0].y, next: 1, travelled: 0,
    phase: Math.random() * 6, dir: 1, hitFlash: 0,
  });
}

// A monster that appears mid-road: slimelings from a burst slime, or a skeleton a necromancer has raised.
// It takes over the route and progress of the monster it came from.
export function spawnEnemyAt(type, from, hpFactor = 1, at = from) {
  const def = ENEMIES[type];
  const maxHp = Math.round(def.hp * hpScale(Math.max(state.wave, 1)) * state.diff.hp * hpFactor);
  state.enemies.push({
    type, def, hp: maxHp, maxHp, path: from.path, speedMul: state.diff.speed,
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

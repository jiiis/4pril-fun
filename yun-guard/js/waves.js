import { state } from "./state.js";
import { WAVE_BREAK, CALL_AT, ENEMIES, makeWave, waveTimeline } from "./config.js";
import { map } from "./map.js";
import { addFloater } from "./combat.js";
import { setWaveButton, endGame } from "./ui.js";
import { sfx } from "./audio.js";
import { t } from "./i18n.js";

// Between waves there is a breather: once every monster of a wave has entered the road, a countdown (shown on the
// round button) runs down to the next wave. If the wave has been dealt with quickly the player can press the
// button to start the next one early, and is paid for every second skipped (more if the road is already clear).
export const canCallWave = () => state.wave > 0 && state.wave < state.totalWaves && !state.over
  && state.countdown !== null && state.countdown > 0
  && (state.countdown <= 10 || !state.enemies.some((e) => !e.dead));   // only within 10 seconds of the next wave, or once this wave is all dead

// The player pressed the button (or N)
export function startWave() {
  if (state.over || state.wave >= state.totalWaves) return;
  if (state.wave > 0 && !canCallWave()) return;
  if (state.countdown !== null && state.countdown > 0) {
    const left = Math.ceil(state.countdown), cleared = !state.enemies.some((e) => !e.dead);
    const bonus = left + (cleared ? Math.ceil(left * 0.5) : 0);
    state.gold += bonus;
    addFloater(480, 60, t(cleared ? "+{gold} gold: wave cleared early!" : "+{gold} gold early bonus!", { gold: bonus }), "#ffd54f", 18);
    sfx("coin", 0.15);
  }
  beginWave();
}

// The next wave begins (called by the countdown running out, or by startWave)
export function beginWave() {
  if (state.wave >= state.totalWaves || state.over) return;
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
  const lane = (Math.random() * 2 - 1) * 0.85;             // where across the road it walks (-1 left edge .. 1 right edge)
  state.enemies.push({
    type, def, hp: maxHp, maxHp, path,
    x: path[0].x, y: path[0].y, cx: path[0].x, cy: path[0].y, next: 1, travelled: 0,
    lane, laneTo: lane, laneT: 1 + Math.random() * 4, pace: 0.94 + Math.random() * 0.12,   // and its own easy pace
    phase: Math.random() * 6, dir: 1, hitFlash: 0,
  });
}

// A monster that appears mid-road: slimelings from a burst slime, or a skeleton a necromancer has raised.
// It takes over the route and progress of the monster it came from.
export function spawnEnemyAt(type, from, hpFactor = 1, at = from) {
  const def = ENEMIES[type];
  const maxHp = Math.round(def.hp * hpFactor);
  const lane = (from.lane || 0) + (Math.random() - 0.5) * 0.6;
  state.enemies.push({
    type, def, hp: maxHp, maxHp, path: from.path,
    x: at.x, y: at.y, cx: from.cx ?? at.x, cy: from.cy ?? at.y, next: from.next, travelled: from.travelled,
    lane, laneTo: lane, laneT: 1 + Math.random() * 4, pace: 0.94 + Math.random() * 0.12,
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
  setWaveButton(canCallWave() ? "ready" : "busy", WAVE_BREAK);
}

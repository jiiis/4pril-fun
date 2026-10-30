import { state } from "./state.js";
import { ROAD_WIDTH } from "./config.js";
import { map } from "./map.js";
import { TOWERS, FIRE_ARROW } from "./config.js";
import { beginWave, spawnEnemy, spawnEnemyAt, waveFinished, canCallWave } from "./waves.js";
import { updateSoldiers } from "./soldiers.js";
import { updateArcher, updateMoonShot } from "./archer.js";
import { updateCritters } from "./critters.js";
import { updateHero } from "./hero.js";
import { slayCritter } from "./critters.js";
import { updateWeather } from "./weather.js";
import { hurt, addFloater, addBurst, addSmoke, addScorch } from "./combat.js";
import { towerRange, towerDamage, towerRate, shotOrigin, archerSlots, abilityDef } from "./towers.js";
import { dist, clamp } from "./util.js";
import { refreshHud, setWaveButton, endGame } from "./ui.js";
import { t } from "./i18n.js";
import { sfx } from "./audio.js";

const SHOT_SPEED = 360;        // arrows and magic bolts
const ARROW_ARC = 14;          // how high arrows rise mid-flight
const FIRE_ANIM = 0.4;         // seconds the archer / wizard firing pose lasts
const CANNON_SPEED = 260;      // used to work out the cannonball's flight time
const RECOIL_TIME = 0.2;

// Where will this monster be in T seconds? Cannons aim there instead of
// where the monster is now, so the shot lands on a moving target.
function predictPosition(e, T) {
  if (e.wasBlocked) return { x: e.x, y: e.y };
  let remaining = e.def.speed * (e.pace || 1) * T, x = e.x, y = e.y, next = e.next;
  while (remaining > 0 && next < e.path.length) {
    const p = e.path[next];
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > remaining) { x += ((p.x - x) / d) * remaining; y += ((p.y - y) / d) * remaining; remaining = 0; }
    else { x = p.x; y = p.y; remaining -= d; next++; }
  }
  return { x, y };
}

function fireCannon(t, target) {
  const d = dist(t, target);
  const T = clamp(d / CANNON_SPEED, 0.45, 1.1);
  const aim = predictPosition(target, T);
  const sx = t.x + Math.cos(t.angle) * 22, sy = t.y - 14 + Math.sin(t.angle) * 22;   // barrel tip
  state.shots.push({ ballistic: true, x0: sx, y0: sy, x: sx, y: sy, z: 0, tx: aim.x, ty: aim.y, t: 0, T, h: clamp(d * 0.35, 30, 90), dmg: towerDamage(t), def: t.def, ability: abilityDef(t) });
  t.recoil = RECOIL_TIME;
  addBurst(sx, sy, 10, "rgba(255,220,120,0.9)");
  addSmoke(sx, sy, 3, 4);
  sfx("cannon", 0.1);
}

// Lightning Spire: the bolt strikes the first monster, then leaps to the nearest one not yet hit, and so on.
// Each hop does a little less damage. Flying monsters are fair game.
function fireLightning(t, first) {
  const ab = abilityDef(t);
  const hops = t.def.chain + (t.level - 1) + (ab?.extraHops || 0);
  const reach = t.def.chainRange * (ab?.rangeFactor || 1);
  const pts = [shotOrigin(t)], struck = [];
  let cur = first, dmg = towerDamage(t);
  while (cur && struck.length < hops) {
    struck.push(cur);
    pts.push({ x: cur.x, y: cur.y - cur.def.size * 0.3 - (cur.def.flying ? 18 : 0) });
    hurt(cur, dmg, "magic");
    addBurst(cur.x, cur.y - 4, 10, "rgba(129,212,250,0.9)");
    dmg *= t.def.chainFalloff;
    let nxt = null, bd = Infinity;
    for (const e of state.enemies) {
      if (e.dead || struck.includes(e)) continue;
      const d = dist(e, cur);
      if (d <= reach && d < bd) { bd = d; nxt = e; }
    }
    cur = nxt;
  }
  state.bolts.push({ pts, life: 0.22, maxLife: 0.22, seed: Math.random() * 100 });
  t.anim = FIRE_ANIM;
  sfx("zap", 0.08);
}

// Ballista: one huge bolt flies through its target and keeps going. Everything along the line is struck.
function fireBallista(t, target) {
  const ab = abilityDef(t), o = shotOrigin(t), reach = towerRange(t) + 50;
  const ang = Math.atan2(target.y - o.y, target.x - o.x), dx = Math.cos(ang), dy = Math.sin(ang);
  const end = { x: o.x + dx * reach, y: o.y + dy * reach };
  const hits = [];
  for (const e of state.enemies) {
    if (e.dead) continue;
    const ex = e.x - o.x, ey = e.y - (e.def.flying ? 18 : 0) - o.y, along = ex * dx + ey * dy, across = Math.abs(ex * dy - ey * dx);
    if (along > 0 && along <= reach && across <= t.def.lineWidth + e.def.size * 0.35) hits.push({ e, along });
  }
  hits.sort((a, b) => a.along - b.along);
  const base = towerDamage(t);
  hits.forEach(({ e }, i) => {
    let dmg = base;
    if (ab?.execute && e.hp < e.maxHp * ab.execute.below) dmg *= ab.execute.factor;
    hurt(e, dmg, "pierce");
    addBurst(e.x, e.y - e.def.size * 0.3, 12, "rgba(255,236,179,0.9)");
    if (ab?.pin && !e.dead) {
      const first = i === 0;
      e.pin = { slow: first ? ab.pin.firstSlow : ab.pin.slow, time: first ? ab.pin.firstTime : ab.pin.time };
    }
  });
  state.bolts.push({ kind: "spear", pts: [o, end], life: 0.55, maxLife: 0.55, seed: Math.random() * 100 });
  t.recoil = RECOIL_TIME * 1.6; t.anim = FIRE_ANIM;
  addSmoke(o.x, o.y, 2, 3);
  sfx("ballista", 0.1);
}

function cannonImpact(s) {
  const splash = s.splash || s.def.splash;
  for (const e of state.enemies) if (!e.def.flying && Math.hypot(e.x - s.tx, e.y - s.ty) <= splash) hurt(e, s.dmg, s.def.type);
  addBurst(s.tx, s.ty, splash, "rgba(255,152,0,0.7)");
  addBurst(s.tx, s.ty, splash * 0.5, "rgba(255,235,120,0.9)");
  addSmoke(s.tx, s.ty, s.bomblet ? 2 : 6, s.bomblet ? 6 : 14);
  addScorch(s.tx, s.ty, splash * 0.55);
  sfx("explosion", s.bomblet ? 0.2 : 0.1);
  const ab = s.ability;
  if (ab?.bomblets && !s.bomblet) {                        // cluster bombs: little shells hop out of the blast
    for (let i = 0; i < ab.bomblets; i++) {
      const a = (i / ab.bomblets) * Math.PI * 2 + Math.random(), r = 22 + Math.random() * 14;
      state.shots.push({ ballistic: true, bomblet: true, x0: s.tx, y0: s.ty, x: s.tx, y: s.ty, z: 0, tx: s.tx + Math.cos(a) * r, ty: s.ty + Math.sin(a) * r, t: 0, T: 0.45, h: 26, dmg: s.dmg * ab.bombletDamage, def: s.def, splash: ab.bombletSplash });
    }
  }
  if (ab?.fire) state.fires.push({ x: s.tx, y: s.ty, r: ab.fire.radius, dps: ab.fire.dps, life: ab.fire.time, maxLife: ab.fire.time, seed: Math.random() * 10 });   // napalm
}

// Now and then a fish leaps out of a river in a little arc and splashes back in.
function updateFish(dt) {
  for (const r of map.rivers) {
    if (Math.random() < dt * 0.35) {
      const i = Math.floor(Math.random() * (r.points.length - 1));
      const a = r.points[i], b = r.points[i + 1], t = Math.random();
      const across = (Math.random() - 0.5) * ((a.w + b.w) / 2) * 0.5;   // stay inside the local width
      const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
      const fx = a.x + (b.x - a.x) * t + (nx / nl) * across, fy = a.y + (b.y - a.y) * t + (ny / nl) * across;
      if (map.bridges.some((br) => Math.hypot(br.x - fx, br.y - fy) < br.span / 2 + 16)) continue;   // never under a bridge
      state.fish.push({ x: fx, y: fy, t: 0, dur: 0.85 + Math.random() * 0.3, dir: Math.random() < 0.5 ? 1 : -1, size: 3.67 + Math.random() * 2.16, hop: 12 + Math.random() * 8.4 });
    }
  }
  for (const p of map.ponds) {
    if (Math.random() < dt * 0.14) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
      state.fish.push({ x: p.x + Math.cos(a) * p.rx * r, y: p.y + Math.sin(a) * p.ry * r, t: 0, dur: 0.8 + Math.random() * 0.3, dir: Math.random() < 0.5 ? 1 : -1, size: 3.24 + Math.random() * 1.73, hop: 10.8 + Math.random() * 7.2 });
    }
  }
  for (const f of state.fish) f.t += dt;
  state.fish = state.fish.filter((f) => f.t < f.dur + 0.4);
}

// One step of the game. dt = seconds since the last step.
export function update(dt) {
  updateCritters(dt);                 // animals keep wandering even on the game over screen
  updateWeather(dt);
  updateFish(dt);
  state.time += dt;                   // flags, water, idle animations keep going when paused or after the game ends
  if (state.over || state.paused) return;   // paused: the fight stands still, the world stays alive

  // --- Spawning ---
  if (state.spawnQueue.length) {
    state.spawnTimer += dt;
    while (state.spawnQueue.length && state.spawnQueue[0].at <= state.spawnTimer) {
      spawnEnemy(state.spawnQueue.shift().type);
    }
  } else if (state.wave > 0 && state.countdown === null) {
    waveFinished();                                        // the next wave queues up as soon as this one has all appeared
  }

  // --- Countdown between waves, and whether the next one may be called yet ---
  if (state.countdown !== null) {
    state.countdown -= dt;
    setWaveButton(canCallWave() ? "ready" : "busy", state.countdown);
    if (state.countdown <= 0) beginWave();
  } else if (state.wave > 0 && state.wave < state.totalWaves) {
    setWaveButton(canCallWave() ? "ready" : "busy");       // lights up once enough of this wave has entered
  }

  // --- The hero and the soldiers from barracks move, block and fight ---
  updateHero(dt);
  for (const t of state.towers) if (t.def.soldiers) updateSoldiers(t, dt);

  // --- Monsters walk (unless a soldier is blocking them) ---
  for (const e of state.enemies) {
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.armorRend && (e.armorRend.time -= dt) <= 0) e.armorRend = null;
    if (e.thornRootCd > 0) e.thornRootCd = Math.max(0, e.thornRootCd - dt);
    if (e.burn) {                                            // set alight by a fire arrow
      e.burn.time -= dt;
      hurt(e, e.burn.dps * dt, "magic", false);
      if (e.burn.time <= 0) e.burn = null;
    }
    if (e.poison) {                                          // venom arrows: sickly damage over time
      e.poison.time -= dt;
      hurt(e, e.poison.dps * dt, "magic", false);
      if (e.poison.time <= 0) e.poison = null;
    }
    if (e.cursed > 0) e.cursed -= dt;
    if (e.staticSlow > 0) e.staticSlow -= dt;
    if (e.pin) { e.pin.time -= dt; if (e.pin.time <= 0) e.pin = null; }
    if (!e.def.flying) for (const f of state.fires) if (Math.hypot(e.x - f.x, e.y - f.y) <= f.r) {   // standing in napalm
      hurt(e, f.dps * dt, "magic", false);
      if (!e.burn) e.burn = { time: 0.6, dps: 0 };
    }
    if (e.frost) {                                           // chilled by one of Avril's arrows
      e.frost.time -= dt;
      if (e.frost.time <= 0) e.frost = null;
    }
    if (e.def.healAura) {                                    // shamans mend the monsters around them
      for (const o of state.enemies) if (o !== e && !o.dead && o.hp < o.maxHp && dist(o, e) <= e.def.healRange) o.hp = Math.min(o.maxHp, o.hp + e.def.healAura * dt);
    }
    if (e.def.raise) {                                       // necromancers raise skeletons from fallen monsters nearby
      e.raiseCd = (e.raiseCd ?? e.def.raise.every) - dt;
      if (e.raiseCd <= 0) {
        const c = state.corpses.find((c) => !c.critter && dist(c, e) <= e.def.raise.range);   // only monsters rise again
        if (c) {
          state.corpses.splice(state.corpses.indexOf(c), 1);
          spawnEnemyAt("skeleton", e, 0.7, c);
          addBurst(c.x, c.y, 24, "rgba(118,255,3,0.8)");
          addFloater(c.x, c.y - 24, t("Rise!"), "#76ff03", 14);
          sfx("raise", 0.2);
          e.raiseCd = e.def.raise.every;
          e.casting = 0.7;
        }
      }
    }
    if (e.casting > 0) e.casting -= dt;
    if (e.rooted > 0) {                                      // held fast by Willow's vines or a bramble patch
      e.rooted -= dt;
      e.blocked = false; e.wasBlocked = true; e.phase += dt * 4;
      continue;
    }
    e.wasBlocked = e.blocked;
    if (e.blocked) { e.blocked = false; e.phase += dt * 6; continue; }
    // The monster follows the road's centre line (cx, cy) but walks somewhere across its width: its lane
    // drifts now and then, so a crowd spreads out and wanders instead of marching in single file.
    const target = e.path[e.next];
    const c = { x: e.cx ?? e.x, y: e.cy ?? e.y };
    const d = dist(c, target);
    const slowMul = (e.frost ? 1 - e.frost.slow : 1) * (e.poison ? 1 - e.poison.slow : 1) * (e.staticSlow > 0 ? 0.75 : 1) * (e.pin ? 1 - e.pin.slow : 1);
    const step = e.def.speed * (e.pace || 1) * slowMul * dt;
    let ux = 0, uy = 0;
    if (d <= step) {
      c.x = target.x; c.y = target.y; e.next++;
      if (e.next >= e.path.length) e.reached = true;
      const n = e.path[e.next]; if (n) { const l = dist(target, n) || 1; ux = (n.x - target.x) / l; uy = (n.y - target.y) / l; }
    } else {
      ux = (target.x - c.x) / d; uy = (target.y - c.y) / d;
      c.x += ux * step; c.y += uy * step;
    }
    e.cx = c.x; e.cy = c.y;
    if ((e.laneT -= dt) <= 0) { e.laneTo = (Math.random() * 2 - 1) * 0.85; e.laneT = 2 + Math.random() * 5; }   // pick a new spot across the road now and then
    e.lane += (e.laneTo - e.lane) * Math.min(1, dt * 0.6);
    // Near a bend the sideways direction blends toward the next segment's, so the offset swings round smoothly
    let nx = -uy, ny = ux;
    if (e.next < e.path.length - 1 && d < 36) {
      const a = e.path[e.next], b = e.path[e.next + 1], l = dist(a, b) || 1, k = 1 - d / 36;
      nx = nx * (1 - k) + (-(b.y - a.y) / l) * k; ny = ny * (1 - k) + ((b.x - a.x) / l) * k;
    }
    const reach = Math.max(0, ROAD_WIDTH / 2 - 8 - e.def.size * 0.25);   // keep the body on the road
    const ox = e.cx + nx * e.lane * reach, oy = e.cy + ny * e.lane * reach;
    if (Math.abs(ox - e.x) > 0.5) e.dir = Math.sign(ox - e.x);
    e.x = ox; e.y = oy;
    e.travelled += step;
    e.phase += dt * e.def.speed * (e.pace || 1) * slowMul / 8;
  }
  for (const e of state.enemies) {
    if (e.reached) {
      const end = e.path[e.path.length - 1];
      const k = map.castles.reduce((best, c) => (Math.hypot(c.x - end.x, c.y - end.y) < Math.hypot(best.x - end.x, best.y - end.y) ? c : best), map.castles[0]);
      if (e.def.steals) {                                    // a thief slips into the castle and runs off with gold
        const take = Math.min(state.gold, e.def.steals);
        state.gold -= take;
        addFloater(k.x - 10, k.y - 60 * k.scale, t("-{gold} gold stolen!", { gold: take }), "#ffd54f", 18);
        sfx("steal", 0.2);
      } else {
        state.lives -= e.def.lives;
        addFloater(k.x - 10, k.y - 60 * k.scale, t("-{lives} life", { lives: e.def.lives }), "#ef5350", 18);
        sfx("lifeLost", 0.2);
      }
    }
  }
  state.enemies = state.enemies.filter((e) => !e.reached);
  if (state.lives <= 0) { state.lives = 0; endGame(false); }

  // --- Towers shoot ---
  for (const t of state.towers) {
    if (t.recoil > 0) t.recoil -= dt;
    if (t.anim > 0) t.anim -= dt;
    if (t.type === "archer" && t.specialization) { updateArcher(t, dt); continue; }
    if (t.def.soldiers) continue;             // barracks don't shoot
    const ab = abilityDef(t);
    if (ab?.field) {                          // static field: everything in range crawls and crackles
      for (const e of state.enemies) if (!e.dead && dist(t, e) <= towerRange(t)) { e.staticSlow = 0.2; hurt(e, ab.field.dps * dt, "magic", false); }
    }
    t.cd -= dt;
    if (t.cd > 0) continue;
    // Target the monster furthest along the road, like Kingdom Rush.
    let best = null;
    for (const e of state.enemies) {
      if (t.def.splash && e.def.flying) continue;            // cannonballs can't reach flying monsters
      if (dist(t, e) <= towerRange(t) && (!best || e.travelled > best.travelled)) best = e;
    }
    if (best) {
      t.angle = Math.atan2(best.y - t.y, best.x - t.x);
      t.lastShot = state.time;                  // the crew relaxes when they haven't fired for a while
      if (t.def.line) fireBallista(t, best);
      else if (t.def.chain) fireLightning(t, best);
      else if (t.def.splash) fireCannon(t, best);
      else {
        t.shooter = (t.shooter + 1) % archerSlots(t.level).length;   // the archers take turns
        const o = shotOrigin(t);
        const fire = t.def === TOWERS.archer && t.level >= 3 && !ab?.poison;
        const shot = { x: o.x, y: o.y, z: 0, total: dist(o, best), target: best, tx: best.x, ty: best.y, dmg: towerDamage(t), def: t.def, trail: [], fire, poison: ab?.poison || null, splash: ab?.splash || null, curse: ab?.curse || null };
        state.shots.push(shot);
        t.anim = FIRE_ANIM;
        sfx(t.def.type === "magic" ? "magic" : "arrow", 0.06);
      }
      t.cd = 1 / towerRate(t);
    }
  }

  // --- Shots fly ---
  for (const s of state.shots) {
    if (s.kind === "moon") { updateMoonShot(s, dt); continue; }
    if (s.ghost) {                            // an arrow that has struck: it flies on a good way, sinks to the ground and fades
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z = Math.max(0, s.z - 14 * dt);
      s.tx = s.x + s.vx; s.ty = s.y + s.vy;
      if (s.life <= 0) s.done = true;
      continue;
    }
    if (s.ballistic) {                        // cannonball: fixed landing spot, arcs through the air
      s.t += dt / s.T;
      if (s.t >= 1) { s.done = true; cannonImpact(s); continue; }
      s.x = s.x0 + (s.tx - s.x0) * s.t;
      s.y = s.y0 + (s.ty - s.y0) * s.t;
      s.z = 4 * s.h * s.t * (1 - s.t);        // height above the ground
      continue;
    }
    if (s.prey) {                             // an arrow loosed at an animal
      if (!state.critters.includes(s.target)) { s.done = true; continue; }
      s.tx = s.target.x; s.ty = s.target.y;
      const dp = Math.hypot(s.tx - s.x, s.ty - s.y), stepP = SHOT_SPEED * dt;
      if (dp <= stepP) {
        s.done = true;
        s.target.hp -= s.dmg;
        sfx("arrowHit", 0.06);
        if (s.target.hp <= 0) slayCritter(s.target);
      } else {
        s.x += ((s.tx - s.x) / dp) * stepP; s.y += ((s.ty - s.y) / dp) * stepP;
        const p = clamp(1 - dp / s.total, 0, 1);
        s.z = 4 * ARROW_ARC * p * (1 - p);
      }
      continue;
    }
    if (s.target.dead || s.target.reached) { s.done = true; continue; }
    s.tx = s.target.x; s.ty = s.target.y;     // arrows and bolts home in
    const d = Math.hypot(s.tx - s.x, s.ty - s.y);
    const step = SHOT_SPEED * dt;
    if (d <= step) {
      s.done = true;
      if (s.fireball) {                                      // fireball: splash of fire, everything caught starts burning
        const fb = s.fireball;
        for (const e of state.enemies) if (!e.dead && Math.hypot(e.x - s.tx, e.y - s.ty) <= fb.splash) {
          hurt(e, e === s.target ? s.dmg : s.dmg * 0.6, "magic", true, s.hero || null);
          if (!e.dead) e.burn = { time: fb.burnTime, dps: fb.burnDps };
        }
        addBurst(s.tx, s.ty, fb.splash, "rgba(255,152,0,0.85)");
        addBurst(s.tx, s.ty, fb.splash * 0.5, "rgba(255,235,120,0.9)");
        addSmoke(s.tx, s.ty - 4, 3, 8);
        sfx("explosion", 0.12);
        continue;
      }
      hurt(s.target, s.dmg, s.def.type, true, s.hero || null);
      if (s.splash) {                                        // arcane storm: the bolt bursts over the crowd
        for (const e of state.enemies) if (e !== s.target && !e.dead && Math.hypot(e.x - s.tx, e.y - s.ty) <= s.splash) hurt(e, s.dmg * 0.6, "magic");
        addBurst(s.tx, s.ty, s.splash, "rgba(126,87,194,0.8)");
      }
      if (s.curse && !s.target.dead) { s.target.cursed = s.curse.time; s.target.curseFactor = s.curse.factor; addBurst(s.tx, s.ty - 10, 12, "rgba(156,39,176,0.9)"); }
      if (s.poison && !s.target.dead) { s.target.poison = { ...s.poison }; addBurst(s.tx, s.ty, 10, "rgba(124,179,66,0.9)"); }
      if (s.def.type === "magic") { addBurst(s.tx, s.ty, 14, "rgba(186,104,200,0.7)"); sfx("magicHit", 0.08); }
      else sfx("arrowHit", 0.06);
      if (s.def.type !== "magic") {                           // the arrow carries on past its target, then fades away
        const ux = d > 0.5 ? (s.tx - s.x) / d : (s.ux ?? 1), uy = d > 0.5 ? (s.ty - s.y) / d : (s.uy ?? 0), sp = SHOT_SPEED * 0.7, life = 0.5 + Math.random() * 0.15;
        state.shots.push({ ghost: true, x: s.x, y: s.y, z: Math.max(s.z, 6), vx: ux * sp, vy: uy * sp, tx: s.x + ux, ty: s.y + uy, life, maxLife: life, def: s.def, dmg: 0 });
      }
      if (s.frost && !s.target.dead && !s.target.def.frostImmune) {   // frost arrow: the monster is chilled and slowed
        s.target.frost = { slow: s.frost.slow, time: s.frost.time };
        addBurst(s.tx, s.ty, 12, "rgba(128,222,234,0.9)");
      }
      if (s.fire && !s.target.dead) {                        // fire arrow: the monster catches fire
        s.target.burn = { time: FIRE_ARROW.burnTime, dps: FIRE_ARROW.burnDps };
        addBurst(s.tx, s.ty, 12, "rgba(255,152,0,0.8)");
        addSmoke(s.tx, s.ty - 6, 2, 4);
      }
    } else {
      s.ux = (s.tx - s.x) / d; s.uy = (s.ty - s.y) / d;                       // remembered heading, for an arrow that flies on after its hit
      s.x += ((s.tx - s.x) / d) * step;
      s.y += ((s.ty - s.y) / d) * step;
      const p = clamp(1 - d / s.total, 0, 1);               // how far along the flight we are
      if (s.def.type === "magic") {
        s.trail.push({ x: s.x, y: s.y });                  // bolts and fireballs leave a glowing trail
        if (s.trail.length > 8) s.trail.shift();
      } else {
        s.z = 4 * ARROW_ARC * p * (1 - p);                  // arrows arc up and come down
        if (s.fire || s.frost || s.poison) { s.trail.push({ x: s.x, y: s.y - s.z }); if (s.trail.length > 6) s.trail.shift(); }   // flame / frost / venom trail
      }
    }
  }
  state.shots = state.shots.filter((s) => !s.done);

  // --- Clean up ---
  for (const e of state.enemies) if (e.dead && e.def.split)                 // a slain slime bursts into smaller slimes
    for (let i = 0; i < e.def.split.count; i++) spawnEnemyAt(e.def.split.type, e, 1, { x: e.x + (i ? 9 : -9), y: e.y + (i ? 3 : -3) });
  state.enemies = state.enemies.filter((e) => !e.dead);
  for (const f of state.fires) f.life -= dt;
  state.fires = state.fires.filter((f) => f.life > 0);
  for (const b of state.bolts) b.life -= dt;
  state.bolts = state.bolts.filter((b) => b.life > 0);
  for (const f of state.floaters) { f.life -= dt; f.y -= 30 * dt; }
  state.floaters = state.floaters.filter((f) => f.life > 0);
  for (const b of state.bursts) b.life -= dt;
  state.bursts = state.bursts.filter((b) => b.life > 0);
  for (const p of state.smoke) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 10 * dt; }
  state.smoke = state.smoke.filter((p) => p.life > 0);
  for (const sc of state.scorches) sc.life -= dt;
  state.scorches = state.scorches.filter((sc) => sc.life > 0);
  for (const c of state.corpses) c.life -= dt;
  state.corpses = state.corpses.filter((c) => c.life > 0);
  for (const b of state.blood) b.life -= dt;
  state.blood = state.blood.filter((b) => b.life > 0);

  refreshHud();
}

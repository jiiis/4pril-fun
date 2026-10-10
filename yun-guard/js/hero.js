import { state } from "./state.js";
import { HERO_KINDS, DOG, EAGLE, DRAGON, BEAR, LOONG, LION, W, H } from "./config.js";
import { map } from "./map.js";
import { hurt, addFloater, addBurst, addSmoke } from "./combat.js";
import { slayCritter } from "./critters.js";
import { dist, clamp, closestPointOnPath } from "./util.js";
import { sfx } from "./audio.js";

const ACCEL = 9;          // how quickly heroes get up to speed (higher = snappier)
const TURN = 10;          // how quickly they turn to face a new direction
const ARRIVE = 35;        // start slowing down this many pixels from the goal

// ---------- Setup ----------
function makeHero(def, kind, spawn, dir) {
  return {
    def, kind, x: spawn.x, y: spawn.y, spawn,
    hp: def.hp, maxHp: def.hp,
    moveTo: null, target: null, selected: false,
    vx: 0, vy: 0, speedNow: 0,
    dir, face: dir,
    phase: 0, cd: 0, swing: 0, respawn: 0, moving: false,
    bowCd: 0, shoot: 0, aim: null,      // ranged attack cooldown, animation, and who they are aiming at
    rootCd: 1.5, cast: 0,               // Willow's vines
    chargeCd: 2, charge: null,          // Sir Adrien's lance charge
    hunt: null,                         // an animal they have been told to chase
    level: 1, xp: 0, xpPending: 0, levelFlash: 0,
  };
}

// One hero per game: "april", "avril", "ember" or "willow". Each brings her own companion.
export function initHero(kind = "april") {
  const def = HERO_KINDS[kind] || HERO_KINDS.april;
  // She starts on the road just inside the first gate, facing the way the monsters come
  const g = map.exits[0];
  const spawn = { x: clamp(g.x - g.out.x * 80, 30, W - 30), y: clamp(g.y - g.out.y * 80, 30, H - 30) };
  const hero = makeHero(def, kind, spawn, -1);
  state.heroes = [hero];
  state.hero = hero;
  state.dog = null;
  state.eagle = null;
  if (kind === "avril" || kind === "ember" || kind === "meilin") {
    // A flying companion that circles above her
    const fdef = { avril: EAGLE, ember: DRAGON, meilin: LOONG }[kind];
    state.eagle = { def: fdef, x: hero.x, y: hero.y - 34, angle: 0, cd: 0, dive: null, phase: 0, dir: 1, owner: hero, breath: 0, trail: [], sweep: null };
  } else {
    // A four-legged companion that fights at her side
    const pdef = kind === "willow" ? BEAR : kind === "adrien" ? LION : DOG;
    state.dog = {
      def: pdef, x: hero.x + 26, y: hero.y + 6,
      hp: pdef.hp, maxHp: pdef.hp,
      target: null, vx: 0, vy: 0, speedNow: 0,
      dir: -1, face: -1, phase: 0, cd: 0, bite: 0, respawn: 0, moving: false,
    };
  }
}

export const selectedHero = () => state.heroes.find((h) => h.selected) || null;
export function selectHero(h) {
  for (const o of state.heroes) o.selected = o === h && o.hp > 0 ? !o.selected : false;
}
export function deselectHeroes() { for (const o of state.heroes) o.selected = false; }
// Which hero is under the mouse?
export const heroAt = (p) => state.heroes.find((h) => h.hp > 0 && dist(p, { x: h.x, y: h.y - 8 }) <= 20) || null;

// Player clicked somewhere while a hero is selected
export function sendHero(p, h = selectedHero()) {
  if (!h || h.hp <= 0) return;
  h.target = null;
  const prey = state.critters.find((c) => dist(c, { x: p.x, y: p.y + 6 }) <= 16);
  if (prey) { h.hunt = prey; h.moveTo = null; return; }
  h.hunt = null;
  h.moveTo = { x: clamp(p.x, 16, W - 16), y: clamp(p.y, 20, H - 10) };
}

// ---------- Stats that grow with level ----------
export const heroDamage = (h) => Math.round(h.def.damage * (1 + h.def.damageGrowth * (h.level - 1)));
export const heroRangedDamage = (h) => Math.round(h.def.ranged.damage * (1 + h.def.damageGrowth * (h.level - 1)));
export const heroMaxHp = (h) => Math.round(h.def.hp * (1 + h.def.hpGrowth * (h.level - 1)));
export const xpToNext = (h) => h.def.xpPerLevel * h.level;
export const frostSlow = (h) => Math.min(0.8, h.def.frost.slow + h.def.frost.slowPerLevel * (h.level - 1));

function gainXp(h, dt) {
  if (h.levelFlash > 0) h.levelFlash -= dt;
  if (!h.xpPending) return;
  h.xp += h.xpPending;
  h.xpPending = 0;
  while (h.level < h.def.maxLevel && h.xp >= xpToNext(h)) {
    h.xp -= xpToNext(h);
    h.level++;
    h.maxHp = heroMaxHp(h);
    h.hp = h.maxHp;                                          // levelling up heals fully
    h.levelFlash = 1.2;
    addFloater(h.x, h.y - 40, `${h.def.name} reached level ${h.level}!`, "#80deea", 16);
    addBurst(h.x, h.y - 5, 30, "rgba(128,222,234,0.9)");
    sfx("upgrade");
  }
  if (h.level >= h.def.maxLevel) h.xp = Math.min(h.xp, xpToNext(h));
}

// ---------- Per-frame update ----------
export function updateHero(dt) {
  for (const h of state.heroes) updateOne(h, dt);
  updatePet(dt);
  updateFlyer(dt);
}

function updateOne(h, dt) {
  const def = h.def;
  gainXp(h, dt);
  if (h.swing > 0) h.swing -= dt;
  if (h.shoot > 0) h.shoot -= dt;
  if (h.bowCd > 0) h.bowCd -= dt;
  if (h.cast > 0) h.cast -= dt;
  if (h.chargeCd > 0) h.chargeCd -= dt;
  h.face += (h.dir - h.face) * Math.min(1, dt * TURN);

  // Fallen: wait, then return at the castle
  if (h.hp <= 0) {
    h.respawn -= dt;
    if (h.respawn <= 0) { h.hp = h.maxHp; h.x = h.spawn.x; h.y = h.spawn.y; h.vx = h.vy = 0; h.moveTo = null; h.target = null; }
    return;
  }

  // Mid-charge: thunder along the line, running through every monster on it
  if (h.charge) { updateCharge(h, dt); return; }

  // Decide where to go this frame
  let goal = null, stopAt = 0;
  if (h.hunt && !state.critters.includes(h.hunt)) h.hunt = null;
  if (h.moveTo) {                                            // an order from the player always comes first
    goal = h.moveTo; stopAt = 1;
    if (dist(h, h.moveTo) < 2) h.moveTo = null;
  } else if (h.hunt) {                                       // hunting an animal
    const prey = h.hunt;
    if (def.ranged) {                                        // ranged heroes keep their distance and shoot it
      goal = prey; stopAt = def.ranged.range * 0.55;
      if (dist(h, prey) <= stopAt + 12) {
        h.dir = prey.x >= h.x ? 1 : -1;
        h.aim = prey;
        if (h.bowCd <= 0) { fireAt(h, prey, true); }
      }
    } else {                                                 // melee heroes run it down
      goal = prey; stopAt = 14;
      if (dist(h, prey) <= stopAt + 4) {
        h.dir = prey.x >= h.x ? 1 : -1;
        h.cd -= dt;
        if (h.cd <= 0) {
          h.cd = 1 / def.rate; h.swing = 0.25; sfx("clash", 0.12);
          prey.hp -= heroDamage(h);
          if (prey.hp <= 0) { slayCritter(prey); h.hunt = null; }
        }
      }
    }
  } else {
    if (!h.target || h.target.dead || h.target.reached || dist(h.target, h) > def.engage * 1.5) {
      let best = null;
      for (const e of state.enemies) if (!e.def.flying && dist(e, h) <= def.engage && (!best || e.travelled > best.travelled)) best = e;   // melee can't reach flyers
      h.target = best;
    }
    if (h.target) { goal = h.target; stopAt = 18; }
    else if (def.ranged) rangedAttack(h);                    // nothing in melee reach: shoot
    if (def.charge && h.target && h.chargeCd <= 0) {         // Sir Adrien: a monster in reach but not at the lance's point: charge!
      const d = dist(h, h.target);
      if (d >= def.charge.min && d <= def.charge.range) { startCharge(h, h.target); return; }
    }
    if (def.root) rootNearby(h, dt);
  }
  if (h.moveTo || h.target || (h.hunt && !def.ranged)) h.aim = null;
  if (def.healRange) healNearby(h, dt);

  // Move with acceleration, slowing down smoothly on arrival (but not while hunting)
  let wantX = 0, wantY = 0;
  if (goal) {
    const d = dist(h, goal);
    if (d > stopAt) {
      const speed = def.speed * (h.hunt ? 1 : clamp((d - stopAt) / ARRIVE, 0.25, 1));
      wantX = ((goal.x - h.x) / d) * speed;
      wantY = ((goal.y - h.y) / d) * speed;
    }
  }
  const k = Math.min(1, dt * ACCEL);
  h.vx += (wantX - h.vx) * k;
  h.vy += (wantY - h.vy) * k;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.speedNow = Math.hypot(h.vx, h.vy);
  h.moving = h.speedNow > 8;
  if (Math.abs(h.vx) > 10) h.dir = Math.sign(h.vx);
  h.phase += dt * 13 * (h.speedNow / def.speed);

  // Melee when next to the target and not under orders
  if (!h.moveTo && h.target && dist(h, h.target) <= stopAt + 2) {
    h.target.blocked = true;
    h.dir = h.target.x >= h.x ? 1 : -1;
    h.cd -= dt;
    if (h.cd <= 0) {
      hurt(h.target, heroDamage(h), "physical", true, h);
      if (def.cleave) {                                      // Mei Lin's spear sweeps through the monsters beside her target
        let extra = 0;
        for (const e of state.enemies) {
          if (extra >= def.cleave.extra) break;
          if (e !== h.target && !e.dead && !e.def.flying && dist(e, h.target) <= def.cleave.reach) { hurt(e, heroDamage(h) * def.cleave.factor, "physical", true, h); extra++; }
        }
      }
      h.cd = 1 / def.rate; h.swing = 0.25; sfx("clash", 0.12);
    }
    h.target.atkCd = (h.target.atkCd ?? 0.5) - dt;
    if (h.target.atkCd <= 0) {
      h.hp -= h.target.def.attack * (1 - def.armor);
      h.target.atkCd = 1;
      if (h.hp <= 0) {
        h.hp = 0; h.respawn = def.respawn; h.target = null; h.selected = false;
        addFloater(h.x, h.y - 30, `${def.name} has fallen!`, "#ef5350", 16);
        sfx("heroDown");
      }
    }
  } else if (!goal && h.hp < h.maxHp) {
    h.hp = Math.min(h.maxHp, h.hp + def.regen * dt);         // resting heals
  }
}

// ---------- Sir Adrien's lance charge ----------
// He lowers the lance and sprints in a straight line a little past his target. Every monster within the
// lance's width takes a heavy hit once and is left reeling (held in place) for a moment.
function startCharge(h, target) {
  const dx = target.x - h.x, dy = target.y - h.y, d = Math.hypot(dx, dy) || 1;
  const len = d + 36;
  h.charge = { ux: dx / d, uy: dy / d, left: len, hit: new Set(), trail: [] };
  h.dir = dx >= 0 ? 1 : -1; h.face = h.dir;
  h.chargeCd = h.def.charge.every; h.target = null; h.swing = 0.3;
  sfx("order");
}
function updateCharge(h, dt) {
  const c = h.charge, C = h.def.charge, step = Math.min(c.left, C.speed * dt);
  h.x += c.ux * step; h.y += c.uy * step; c.left -= step;
  h.x = clamp(h.x, 16, W - 16); h.y = clamp(h.y, 20, H - 20);
  h.vx = c.ux * C.speed; h.vy = c.uy * C.speed; h.speedNow = C.speed; h.moving = true;
  h.phase += dt * 22;
  c.trail.push({ x: h.x, y: h.y, t: 0 }); for (const p of c.trail) p.t += dt; c.trail = c.trail.filter((p) => p.t < 0.25);
  for (const e of state.enemies) {
    if (e.dead || e.def.flying || c.hit.has(e)) continue;
    const rx = e.x - h.x, ry = e.y - h.y;
    if (Math.abs(rx * c.uy - ry * c.ux) <= C.width && rx * c.ux + ry * c.uy > -10 && Math.hypot(rx, ry) < 40) {
      c.hit.add(e);
      hurt(e, heroDamage(h) * C.factor, "physical", true, h);
      e.rooted = Math.max(e.rooted || 0, C.stun);
      addBurst(e.x, e.y - e.def.size * 0.3, e.def.size * 0.5, "rgba(255,224,130,0.9)");
      sfx("clash", 0.2);
    }
  }
  if (c.left <= 0) { h.charge = null; h.vx = h.vy = 0; h.speedNow = 0; h.cd = 0.3; }
}

// ---------- Ranged attacks: Avril's frost arrows, Ember's fireballs ----------
const ARROW = { type: "physical" }, BOLT = { type: "magic" };
function rangedAttack(h) {
  const r = h.def.ranged;
  let best = null;
  for (const e of state.enemies) if (dist(e, h) <= r.range && (!best || e.travelled > best.travelled)) best = e;
  h.aim = best;
  if (!best) return;
  h.dir = best.x >= h.x ? 1 : -1;
  if (h.bowCd > 0) return;
  fireAt(h, best, false);
}

function fireAt(h, target, prey) {
  const r = h.def.ranged;
  const o = { x: h.x + h.dir * 10, y: h.y - (r.kind === "fire" ? 26 : 14) };
  const shot = { x: o.x, y: o.y, z: 0, total: dist(o, target), target, tx: target.x, ty: target.y, dmg: heroRangedDamage(h), trail: [], hero: h, prey };
  if (r.kind === "bow") {
    shot.def = ARROW;
    shot.frost = { slow: frostSlow(h), time: h.def.frost.time };
    sfx("arrow", 0.06);
  } else {
    shot.def = BOLT;
    shot.fireball = { splash: r.splash, burnTime: r.burnTime, burnDps: r.burnDps };
    sfx("magic", 0.06);
  }
  state.shots.push(shot);
  h.bowCd = 1 / r.rate;
  h.shoot = 0.35;
}

// Willow's vines: every few seconds, every monster near her is rooted to the spot
function rootNearby(h, dt) {
  h.rootCd -= dt;
  if (h.rootCd > 0) return;
  const r = h.def.root;
  const caught = state.enemies.filter((e) => !e.dead && !e.def.flying && dist(e, h) <= r.range);
  if (!caught.length) return;
  for (const e of caught) { e.rooted = r.duration; addBurst(e.x, e.y + e.def.size * 0.4, e.def.size * 0.6, "rgba(104,159,56,0.9)"); }
  h.rootCd = r.every;
  h.cast = 0.6;
  addBurst(h.x, h.y + 8, r.range, "rgba(139,195,74,0.5)");
  sfx("magic", 0.1);
}

// Princess Avril's gift: friends near her slowly recover
function healNearby(h, dt) {
  const amount = h.def.healPerSecond * dt, r = h.def.healRange;
  const friends = [...state.heroes.filter((o) => o !== h), state.dog, ...state.towers.flatMap((t) => t.soldiers)];
  for (const f of friends) if (f && f.hp > 0 && f.hp < f.maxHp && dist(f, h) <= r) f.hp = Math.min(f.maxHp, f.hp + amount);
}

// ---------- Four-legged companions: Max the dog, Bramble the bear ----------
function updatePet(dt) {
  const d = state.dog, h = state.hero;
  if (!d || !h) return;
  const P = d.def;
  if (d.bite > 0) d.bite -= dt;
  d.face += (d.dir - d.face) * Math.min(1, dt * TURN * 1.3);

  if (d.hp <= 0) {                                           // comes back at her side
    d.respawn -= dt;
    if (d.respawn <= 0) {
      d.hp = d.maxHp; d.vx = d.vy = 0; d.target = null;
      const at = h.hp > 0 ? h : h.spawn;
      d.x = at.x + 20; d.y = at.y + 6;
    }
    return;
  }

  if (h.moveTo || h.hunt || h.hp <= 0) d.target = null;
  else if (!d.target || d.target.dead || d.target.reached || dist(d.target, h) > P.engage * 1.4) {
    let best = null;
    for (const e of state.enemies) if (!e.def.flying && dist(e, h) <= P.engage && (!best || dist(e, d) < dist(best, d))) best = e;
    d.target = best;
  }

  let goal, stopAt;
  if (d.target) { goal = d.target; stopAt = P.kind === "bear" ? 18 : 14; }
  else { goal = { x: h.x - h.face * P.follow, y: h.y + 6 }; stopAt = 3; }

  let wantX = 0, wantY = 0;
  const g = dist(d, goal);
  if (g > stopAt) {
    const speed = P.speed * clamp((g - stopAt) / 30, 0.2, 1);
    wantX = ((goal.x - d.x) / g) * speed;
    wantY = ((goal.y - d.y) / g) * speed;
  }
  const k = Math.min(1, dt * ACCEL * (P.kind === "bear" ? 0.9 : 1.4));
  d.vx += (wantX - d.vx) * k;
  d.vy += (wantY - d.vy) * k;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  d.speedNow = Math.hypot(d.vx, d.vy);
  d.moving = d.speedNow > 10;
  if (Math.abs(d.vx) > 12) d.dir = Math.sign(d.vx);
  else if (!d.moving && !d.target) d.dir = h.dir;
  d.phase += dt * (P.kind === "bear" ? 10 : 16) * (d.speedNow / P.speed);

  if (d.target && dist(d, d.target) <= stopAt + 2) {
    d.target.blocked = true;
    d.dir = d.target.x >= d.x ? 1 : -1;
    d.cd -= dt;
    if (d.cd <= 0) { hurt(d.target, P.damage, "physical", true, h); d.cd = 1 / P.rate; d.bite = 0.2; sfx("clash", 0.15); }
    d.target.atkCd = (d.target.atkCd ?? 0.5) - dt;
    if (d.target.atkCd <= 0) {
      d.hp -= d.target.def.attack * (1 - P.armor);
      d.target.atkCd = 1;
      if (d.hp <= 0) { d.hp = 0; d.respawn = P.respawn; d.target = null; addFloater(d.x, d.y - 20, `${P.name} ran off to recover`, "#ffab91", 13); }
    }
  } else if (!d.target && d.hp < d.maxHp) {
    d.hp = Math.min(d.maxHp, d.hp + P.regen * dt);
  }
}

// ---------- Flying companions: Sky the eagle (dives), Cinder the dragon (breathes fire) ----------
function updateFlyer(dt) {
  const g = state.eagle;
  if (!g) return;
  const F = g.def, owner = g.owner, home = owner.hp > 0 ? owner : owner.spawn;
  g.phase += dt * 9;
  if (g.cd > 0) g.cd -= dt;
  if (g.breath > 0) g.breath -= dt;

  const free = owner.hp > 0 && !owner.moveTo && !owner.hunt;
  // The loong remembers where its head has been so its long body can follow
  if (F.kind === "loong") {
    const last = g.trail[0];
    if (!last || dist(last, g) > 5) { g.trail.unshift({ x: g.x, y: g.y }); if (g.trail.length > 16) g.trail.pop(); }
  }
  if (F.kind === "loong") {
    // Picks the monster furthest along the road near her, then dives through it and on along the road,
    // striking everything its head passes
    if (!g.sweep && free && g.cd <= 0) {
      let best = null;
      for (const e of state.enemies) if (dist(e, owner) <= F.engage && (!best || e.travelled > best.travelled)) best = e;
      if (best) {
        const ahead = best.path[Math.min(best.next, best.path.length - 1)];
        const dx = ahead.x - best.x, dy = ahead.y - best.y, l = Math.hypot(dx, dy) || 1;
        g.sweep = { from: { x: g.x, y: g.y }, via: { x: best.x, y: best.y }, to: { x: best.x + (dx / l) * 90, y: best.y + (dy / l) * 90 }, stage: 0, hit: new Set() };
        sfx("screech", 0.6);
      }
    }
  } else if (F.kind === "dragon") {
    // Hovers above her and spits a small fireball at the monster furthest along the road
    if (free && g.cd <= 0) {
      let best = null;
      for (const e of state.enemies) if (dist(e, owner) <= F.engage && (!best || e.travelled > best.travelled)) best = e;
      if (best) {
        g.dir = best.x >= g.x ? 1 : -1;
        state.shots.push({ x: g.x + g.dir * 8, y: g.y, z: 0, total: dist(g, best), target: best, tx: best.x, ty: best.y, dmg: F.damage, def: BOLT, trail: [], hero: owner, fireball: { splash: F.splash, burnTime: F.burnTime, burnDps: F.burnDps } });
        g.cd = 1 / F.rate; g.breath = 0.3;
        sfx("magic", 0.1);
      }
    }
  } else if (!g.dive && g.cd <= 0 && free) {
    let best = null;
    for (const e of state.enemies) if (dist(e, owner) <= F.engage && (!best || e.travelled > best.travelled)) best = e;
    if (best) { g.dive = { target: best, struck: false }; sfx("screech", 0.6); }
  }

  let goal;
  if (g.sweep) {
    const s = g.sweep;
    goal = s.stage === 0 ? s.via : s.stage === 1 ? s.to : { x: home.x, y: home.y - 34 };
    if (s.stage < 2) {                                       // low pass: anything the head brushes gets struck once
      for (const e of state.enemies) if (!e.dead && !s.hit.has(e) && dist(e, { x: g.x, y: g.y + 6 }) <= 24) { s.hit.add(e); hurt(e, F.damage, "physical", true, owner); addBurst(e.x, e.y, 14, "rgba(255,235,59,0.8)"); sfx("clash", 0.1); }
    }
    if (dist(g, goal) < 8) { s.stage++; if (s.stage > 2) { g.sweep = null; g.cd = 1 / F.rate; } }
  } else if (g.dive) {
    const e = g.dive.target;
    if (e.dead || e.reached) { g.dive = null; }
    else if (!g.dive.struck) {
      goal = { x: e.x, y: e.y - (e.def.flying ? 16 : 4) };
      if (dist(g, goal) < 8) { hurt(e, F.damage, "physical", true, owner); g.dive.struck = true; sfx("clash", 0.15); }
    } else {
      goal = { x: home.x, y: home.y - 34 };
      if (dist(g, goal) < 10) { g.dive = null; g.cd = 1 / F.rate; }
    }
  }
  if (!goal) {                                               // lazy circle above her head (the loong traces a wide figure of eight)
    g.angle += dt * (F.kind === "dragon" ? 1.2 : F.kind === "loong" ? 1.0 : 1.6);
    goal = F.kind === "loong"
      ? { x: home.x + Math.sin(g.angle) * 44, y: home.y - 40 + Math.sin(g.angle * 2) * 12 }
      : { x: home.x + Math.cos(g.angle) * 26, y: home.y - 34 + Math.sin(g.angle) * 8 };
  }
  const d = dist(g, goal);
  if (d > 0.5) {
    const step = Math.min(F.speed * dt * (g.dive || g.sweep ? 1.4 : 0.6), d);
    const dx = goal.x - g.x;
    g.x += (dx / d) * step;
    g.y += ((goal.y - g.y) / d) * step;
    if (Math.abs(dx) > 1 && !g.breath) g.dir = Math.sign(dx);
  }
}

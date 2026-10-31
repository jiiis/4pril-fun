import { state } from "./state.js";
import { map } from "./map.js";
import { specializationDef, skillRank, foundationDamage, foundationRate, foundationRange, shotOrigin, archerSlots } from "./towers.js";
import { closestPointOnPath, pointsAlongPath, dist, clamp } from "./util.js";
import { hurt, addBurst } from "./combat.js";
import { sfx } from "./audio.js";

const alive = (enemy) => !enemy.dead && !enemy.reached;
const support = (enemy) => !!(enemy.def.healAura || enemy.def.raise);
const perch = (tower, index) => ({ x: tower.x + (index ? 31 : -31), y: tower.y - 76 });

function falconTarget(tower, spec, bird) {
  let best = null, bestPriority = -1;
  for (const enemy of state.enemies) {
    if (!alive(enemy) || dist(tower, enemy) > spec.range) continue;
    const reserved = tower.falcons.some(other => other !== bird && other.target === enemy);
    const priority = (skillRank(tower, "quarry") && support(enemy) ? 2 : 0) + (reserved ? 0 : 1);
    if (priority > bestPriority || priority === bestPriority && enemy.travelled > best.travelled) {
      best = enemy; bestPriority = priority;
    }
  }
  return best;
}

// Specialization attacks supplement the established crew instead of deleting its investment.
function updateFoundationArrows(tower, dt) {
  tower.foundationCd = Math.max(0, (tower.foundationCd || 0) - dt);
  if (tower.foundationCd > 0) return;
  let target = null;
  for (const enemy of state.enemies) {
    if (alive(enemy) && dist(tower, enemy) <= foundationRange(tower) && (!target || enemy.travelled > target.travelled)) target = enemy;
  }
  if (!target) return;
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.shooter = (tower.shooter + 1) % archerSlots(3).length;
  const origin = shotOrigin(tower);
  state.shots.push({ ...origin, z: 0, total: dist(origin, target), target, tx: target.x, ty: target.y,
    dmg: foundationDamage(tower), def: tower.def, trail: [], fire: true });
  tower.anim = 0.4; tower.lastShot = state.time;
  tower.foundationCd = 1 / foundationRate(tower);
  sfx("arrow", 0.06);
}

function updateFalcons(tower, spec, dt) {
  tower.falcons ||= [];
  const pair = spec.skills.huntingpair, rank = skillRank(tower, "huntingpair");
  while (tower.falcons.length < pair.count[rank]) {
    tower.falcons.push({ ...perch(tower, tower.falcons.length), target: null, returning: false, cd: 0, flight: 0, phase: 0 });
  }
  tower.falcons.forEach((bird, index) => {
    bird.phase += dt * (bird.target || bird.returning ? 14 : 2);
    if (bird.target && (!alive(bird.target) || dist(tower, bird.target) > spec.pursuit || (bird.flight += dt) > spec.flightTime)) {
      bird.target = null; bird.returning = true; bird.cd = 0.3;
    }
    if (!bird.target && !bird.returning) {
      bird.cd = Math.max(0, bird.cd - dt);
      if (bird.cd > 0) return;
      bird.target = falconTarget(tower, spec, bird);
      bird.flight = 0;
      if (!bird.target) return;
      tower.lastShot = state.time;
    }
    const enemy = bird.target;
    const aim = enemy ? { x: enemy.x, y: enemy.y - (enemy.def.flying ? 24 : 8) } : perch(tower, index);
    const distance = dist(bird, aim), step = spec.speed * dt;
    if (distance > step) {
      bird.x += (aim.x - bird.x) / distance * step;
      bird.y += (aim.y - bird.y) / distance * step;
      return;
    }
    bird.x = aim.x; bird.y = aim.y;
    if (!enemy) { bird.returning = false; return; }
    const factor = index ? pair.damageFactor[rank] : 1;
    const bonus = support(enemy) ? spec.skills.quarry.bonus[skillRank(tower, "quarry")] : 0;
    hurt(enemy, spec.damage * factor * (1 + bonus), spec.type);
    const rend = spec.skills.talonrend, amount = rend.amount[skillRank(tower, "talonrend")];
    if (!enemy.dead && enemy.def.armor > 0 && amount > 0 && (!enemy.armorRend || amount >= enemy.armorRend.amount)) {
      enemy.armorRend = { amount, time: rend.duration };
    }
    addBurst(bird.x, bird.y, 9, "rgba(241,204,137,0.75)");
    sfx("arrowHit", 0.06);
    bird.target = null; bird.returning = true; bird.cd = 1 / spec.rate;
  });
}

function patchSites(tower, spec) {
  const first = map.paths.map(path => closestPointOnPath(path, tower)).filter(Boolean).sort((a, b) => a.d - b.d)[0];
  if (!first || first.d > spec.range) return [];
  let second = null, separation = 48;
  for (const path of map.paths) for (const point of pointsAlongPath(path, 24)) {
    const distance = dist(first, point);
    if (dist(tower, point) <= spec.range && distance > separation) { second = point; separation = distance; }
  }
  return second ? [first, second] : [first];
}

function updateBrambles(tower, spec, dt) {
  tower.patchSites ||= patchSites(tower, spec);
  tower.patches ||= [];
  const secondRadius = spec.skills.seeddrift.radius[skillRank(tower, "seeddrift")];
  const count = Math.min(secondRadius ? 2 : 1, tower.patchSites.length);
  while (tower.patches.length < count) {
    const site = tower.patchSites[tower.patches.length];
    tower.patches.push({ x: site.x, y: site.y, age: 0, radius: 0 });
  }
  tower.patches.forEach((patch, index) => {
    patch.age = Math.min(spec.growth, patch.age + dt);
    patch.radius = index ? secondRadius : spec.radius;
  });
  tower.cd -= dt;
  if (tower.cd > 0) return;
  tower.cd = 1 / spec.rate;
  const targets = state.enemies.filter(enemy => alive(enemy) && !enemy.def.flying && tower.patches.some(patch => patch.age >= spec.growth && dist(patch, enemy) <= patch.radius))
    .sort((a, b) => b.travelled - a.travelled).slice(0, spec.targets);
  for (const enemy of targets) {
    hurt(enemy, spec.damage + spec.skills.barbedgrowth.damage[skillRank(tower, "barbedgrowth")], spec.type, false);
    if (!enemy.dead && !(enemy.thornRootCd > 0)) {
      const duration = spec.skills.deeproots.duration[skillRank(tower, "deeproots")];
      enemy.rooted = Math.max(enemy.rooted || 0, duration * (1 - (enemy.def.brambleResistance || 0)));
      enemy.thornRootCd = spec.rootCooldown;
    }
  }
  if (targets.length) { tower.anim = 0.4; tower.lastShot = state.time; }
}

function fireMoonbow(tower, spec) {
  let first = null;
  for (const enemy of state.enemies) if (alive(enemy) && dist(tower, enemy) <= spec.range && (!first || enemy.travelled > first.travelled)) first = enemy;
  if (!first) return;
  const targets = [first], cap = spec.skills.lunarmarks.targets[skillRank(tower, "lunarmarks")];
  while (targets.length < cap) {
    let next = null, nearest = Infinity;
    for (const enemy of state.enemies) {
      if (!alive(enemy) || targets.includes(enemy) || dist(tower, enemy) > spec.range) continue;
      const distance = dist(targets[targets.length - 1], enemy);
      if (distance >= spec.minJump && distance <= spec.jumpRange && distance < nearest) { next = enemy; nearest = distance; }
    }
    if (!next) break;
    targets.push(next);
  }
  const marks = new Map(targets.map(enemy => [enemy, spec.markTime]));
  const origin = { x: tower.x + 35, y: tower.y - 68 };
  const shot = { kind: "moon", ...origin, z: 0, tx: first.x, ty: first.y, total: dist(origin, first), target: first, dmg: spec.damage, def: tower.def, trail: [], tower,
    struck: new Set(), marks, life: spec.markTime, retention: spec.skills.silverthread.retention[skillRank(tower, "silverthread")] };
  tower.moonShots.push(shot); tower.moonFired = state.time;
  state.shots.push(shot);
  tower.angle = Math.atan2(first.y - tower.y, first.x - tower.x);
  tower.anim = 0.4; tower.lastShot = state.time; tower.cd = 1 / spec.rate;
  sfx("arrow", 0.06);
}

export function updateArcher(tower, dt) {
  updateFoundationArrows(tower, dt);
  const spec = specializationDef(tower);
  if (tower.specialization === "falcon") updateFalcons(tower, spec, dt);
  else if (tower.specialization === "thorn") updateBrambles(tower, spec, dt);
  else if (tower.specialization === "moon") {
    tower.moonShots = (tower.moonShots || []).filter(shot => !shot.done);
    tower.cd -= dt;
    // Longer chains never postpone the next paid-for attack. Lifetime bounds this to three arrows.
    if (tower.cd <= 0 && tower.moonShots.length < Math.ceil(spec.markTime * spec.rate)) fireMoonbow(tower, spec);
    tower.moonMarks = new Map();
    for (const shot of tower.moonShots) for (const [enemy, life] of shot.marks) {
      if (!alive(enemy) || life <= dt || dist(tower, enemy) > spec.range + spec.leash) shot.marks.delete(enemy);
      else { shot.marks.set(enemy, life - dt); tower.moonMarks.set(enemy, life - dt); }
    }
  }
}

function nextMoonTarget(shot, spec, origin) {
  let next = null, nearest = Infinity;
  for (const enemy of shot.marks.keys()) {
    if (!alive(enemy) || shot.struck.has(enemy)) continue;
    const distance = dist(origin, enemy);
    if (distance >= spec.minJump && distance <= spec.jumpRange && distance < nearest) { next = enemy; nearest = distance; }
  }
  if (!next) { shot.done = true; return; }
  shot.target = next; shot.total = dist(shot, next);
}

// Each bounded projectile owns its marks, so a later launch cannot overwrite its route.
export function updateMoonShot(shot, dt) {
  const spec = specializationDef(shot.tower);
  shot.life -= dt;
  if (shot.life <= 0 || !state.towers.includes(shot.tower)) { shot.done = true; return; }
  if (!alive(shot.target) || !shot.marks.has(shot.target)) {
    nextMoonTarget(shot, spec, shot);
    if (shot.done) return;
  }
  shot.tx = shot.target.x; shot.ty = shot.target.y;
  const distance = dist(shot, shot.target), step = 420 * dt;
  if (distance <= step) {
    shot.x = shot.tx; shot.y = shot.ty; shot.z = 0;
    hurt(shot.target, shot.dmg, spec.type);
    shot.struck.add(shot.target);
    addBurst(shot.x, shot.y - 6, 8, "rgba(184,212,255,0.8)");
    sfx("arrowHit", 0.06);
    shot.dmg *= shot.retention;
    nextMoonTarget(shot, spec, shot.target);
  } else {
    shot.x += (shot.tx - shot.x) / distance * step; shot.y += (shot.ty - shot.y) / distance * step;
    const progress = clamp(1 - distance / shot.total, 0, 1);
    shot.z = 4 * 14 * progress * (1 - progress);
    shot.trail.push({ x: shot.x, y: shot.y - shot.z });
    if (shot.trail.length > 6) shot.trail.shift();
  }
}

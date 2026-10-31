import { state } from "./state.js";
import { SOLDIER_RESPAWN, ENGAGE_RANGE } from "./config.js";
import { hurt, addBurst } from "./combat.js";
import { soldierDamage, soldierRate, soldierCount, soldierHp, specializationDef, skillRank, escortCount, foundationHp, foundationDamage, foundationRate } from "./towers.js";
import { dist } from "./util.js";
import { sfx } from "./audio.js";

function makeSoldier(t, hp, extra = {}) {
  return { x: t.x, y: t.y, hp, maxHp: hp, cd: 0, respawn: 0, target: null, phase: Math.random() * 6, dir: 1, moving: false, swing: 0, recovery: 0, ...extra };
}

// Hatchlings expire permanently and share a strict living-population cap per tower.
function hatch(t, spec, count, origin) {
  const cap = spec.skills.hatchery.cap[skillRank(t, "hatchery")];
  let living = t.soldiers.filter((s) => s.hatchling && s.hp > 0 && s.life > 0).length;
  for (let i = 0; i < count && living < cap; i++, living++) {
    t.soldiers.push(makeSoldier(t, spec.hatchling.hp, { x: origin.x, y: origin.y, hatchling: true, life: spec.hatchling.lifetime }));
    addBurst(origin.x, origin.y, 10, "rgba(174,213,129,0.65)");
  }
}

export function updateSoldiers(t, dt) {
  const spec = specializationDef(t), n = soldierCount(t), hp = soldierHp(t);
  const brood = t.specialization === "brood", escorts = escortCount(t);
  const stepRank = skillRank(t, "cloudstep"), heartRank = skillRank(t, "stoneheart"), earthRank = skillRank(t, "earthbreaker");
  let adults = 0;
  for (const s of t.soldiers) if (!s.hatchling && !s.escort) adults++;
  while (adults < n) { t.soldiers.push(makeSoldier(t, hp)); adults++; }
  let guards = t.soldiers.filter((s) => s.escort).length;
  while (guards < escorts) { t.soldiers.push(makeSoldier(t, foundationHp(t), { escort: true })); guards++; }
  if (brood) {
    t.soldiers = t.soldiers.filter((s) => !s.hatchling || (s.hp > 0 && s.life > 0));
    const interval = spec.skills.hatchery.interval[skillRank(t, "hatchery")];
    t.hatchCd = Math.min(t.hatchCd ?? interval, interval);
    const adult = t.soldiers.find((s) => !s.hatchling && s.hp > 0);
    if (adult && (t.hatchCd -= dt) <= 0) { hatch(t, spec, 1, adult); t.hatchCd = interval; }
  }
  let adultIndex = 0, hatchIndex = 0, guardIndex = 0;
  for (const s of t.soldiers) {
    const cloud = !s.escort && t.specialization === "cloud", colossus = !s.escort && t.specialization === "colossus";
    const engage = s.escort ? ENGAGE_RANGE : cloud ? spec.skills.cloudstep.engage[stepRank] : spec?.engage ?? ENGAGE_RANGE;
    if (s.hatchling && (s.life -= dt) <= 0) { s.hp = 0; s.target = null; continue; }
    // Preserve wounds when upgrading; fallen units still wait for their respawn.
    const maxHp = s.escort ? foundationHp(t) : s.hatchling ? spec.hatchling.hp : hp;
    if (s.maxHp !== maxHp) { if (s.hp > 0) s.hp += maxHp - s.maxHp; s.maxHp = maxHp; }
    s.level = Math.min(t.level, 3);
    s.specialization = s.escort ? null : t.specialization || null;
    const off = s.escort ? (guardIndex++ - (escorts - 1) / 2) * 24 : s.hatchling ? (hatchIndex++ - 2) * 10 : (adultIndex++ - (n - 1) / 2) * 16;
    s.home = { x: t.rally.x + off, y: t.rally.y + off * 0.4 + (s.hatchling ? 12 : 0) };
    if (s.hp <= 0) {
      if (s.hatchling) continue;
      s.respawn -= dt;
      if (s.respawn <= 0) { s.hp = s.maxHp; s.x = t.x; s.y = t.y; s.target = null; s.cd = 0; s.recovery = 0; }
      continue;
    }
    if (spec) s.cd = Math.max(0, s.cd - dt);
    s.recovery = Math.max(0, s.recovery - dt);
    if (!s.target || s.target.dead || s.target.reached || dist(s.target, s.home) > engage) {
      const near = state.enemies.filter((e) => !e.dead && !e.reached && (cloud || !e.def.flying) && dist(e, s.home) <= engage);
      near.sort((a, b) => (cloud ? Number(!!b.def.flying) - Number(!!a.def.flying) : 0) || b.travelled - a.travelled);
      s.target = near.find((e) => !t.soldiers.some((o) => o !== s && o.hp > 0 && o.target === e)) || near[0] || null;
    }
    const recovering = cloud && s.recovery > 0;
    const dest = recovering ? s.home : s.target || s.home;
    const d = dist(s, dest);
    s.moving = false;
    s.swing = Math.max(0, s.swing - dt);

    if (!recovering && s.target && d <= 16) {
      if (!spec) s.cd -= dt;
      const target = s.target;
      if (!cloud) target.blocked = true;
      s.dir = target.x >= s.x ? 1 : -1;
      if (s.cd <= 0) {
        const damage = s.escort ? foundationDamage(t) : s.hatchling ? spec.hatchling.damage : soldierDamage(t);
        const airBonus = cloud && target.def.flying ? spec.skills.skyspears.airDamage[skillRank(t, "skyspears")] : 0;
        hurt(target, damage + airBonus, s.escort ? t.def.type : spec?.type || t.def.type);
        if (colossus) {
          const earth = spec.skills.earthbreaker, radius = earth.radius[earthRank];
          let hits = 1;
          for (const e of state.enemies) {
            if (hits >= earth.targets[earthRank]) break;
            if (e !== target && !e.dead && !e.reached && !e.def.flying && dist(e, target) <= radius) { hurt(e, damage, spec.type); hits++; }
          }
          addBurst(target.x, target.y, radius, "rgba(128,203,166,0.65)");
        }
        s.cd = 1 / (s.escort ? foundationRate(t) : s.hatchling ? spec.hatchling.rate : soldierRate(t));
        s.swing = colossus ? 0.45 : 0.2;
        if (cloud) { s.recovery = spec.skills.cloudstep.recovery[stepRank]; addBurst(target.x, target.y - (target.def.flying ? 18 : 0), 12, "rgba(179,229,252,0.7)"); }
        sfx("clash", 0.12);
      }
      if (!target.dead) {
        target.atkCd = (target.atkCd ?? 0.5) - dt;
        if (target.atkCd <= 0) {
          const armor = s.escort || s.hatchling ? 0 : brood ? spec.skills.chitin.armor[skillRank(t, "chitin")] : spec?.armor || 0;
          s.hp -= target.def.attack * (1 - armor);
          target.atkCd = 1;
          if (s.hp <= 0) {
            s.respawn = s.escort ? SOLDIER_RESPAWN : colossus ? spec.skills.stoneheart.respawn[heartRank] : spec?.respawn ?? SOLDIER_RESPAWN;
            s.target = null;
            if (brood && !s.hatchling) hatch(t, spec, spec.skills.lastbrood.count[skillRank(t, "lastbrood")], s);
          }
        }
      }
    } else if (d > 1) {                                   // walk to the fight or back home
      const speed = s.escort ? 90 : s.hatchling ? spec.hatchling.speed : cloud ? spec.skills.cloudstep.speed[stepRank] : spec?.speed ?? 90;
      const step = Math.min(speed * dt, d);
      const dx = dest.x - s.x;
      s.x += (dx / d) * step;
      s.y += ((dest.y - s.y) / d) * step;
      if (Math.abs(dx) > 0.5) s.dir = Math.sign(dx);
      s.moving = true;
      s.phase += dt * 12;
    } else if (s.hp < s.maxHp) {                          // resting at home: slowly heal
      const regen = s.escort ? 6 : colossus ? spec.skills.stoneheart.regen[heartRank] : spec?.regen ?? 6;
      s.hp = Math.min(s.maxHp, s.hp + regen * dt);
    }
  }
}

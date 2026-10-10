import { state } from "./state.js";
import { CORPSE_TIME } from "./config.js";
import { sfx } from "./audio.js";

// Deal damage to a monster. Physical damage is reduced by its armour.
// source = the hero who struck the blow (or whose dog did); kills earn that hero XP.
export function hurt(e, dmg, type, flash = true, source = null) {
  if (e.dead) return;
  if (type === "physical") dmg *= 1 - e.def.armor;
  if (type === "magic" && e.def.magicWeak) dmg *= e.def.magicWeak;
  if (e.cursed > 0) dmg *= e.curseFactor || 1.4;
  e.hp -= dmg;
  if (flash) e.hitFlash = 0.12;
  if (e.hp <= 0) {
    e.dead = true;
    const reward = Math.round(e.def.gold * state.diff.goldMul);
    state.gold += reward;
    if (source && source.xpPending !== undefined) source.xpPending += Math.round(e.def.gold * 2.5);
    addFloater(e.x, e.y - e.def.size, `+${reward}`, "#ffd54f");
    addBurst(e.x, e.y, e.def.size * 0.7, "rgba(255,255,255,0.7)");
    // Every corpse falls differently: random direction, pose, and a unique scatter of bones
    const r = Math.random;
    if (!e.def.noCorpse) state.corpses.push(makeCorpse(e.x, e.y, e.type, e.def, e.dir, e.phase));
    // A few drops of blood on the ground, and sometimes a death cry (trolls always roar)
    addBlood(e.x, e.y, e.def.size);
    const cry = { goblin: "dieGoblin", wolf: "dieWolf", orc: "dieOrc", troll: "dieTroll", bat: "dieBat", skeleton: "dieSkeleton", shaman: "dieShaman", golem: "dieGolem",
      slime: "dieSlime", slimeling: "dieSlime", thief: "dieGoblin", necromancer: "dieNecro", wyvern: "dieWyvern" }[e.type] || "die";
    if (e.type === "troll" || e.type === "golem" || e.type === "wyvern" || Math.random() < 0.5) sfx(cry, 0.15);
    sfx("coin", 0.12);
  }
}

// A fallen body: it lies where it fell for a while, then only the bones remain, then they fade
export function makeCorpse(x, y, type, def, dir, phase, extra = {}) {
  const r = Math.random;
  return {
    x, y, type, def, dir, phase, life: CORPSE_TIME, maxLife: CORPSE_TIME,
    angle: r() * Math.PI * 2,                    // which way the body is turned
    pose: Math.floor(r() * 3),                   // 0 on its back, 1 face down, 2 curled on its side
    bend: (r() - 0.5) * 0.9,                     // how crooked the spine is
    ribs: 3 + Math.floor(r() * 3),
    skullSide: r() < 0.5 ? -1 : 1,
    bones: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ x: (r() - 0.5) * 36, y: (r() - 0.5) * 26, a: r() * Math.PI, len: 6 + r() * 6 })),
    ...extra,
  };
}

export function addFloater(x, y, text, color, size = 16) {
  state.floaters.push({ x, y, text, color, life: 1, size });
}

export function addBurst(x, y, r, color) {
  state.bursts.push({ x, y, maxR: r, life: 0.3, maxLife: 0.3, color });
}

export function addSmoke(x, y, count, spread = 6) {
  for (let i = 0; i < count; i++) {
    const life = 0.7 + Math.random() * 0.5;
    state.smoke.push({
      x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread,
      r: 3 + Math.random() * 4, vx: (Math.random() - 0.5) * 24, vy: -14 - Math.random() * 16,
      life, maxLife: life,
    });
  }
}

// A small, subtle splash: a handful of dark red drops that soak away over time
export function addBlood(x, y, size) {
  // One main pool under the body plus a spray of drops around it
  const drops = [{ x: 0, y: 2, r: 3 + size * 0.12 }];
  const n = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = size * 0.15 + Math.random() * size * 0.5;
    drops.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.6, r: 1.5 + Math.random() * (1.5 + size * 0.06) });
  }
  state.blood.push({ x, y, drops, life: 5, maxLife: 5 });   // gone before the bones are (CORPSE_TIME)
}

export function addScorch(x, y, r) {
  state.scorches.push({ x, y, r, life: 6, maxLife: 6 });
}

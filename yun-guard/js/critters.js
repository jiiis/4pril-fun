import { state } from "./state.js";
import { map } from "./map.js";
import { dist } from "./util.js";
import { addFloater, addBurst, addBlood } from "./combat.js";
import { sfx } from "./audio.js";

// How each animal behaves: how fast it moves, how far it wanders from home,
// and how long it stands around (grazing) between walks.
const BEHAVIOUR = {
  bunny: { speed: 70, wander: 35, idleMin: 1.0, idleMax: 3.0, hops: true },
  deer:  { speed: 40, wander: 40, idleMin: 2.0, idleMax: 5.0 },
  sheep: { speed: 25, wander: 30, idleMin: 2.5, idleMax: 6.0 },
  fox:   { speed: 60, wander: 45, idleMin: 1.5, idleMax: 4.0 },
  chicken: { speed: 35, wander: 25, idleMin: 1.0, idleMax: 3.0 },
  cow:   { speed: 22, wander: 30, idleMin: 3.0, idleMax: 7.0 },
  duck:  { speed: 32, wander: 30, idleMin: 1.0, idleMax: 3.5 },
};

const POOPERS = { sheep: 1.2, cow: 2.2, deer: 1.3, bunny: 0.9 };   // who poops, and how big (ducks are too polite)
const REAR = { sheep: 10, cow: 17, deer: 13, bunny: 7 };            // how far behind the animal's centre its rump is

export function initCritters() {
  state.critters = map.critters.map((c) => ({
    type: c.type, home: { x: c.x, y: c.y }, x: c.x, y: c.y,
    dir: Math.random() < 0.5 ? 1 : -1, phase: Math.random() * 6,
    idle: 1 + Math.random() * 2, target: null,
    hp: 10, fleeing: false,
  }));
}

// A hero caught one. It vanishes in a puff, leaves a small splash, and earns a little gold.
export function slayCritter(c) {
  if (!state.critters.includes(c)) return;
  state.critters = state.critters.filter((x) => x !== c);
  state.gold += 2;
  addFloater(c.x, c.y - 16, "+2", "#ffd54f");
  addBurst(c.x, c.y, 12, "rgba(255,255,255,0.8)");
  addBlood(c.x, c.y, c.type === "deer" || c.type === "cow" ? 22 : c.type === "chicken" || c.type === "duck" ? 10 : 16);
  sfx("die", 0.08); sfx("coin", 0.12);
}

export function updateCritters(dt) {
  const hunters = state.heroes.filter((h) => h.hp > 0 && h.hunt);
  const huntedBy = (c) => hunters.find((h) => h.hunt === c);
  for (const p of state.poops) { p.life -= dt; p.age += dt; }
  state.poops = state.poops.filter((p) => p.life > 0);
  for (const c of state.critters) {
    // Grazers leave the odd dropping behind while they stand about: a little squat, then the dropping falls
    if (!c.fleeing && !c.target && !c.pooping && POOPERS[c.type] && Math.random() < dt * 0.025 && state.poops.length < 60) {
      c.pooping = 1.3; c.poopDue = 0.55;                                           // the squat lasts 1.3s; the dropping lands a little way in
      c.idle = Math.max(c.idle || 0, 1.5);                                          // and the animal stays put for it
    }
    if (c.pooping && c.fleeing) { c.pooping = 0; c.poopDue = null; }           // no time for that when chased
    if (c.pooping) {
      c.pooping -= dt;
      if (c.poopDue !== null && (c.poopDue -= dt) <= 0) {
        state.poops.push({ x: c.x - c.dir * REAR[c.type], y: c.y + 2, size: POOPERS[c.type], n: 1 + Math.floor(Math.random() * 3), life: 45, age: 0, seed: Math.random() * 10 });
        c.poopDue = null;
      }
      if (c.pooping <= 0) c.pooping = 0;
    }
    const b = BEHAVIOUR[c.type];
    const hunter = huntedBy(c);
    c.hunted = !!hunter;
    // Being chased by a hero: run away (heroes are faster, but it's a chase)
    if (hunter && dist(c, hunter) < 90) {
      const dx = c.x - hunter.x, dy = c.y - hunter.y, d = Math.hypot(dx, dy) || 1;
      c.target = { x: Math.max(16, Math.min(944, c.x + (dx / d) * 40)), y: Math.max(20, Math.min(585, c.y + (dy / d) * 40)) };
      c.dir = dx >= 0 ? 1 : -1;
      c.fleeing = true;
    }
    if (c.target) {
      const d = dist(c, c.target);
      const step = Math.min(b.speed * (c.fleeing ? 1.2 : 1) * dt, d);   // a fright makes them quicker, but a legend still catches up
      c.x += ((c.target.x - c.x) / d) * step;
      c.y += ((c.target.y - c.y) / d) * step;
      c.phase += dt * (b.hops ? 9 : 8);
      if (d <= step + 0.5) { c.target = null; c.idle = c.fleeing ? 0.2 : b.idleMin + Math.random() * (b.idleMax - b.idleMin); c.phase = 0; c.fleeing = false; }
    } else {
      c.idle -= dt;
      c.phase += dt * 2;                       // slow grazing nod
      if (c.idle <= 0) {
        const a = Math.random() * Math.PI * 2, r = b.wander * (0.4 + Math.random() * 0.6);
        c.target = { x: c.home.x + Math.cos(a) * r, y: c.home.y + Math.sin(a) * r };
        c.dir = c.target.x >= c.x ? 1 : -1;
      }
    }
  }
}

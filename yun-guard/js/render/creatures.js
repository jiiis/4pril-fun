import { ctx, withCtx, rect as rect0, circle as circle0, ellipse as ellipse0, poly as poly0, line, shadow } from "./gfx.js";

// Tinting (hit flash, frost, fresh corpses) used ctx.filter, which drops the whole canvas onto a slow software
// path and made the game stutter every time an arrow landed. Instead the creature is drawn into a small scratch
// canvas, tinted there with source-atop, and copied back: a few cheap GPU operations.
const scratch = document.createElement("canvas"), sctx = scratch.getContext("2d");
function drawTinted(size, tint, drawFn) {
  const m = ctx.getTransform(), scale = Math.hypot(m.a, m.b);
  const half = Math.ceil(size * 2.2 * scale), full = half * 2;
  if (scratch.width !== full || scratch.height !== full) { scratch.width = full; scratch.height = full; }
  else { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, full, full); }
  sctx.setTransform(m.a, m.b, m.c, m.d, half, half);
  withCtx(sctx, drawFn);
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = "source-atop";
  sctx.fillStyle = tint; sctx.fillRect(0, 0, full, full);
  sctx.globalCompositeOperation = "source-over";
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch, Math.round(m.e) - half, Math.round(m.f) - half);
  ctx.restore();
}

// Monster outlines stay subtle: every shape helper used here softens its outline colour to ~45% and thins it,
// so the drawings below can keep naming plain colours.
const soft = (c) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},0.45)` : c);
const rect = (c, x, y, w, h, fill, stroke, lw = 2) => rect0(c, x, y, w, h, fill, soft(stroke), lw * 0.7);
const circle = (c, x, y, r, fill, stroke, lw = 1.5) => circle0(c, x, y, r, fill, soft(stroke), lw * 0.7);
const ellipse = (c, x, y, rx, ry, fill, stroke, lw = 1.5) => ellipse0(c, x, y, rx, ry, fill, soft(stroke), lw * 0.7);
const poly = (c, pts, fill, stroke, lw = 2) => poly0(c, pts, fill, soft(stroke), lw * 0.7);
import { state } from "../state.js";

// Monsters are drawn with shapes and animated by their walking "phase".
// Each drawing faces right; we flip the canvas when a monster walks left.
export function drawEnemy(e) {
  const flying = !!e.def.flying;
  const lift = flying ? 18 + Math.sin(e.phase * 0.7) * 3 : 0;   // flyers hover above the road
  const bob = Math.sin(e.phase) * 1.5;
  ctx.globalAlpha = flying ? 0.6 : 1;
  shadow(ctx, e.x, e.y + e.def.size * 0.45, e.def.size * (flying ? 0.3 : 0.45), e.def.size * 0.16);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(e.x, e.y - lift);
  ctx.scale(e.dir, 1);
  if (!e.wasBlocked && !flying) dust(e.phase, e.def.size);   // little puffs of dust behind the feet while walking
  ctx.translate(0, bob);
  const body = () => CREATURES[e.type](e.phase, e.wasBlocked);
  if (e.hitFlash > 0) drawTinted(e.def.size, "rgba(255,255,255,0.5)", body);
  else if (e.frost) drawTinted(e.def.size, "rgba(150,210,240,0.5)", body);   // chilled: a pale, bluish tint
  else body();
  ctx.restore();

  if (e.frost) drawIce(e);
  if (e.poison) drawPoison(e);
  if (e.cursed > 0) drawCurse(e);
  if (e.staticSlow > 0) drawStatic(e);
  if (e.rooted > 0) drawVines(e);
  if (e.burn) drawFlames(e);

  // Health bar
  const w = e.def.size, x = e.x - w / 2, y = e.y - e.def.size * 0.85;
  const pct = Math.max(e.hp / e.maxHp, 0);
  rect(ctx, x, y, w, 4, "#222");
  rect(ctx, x, y, w * pct, 4, pct > 0.5 ? "#66bb6a" : pct > 0.25 ? "#ffa726" : "#ef5350");
}

// A fallen monster: first it lies on the road, then only its bones remain, then it fades.
export function drawCorpse(c) {
  const age = c.maxLife - c.life;
  const s = c.def.size / 26;
  ctx.save();
  ctx.translate(c.x, c.y);
  if (age < 2) {
    // The body lies where it fell, turned a random way and in one of three poses
    ctx.globalAlpha = 0.9;
    ctx.rotate(c.angle);
    if (c.pose === 1) ctx.scale(1, -1);                        // face down
    if (c.pose === 2) { ctx.rotate(0.5); ctx.scale(1, 0.75); } // curled on its side
    ctx.scale(c.dir, 1);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-c.def.size * 0.2, 0);
    drawTinted(c.def.size, "rgba(70,60,60,0.55)", () => CREATURES[c.type](c.phase, true));   // drained and greyed
  } else {
    // Skeleton: a crooked spine, a random number of ribs, the skull to one side, loose bones scattered about
    ctx.globalAlpha = Math.min(1, c.life / 1.5) * 0.95;
    ctx.rotate(c.angle);
    ctx.scale(c.dir * s, s);
    const bend = c.bend;
    line(ctx, -12, 2, -2, 2 + bend * 4, "#e0e0e0", 2.2);
    line(ctx, -2, 2 + bend * 4, 8, 2 + bend * 10, "#e0e0e0", 2.2);
    for (let i = 0; i < c.ribs; i++) {
      const rx = -9 + i * (14 / c.ribs), ry = 2 + bend * (rx > -2 ? (rx + 2) * 0.9 + 4 * 0 : 0) * 0.6;
      line(ctx, rx, ry - 6, rx + bend * 2, ry + 6, "#e0e0e0", 1.6);
    }
    const sx = 13, sy = 2 + bend * 10 + c.skullSide * 3;
    circle(ctx, sx, sy, 5, "#eeeeee", "#9e9e9e", 1);
    circle(ctx, sx + 1.5, sy - 1, 1.3, "#424242"); circle(ctx, sx - 1.5, sy - 1, 1.3, "#424242");
    line(ctx, sx - 2, sy + 3, sx + 3, sy + 3, "#9e9e9e", 1);
    for (const b of c.bones) {
      const dx = Math.cos(b.a) * b.len / 2, dy = Math.sin(b.a) * b.len / 2;
      line(ctx, b.x - dx, b.y - dy, b.x + dx, b.y + dy, "#e0e0e0", 2);
      circle(ctx, b.x - dx, b.y - dy, 1.6, "#e0e0e0"); circle(ctx, b.x + dx, b.y + dy, 1.6, "#e0e0e0");
    }
  }
  ctx.restore();
}

// Willow's vines: thorny tendrils curling up from the ground around a rooted monster
function drawVines(e) {
  const s = e.def.size, t = (state.time * 1000) / 300;
  const fade = Math.min(1, e.rooted / 0.4);
  ctx.globalAlpha = fade;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.3, bx = e.x + Math.cos(a) * s * 0.35, by = e.y + s * 0.42;
    const h = s * (0.45 + 0.1 * Math.sin(t + i));
    ctx.strokeStyle = "#558b2f"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx + Math.sin(a) * 6, by - h * 0.4, bx - Math.sin(a) * 6, by - h * 0.7, bx + Math.cos(t + i) * 3, by - h);
    ctx.stroke();
    circle(ctx, bx + Math.cos(t + i) * 3, by - h, 2, "#7cb342");                                      // leaf tip
    circle(ctx, bx + Math.sin(a) * 4, by - h * 0.45, 1.2, "#33691e");                                 // thorn
  }
  ctx.globalAlpha = 1;
}

// Venom: sickly green drips and bubbles around a poisoned monster
function drawPoison(e) {
  const s = e.def.size, t = (state.time * 1000) / 350;
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.6 + i / 4) % 1, px = e.x + Math.sin(i * 2.1 + t * 0.3) * s * 0.35, py = e.y - s * 0.1 + k * s * 0.5;
    ctx.globalAlpha = 0.8 * (1 - k);
    ellipse(ctx, px, py, 1.4, 2.2 + k * 2, "#8bc34a");
  }
  ctx.globalAlpha = 0.5; circle(ctx, e.x, e.y - s * 0.55, s * 0.3, "rgba(139,195,74,0.35)"); ctx.globalAlpha = 1;
}

// Curse: a violet skull hovering over the monster, with dark motes orbiting it
function drawCurse(e) {
  const s = e.def.size, t = (state.time * 1000) / 400, sy = e.y - s * 0.95 - (e.def.flying ? 18 : 0) - 8 + Math.sin(t * 2) * 1.5;
  const fade = Math.min(1, e.cursed / 0.5);
  ctx.globalAlpha = 0.9 * fade;
  circle(ctx, e.x, sy, 4, "#ce93d8", "#7b1fa2", 0.8);
  circle(ctx, e.x - 1.4, sy - 0.6, 1, "#4a148c"); circle(ctx, e.x + 1.4, sy - 0.6, 1, "#4a148c"); line(ctx, e.x - 1.5, sy + 2.5, e.x + 1.5, sy + 2.5, "#7b1fa2", 1);
  for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; circle(ctx, e.x + Math.cos(a) * 8, sy + Math.sin(a) * 3, 1.2, "#7b1fa2"); }
  ctx.globalAlpha = 1;
}

// Static: little blue sparks jumping off a monster caught in the field
function drawStatic(e) {
  const s = e.def.size, t = Math.floor((state.time * 1000) / 60);
  for (let i = 0; i < 3; i++) {
    const a = (t * 0.9 + i * 2.1) % 6.28, px = e.x + Math.cos(a) * s * 0.4, py = e.y - s * 0.3 + Math.sin(a) * s * 0.3;
    line(ctx, px, py, px + Math.sin(t + i) * 4, py - 3 - Math.cos(t * 1.3 + i) * 3, "#e1f5fe", 1.2);
  }
}

// Ice crystals clinging to a chilled monster, with a few drifting snowflakes
function drawIce(e) {
  const s = e.def.size, t = (state.time * 1000) / 400;
  const fade = Math.min(1, e.frost.time / 0.5);
  ctx.globalAlpha = 0.85 * fade;
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + 0.4, cx = e.x + Math.cos(a) * s * 0.42, cy = e.y + Math.sin(a) * s * 0.3 - s * 0.1;
    const h = s * 0.16 + (i % 2) * s * 0.06;
    poly(ctx, [[cx, cy - h], [cx + h * 0.45, cy], [cx, cy + h * 0.6], [cx - h * 0.45, cy]], "rgba(224,247,250,0.9)", "#4dd0e1", 0.8);
  }
  ctx.globalAlpha = 0.5 * fade;
  for (let i = 0; i < 3; i++) {
    const k = (t + i / 3) % 1;
    circle(ctx, e.x + Math.sin(t * 2 + i * 2) * s * 0.3, e.y - s * 0.3 - k * s * 0.5, 1.2, "#ffffff");
  }
  ctx.globalAlpha = 1;
}

// Flames licking over a burning monster, plus a wisp of smoke
function drawFlames(e) {
  const s = e.def.size, t = (state.time * 1000) / 90;
  for (let i = 0; i < 4; i++) {
    const fx = e.x + Math.sin(t * 0.9 + i * 2.1) * s * 0.3;
    const base = e.y + s * 0.2 - i * s * 0.12;
    const hgt = s * (0.35 + 0.15 * Math.sin(t + i * 1.7));
    ctx.globalAlpha = 0.85;
    poly(ctx, [[fx - s * 0.1, base], [fx + s * 0.1, base], [fx + Math.sin(t * 1.3 + i) * 2, base - hgt]], "#ff9800");
    poly(ctx, [[fx - s * 0.05, base], [fx + s * 0.05, base], [fx + Math.sin(t * 1.3 + i) * 1.5, base - hgt * 0.6]], "#ffeb3b");
  }
  ctx.globalAlpha = 0.3;
  circle(ctx, e.x + Math.sin(t * 0.5) * 3, e.y - s * 0.7 - (t % 10) * 1.5, 3 + (t % 10) * 0.4, "#9e9e9e");
  ctx.globalAlpha = 1;
}

// ---------- Shared helpers ----------
// Rounded body with a highlight on the top-left so it looks solid instead of flat.
function body(x, y, rx, ry, light, dark, stroke) {
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.45, 1, x, y, Math.max(rx, ry) * 1.25);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ellipse(ctx, x, y, rx, ry, g, stroke, 1.2);
}
// Eyes blink every few seconds.
function eye(x, y, r, iris, phase, pupil = "#000") {
  if (phase % 9 < 0.35) { line(ctx, x - r, y, x + r, y, "#1b1b1b", 1.2); return; }
  circle(ctx, x, y, r, "#fff");
  circle(ctx, x + r * 0.25, y, r * 0.6, iris);
  circle(ctx, x + r * 0.35, y, r * 0.3, pupil);
  circle(ctx, x + r * 0.05, y - r * 0.35, r * 0.2, "rgba(255,255,255,0.9)");   // glint
}
function fang(x, y, h, up = true) {
  poly(ctx, [[x - 1, y], [x + 1, y], [x, y + (up ? -h : h)]], "#fff", "#9e9e9e", 0.5);
}
function dust(phase, size) {
  const k = (phase / (Math.PI * 2)) % 1;
  ctx.globalAlpha = 0.18 * (1 - k);
  circle(ctx, -size * 0.3 - k * 10, size * 0.5, 2 + k * 4, "#d7ccc8");
  ctx.globalAlpha = 0.12 * (1 - ((k + 0.5) % 1));
  circle(ctx, -size * 0.45 - ((k + 0.5) % 1) * 10, size * 0.48, 2 + ((k + 0.5) % 1) * 4, "#d7ccc8");
  ctx.globalAlpha = 1;
}

const CREATURES = {
  // A sneaky green goblin in a ragged vest with a rusty dagger
  goblin(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 4;
    const arm = still ? Math.sin(phase * 2) * 2 : sw * 0.4;        // fidgets when held in place
    const breathe = Math.sin(phase * 0.8) * 0.4;
    line(ctx, -3, 6, -3 + sw, 14, "#2e7d32", 3);                   // legs
    line(ctx, 3, 6, 3 - sw, 14, "#2e7d32", 3);
    ellipse(ctx, -1 + sw, 14.5, 3.5, 1.6, "#4e342e");              // pointy shoes
    ellipse(ctx, 5 - sw, 14.5, 3.5, 1.6, "#4e342e");
    body(0, 2, 7, 8 + breathe, "#81c784", "#2e7d32", "#1b5e20");   // body
    poly(ctx, [[-6.5, -3], [-3, -5], [-2, 3], [-4, 9], [-6.5, 7]], "#6d4c41", "#3e2723", 1);   // vest
    poly(ctx, [[6.5, -3], [3, -5], [2, 3], [4, 9], [6.5, 7]], "#6d4c41", "#3e2723", 1);
    line(ctx, -5, -1, -4, 7, "#8d6e63", 0.8); line(ctx, 5, -1, 4, 7, "#8d6e63", 0.8);   // stitching
    rect(ctx, -6, 8, 12, 2.5, "#3e2723");                          // belt
    circle(ctx, 0, 9.2, 1.2, "#ffd54f");
    line(ctx, -4, 0, -10, 5, "#43a047", 2.5);                      // back arm with loot sack
    body(-11, 8, 3.5, 3.5, "#a1887f", "#5d4037", "#4e342e");
    line(ctx, -11, 4.5, -11, 3, "#4e342e", 1.5);
    line(ctx, 2, 0, 9, 3 + arm, "#43a047", 3);                     // front arm with rusty dagger
    circle(ctx, 9, 3 + arm, 1.8, "#43a047");
    line(ctx, 9, 3 + arm, 17, -4 + arm, "#b0bec5", 2.2);
    line(ctx, 11.5, 1.5 + arm, 14, -1 + arm, "#8d6e63", 1);
    line(ctx, 8, 0 + arm, 11, 4 + arm, "#5d4037", 2);
    poly(ctx, [[-5, -10], [-14, -18], [-4, -5]], "#66bb6a", "#1b5e20", 1);   // ears
    poly(ctx, [[-6, -10], [-11, -15], [-5, -7]], "#a5d6a7");
    poly(ctx, [[8, -10], [17, -18], [8, -5]], "#66bb6a", "#1b5e20", 1);
    poly(ctx, [[9, -10], [14, -15], [8, -7]], "#a5d6a7");
    body(2, -9, 7, 7, "#a5d6a7", "#43a047", "#1b5e20");            // head
    circle(ctx, -2, -13, 1.2, "#43a047"); circle(ctx, 6, -14, 0.9, "#43a047");   // warts
    line(ctx, 2, -13, 7, -12.5, "#1b5e20", 1.5);                    // brow
    eye(5, -10, 2.2, "#ffeb3b", phase, "#b71c1c");
    circle(ctx, 8.5, -8, 1.1, "#388e3c");                           // nose
    line(ctx, 0, -5, 7, -5, "#1b5e20", 1.5);                        // grin
    fang(2.5, -5, 2.5, false); fang(5.5, -5, 2, false);
    ellipse(ctx, 4, -3.5, 1.5, 1, "#e57373");                       // tongue
    for (const [hx, hy] of [[-2, -16], [1, -17], [4, -16.5]]) line(ctx, hx, hy, hx - 1, hy - 3, "#1b5e20", 1.5);
  },

  // A lean grey wolf, body stretching with every bound
  wolf(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 4;
    const stretch = still ? 0 : Math.sin(phase) * 1.2;             // body lengthens mid-stride
    const pant = Math.max(0, Math.sin(phase * 2)) * 1.2;
    for (const [lx, d] of [[-8, 1], [-3, -1], [5, 1], [10, -1]]) {
      line(ctx, lx, 3, lx + sw * d, 12, "#616161", 3);
      ellipse(ctx, lx + sw * d + 1, 12.5, 2.5, 1.3, "#424242");
    }
    body(0, 0, 13 + stretch, 7 - stretch * 0.3, "#9e9e9e", "#616161", "#424242");
    ellipse(ctx, -1, -3, 11, 3.5, "#5c5c5c");                       // dark back
    ellipse(ctx, 1, 3, 9, 3, "#bdbdbd");                            // pale belly
    for (const bx of [-8, -4, 0, 4]) line(ctx, bx, -6, bx - 1.5, -9.5, "#424242", 1.5);   // bristles
    line(ctx, -13, -2, -21, -8 + sw * 0.5, "#757575", 4);           // tail
    circle(ctx, -22, -9 + sw * 0.5, 3, "#9e9e9e");
    body(13, -4, 6, 6, "#9e9e9e", "#616161", "#424242");            // head
    ellipse(ctx, 19, -2, 4.5, 3, "#9e9e9e", "#424242", 0.8);        // snout
    circle(ctx, 22.5, -2.5, 1.5, "#212121");
    line(ctx, 17, 0.5, 22, 0 + pant, "#424242", 1);                 // jaw opens as it pants
    fang(18, 0.5, 2, false); fang(20.5, 0.5, 1.6, false);
    if (pant > 0.6) ellipse(ctx, 20, 1.5 + pant, 1.6, 1, "#e57373");   // tongue
    poly(ctx, [[8, -8], [10, -15], [13, -7]], "#616161", "#424242", 1);   // ears
    poly(ctx, [[12, -8], [14.5, -15], [17, -7]], "#616161", "#424242", 1);
    poly(ctx, [[13, -8.5], [14.5, -13], [16, -8]], "#bcaaa4");
    eye(15, -5, 1.8, "#ffc107", phase);
    line(ctx, 12.5, -7.5, 16.5, -6.5, "#424242", 1.2);              // brow
    line(ctx, -4, 1, 0, -2, "#4e4e4e", 1); line(ctx, -3, -1.5, -1.5, 0.5, "#4e4e4e", 1);   // scar
  },

  // A purple cave bat, wings beating, fangs bared
  bat(phase) {
    const flap = Math.sin(phase * 1.6);
    for (const side of [-1, 1]) {                                   // wings: membrane stretched between bony fingers
      const tipY = -6 - flap * 7;
      poly(ctx, [[side * 3, -2], [side * 9, -5 - flap * 3], [side * 17, tipY], [side * 15, tipY + 6], [side * 10, 3], [side * 4, 4]], "#5e35b1", "#311b92", 1);
      line(ctx, side * 3, -2, side * 17, tipY, "#311b92", 1.2);
      line(ctx, side * 3, -2, side * 15, tipY + 6, "#311b92", 1);
      line(ctx, side * 3, -2, side * 10, 3, "#311b92", 1);
    }
    body(0, 0, 5, 7, "#7e57c2", "#4527a0", "#311b92");             // furry body
    circle(ctx, 0, -7, 4.5, "#7e57c2", "#311b92");                  // head
    poly(ctx, [[-4, -9], [-5, -15], [-1, -10]], "#7e57c2", "#311b92", 0.8);   // ears
    poly(ctx, [[4, -9], [5, -15], [1, -10]], "#7e57c2", "#311b92", 0.8);
    poly(ctx, [[-3.5, -9.5], [-4, -13], [-1.5, -10]], "#f8bbd0");
    poly(ctx, [[3.5, -9.5], [4, -13], [1.5, -10]], "#f8bbd0");
    eye(-1.8, -7.5, 1.3, "#ff1744", phase, "#000"); eye(1.8, -7.5, 1.3, "#ff1744", phase, "#000");
    circle(ctx, 0, -5.5, 0.8, "#311b92");                           // snub nose
    fang(-1.2, -4, 2, false); fang(1.2, -4, 2, false);
    line(ctx, -1.5, 7, -3, 10, "#4527a0", 1.2); line(ctx, 1.5, 7, 3, 10, "#4527a0", 1.2);   // dangling feet
  },

  // An undead warrior: bare bones, a rusted helm and a battered round shield
  skeleton(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 4;
    const rattle = Math.sin(phase * 3) * 0.6;                       // joints jiggle as it walks
    line(ctx, -3, 6, -3 + sw, 14, "#e0e0e0", 2.5);                   // leg bones
    line(ctx, 3, 6, 3 - sw, 14, "#e0e0e0", 2.5);
    circle(ctx, -3 + sw * 0.5, 10, 1.6, "#eeeeee"); circle(ctx, 3 - sw * 0.5, 10, 1.6, "#eeeeee");   // knees
    ellipse(ctx, -3 + sw, 14.5, 3, 1.4, "#bdbdbd"); ellipse(ctx, 3 - sw, 14.5, 3, 1.4, "#bdbdbd");
    rect(ctx, -5, 5, 10, 3, "#6d4c41");                             // tattered belt
    line(ctx, 0, -4, 0, 6, "#e0e0e0", 2.2);                          // spine
    for (let i = 0; i < 4; i++) {                                    // ribcage
      const ry = -3 + i * 2.4;
      line(ctx, -5.5 + i * 0.4, ry + rattle, 0, ry + 1, "#e0e0e0", 1.4);
      line(ctx, 5.5 - i * 0.4, ry + rattle, 0, ry + 1, "#e0e0e0", 1.4);
    }
    line(ctx, -6, -5, 6, -5, "#e0e0e0", 2.2);                        // collar bone
    line(ctx, -6, -5, -11, 3 + rattle, "#e0e0e0", 2);                // shield arm
    circle(ctx, -11, 5, 5.5, "#6d4c41", "#4e342e", 1.2);             // battered round shield
    circle(ctx, -11, 5, 1.6, "#9e9e9e"); for (const a of [0.5, 2.1, 3.7, 5.3]) circle(ctx, -11 + Math.cos(a) * 4, 5 + Math.sin(a) * 4, 0.7, "#9e9e9e");
    line(ctx, 6, -5, 11, 1 + rattle, "#e0e0e0", 2);                  // sword arm
    circle(ctx, 11, 1 + rattle, 1.6, "#eeeeee");
    line(ctx, 11, 1 + rattle, 20, -8 + rattle, "#b0bec5", 2.2);       // notched sword
    line(ctx, 9, -2 + rattle, 13, 2 + rattle, "#5d4037", 2);
    circle(ctx, 0, -11, 6, "#eeeeee", "#9e9e9e", 1);                 // skull
    poly(ctx, [[-6, -12], [6, -12], [5, -17], [0, -19], [-5, -17]], "#78909c", "#37474f", 1);   // rusted helm
    rect(ctx, -6, -13, 12, 1.5, "#546e7a");
    for (const ex of [-2.3, 2.3]) { circle(ctx, ex, -11, 1.8, "#212121"); circle(ctx, ex, -11, 0.7, "#76ff03"); }   // eerie green eye-glow
    poly(ctx, [[-0.8, -8.5], [0.8, -8.5], [0, -7]], "#424242");       // nose hole
    line(ctx, -3, -6, 3, -6, "#9e9e9e", 1); for (const tx of [-2, -0.7, 0.7, 2]) line(ctx, tx, -6, tx, -4.8, "#9e9e9e", 0.8);   // teeth
  },

  // A goblin shaman in a bone mask, feathers and a glowing skull staff
  shaman(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 3.5;
    const chant = Math.sin(phase * 1.2) * 1.5;                       // staff bobs as it chants
    line(ctx, -3, 6, -3 + sw, 14, "#2e7d32", 3); line(ctx, 3, 6, 3 - sw, 14, "#2e7d32", 3);
    poly(ctx, [[-7, -4], [7, -4], [9, 12], [-9, 12]], "#4e342e", "#3e2723", 1);   // ragged robe
    for (const rx of [-7, -3, 1, 5]) line(ctx, rx, 12, rx + 1, 15, "#4e342e", 1.5);   // frayed hem
    line(ctx, -4, -1, 4, 2, "#8d6e63", 1); line(ctx, -4, 3, 4, 6, "#8d6e63", 1);   // stitches
    for (const [bx, by] of [[-3, 1], [0, 2.5], [3, 1]]) circle(ctx, bx, by, 1.1, "#eeeeee");   // bone necklace
    line(ctx, -5, -2, -11, 4, "#43a047", 2.5);                        // arm with rattle
    circle(ctx, -12, 6, 2.5, "#8d6e63", "#4e342e", 0.8); for (const a of [0.8, 2.3, 3.9]) line(ctx, -12, 6, -12 + Math.cos(a) * 4, 6 + Math.sin(a) * 4, "#eeeeee", 1);
    line(ctx, 5, -2, 11, 2 + chant * 0.3, "#43a047", 2.5);            // staff arm
    line(ctx, 12, 12, 12, -16 + chant, "#5d4037", 2.5);               // staff
    circle(ctx, 12, -19 + chant, 3.5, "#eeeeee", "#9e9e9e", 0.8);     // skull on top
    circle(ctx, 11, -19.5 + chant, 0.8, "#212121"); circle(ctx, 13, -19.5 + chant, 0.8, "#212121");
    const g = ctx.createRadialGradient(12, -19 + chant, 1, 12, -19 + chant, 9);
    g.addColorStop(0, "rgba(118,255,3,0.7)"); g.addColorStop(1, "rgba(118,255,3,0)");
    circle(ctx, 12, -19 + chant, 9, g);
    poly(ctx, [[-5, -10], [-13, -17], [-4, -5]], "#66bb6a", "#1b5e20", 1);   // ears
    poly(ctx, [[8, -10], [16, -17], [8, -5]], "#66bb6a", "#1b5e20", 1);
    body(2, -9, 7, 7, "#a5d6a7", "#43a047", "#1b5e20");               // head
    poly(ctx, [[-4, -14], [8, -14], [9, -4], [2, -1], [-5, -4]], "#efebe9", "#8d6e63", 1);   // bone mask
    circle(ctx, 0, -10, 1.8, "#212121"); circle(ctx, 5, -10, 1.8, "#212121");
    circle(ctx, 0.4, -10, 0.7, "#76ff03"); circle(ctx, 5.4, -10, 0.7, "#76ff03");
    line(ctx, 1, -5, 4, -5, "#8d6e63", 1);
    for (const [fx, col] of [[-2, "#e53935"], [1, "#ffeb3b"], [4, "#1e88e5"]]) {   // feathers in a headband
      line(ctx, fx, -14, fx - 1, -24, col, 2.5); line(ctx, fx, -14, fx - 1, -24, "#3e2723", 0.6);
    }
    rect(ctx, -4, -15, 12, 2, "#6d4c41");
  },

  // A stone golem, boulders bound by glowing magic
  golem(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 4;
    const pulse = 0.5 + Math.sin(phase * 2) * 0.5;
    const glow = `rgba(255,152,0,${0.5 + pulse * 0.5})`;
    rect(ctx, -11 + sw, 12, 9, 12, "#616161", "#37474f", 1.2);         // slab legs
    rect(ctx, 2 - sw, 12, 9, 12, "#616161", "#37474f", 1.2);
    line(ctx, -7 + sw, 16, -5 + sw, 20, glow, 1.2); line(ctx, 6 - sw, 15, 4 - sw, 21, glow, 1.2);
    body(0, 0, 16, 14, "#9e9e9e", "#616161", "#37474f");               // boulder torso
    poly(ctx, [[-14, -4], [-10, -9], [-4, -6], [-7, 0]], "#8d8d8d", "#37474f", 0.8);   // stone facets
    poly(ctx, [[2, -11], [9, -9], [11, -2], [4, -3]], "#8d8d8d", "#37474f", 0.8);
    poly(ctx, [[-6, 4], [2, 3], [4, 11], [-5, 10]], "#8d8d8d", "#37474f", 0.8);
    line(ctx, -4, -6, -7, 0, glow, 1.5); line(ctx, 4, -3, 2, 3, glow, 1.5); line(ctx, -2, 5, 1, 10, glow, 1.2);   // glowing cracks
    circle(ctx, 0, 1, 3.5, glow); circle(ctx, 0, 1, 1.8, "#ffeb3b");                           // core
    body(-15, -6, 6, 6, "#9e9e9e", "#616161", "#37474f");             // boulder shoulders
    body(15, -6, 6, 6, "#9e9e9e", "#616161", "#37474f");
    line(ctx, -15, -2, -20 + sw * 0.5, 12, "#757575", 6);              // arms
    rect(ctx, -24 + sw * 0.5, 10, 9, 8, "#616161", "#37474f", 1);      // fists
    line(ctx, 15, -2, 20 - sw * 0.5, 12, "#757575", 6);
    rect(ctx, 15 - sw * 0.5, 10, 9, 8, "#616161", "#37474f", 1);
    body(0, -17, 8, 7, "#9e9e9e", "#616161", "#37474f");               // head
    rect(ctx, -6, -19, 12, 2.5, "#616161");                            // heavy brow
    circle(ctx, -3, -16, 1.8, glow); circle(ctx, 3, -16, 1.8, glow);    // glowing eyes
    line(ctx, -3, -12, 3, -12, "#424242", 1.5);
    for (const [mx, my] of [[-9, -9], [8, 5], [-6, 10]]) { circle(ctx, mx, my, 2, "#558b2f"); circle(ctx, mx + 1, my - 1, 1.2, "#7cb342"); }   // moss
  },

  // A brute of an orc with spiked armour and a studded club
  orc(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 5;
    const sway = still ? 0 : Math.sin(phase) * 1.5;                 // shoulders roll as it stomps
    const heave = Math.sin(phase * 0.7) * 0.5;
    line(ctx, -5, 9, -5 + sw, 19, "#33691e", 5);                    // legs
    line(ctx, 5, 9, 5 - sw, 19, "#33691e", 5);
    rect(ctx, -8 + sw, 17, 7, 4, "#616161", "#37474f", 1);          // iron boots
    rect(ctx, 2 - sw, 17, 7, 4, "#616161", "#37474f", 1);
    body(sway * 0.3, 2, 11, 12 + heave, "#8bc34a", "#33691e", "#33691e");   // body
    line(ctx, -8, -6, 6, 10, "#4e342e", 3);                         // chest strap
    for (const [bx, by] of [[-5, -2.5], [-1, 2], [3, 6.5]]) circle(ctx, bx, by, 1, "#bdbdbd");
    rect(ctx, -11, 8, 22, 4, "#4e342e");                            // belt
    rect(ctx, -2, 7.5, 4, 5, "#9e9e9e", "#424242", 1);
    body(-8 + sway, -8, 7, 5, "#b0bec5", "#546e7a", "#37474f");     // spiked pauldron
    for (const [px, py] of [[-12, -11], [-8, -13], [-4, -11]]) poly(ctx, [[px + sway - 1.5, py], [px + sway + 1.5, py], [px + sway, py - 4]], "#b0bec5", "#37474f", 0.5);
    line(ctx, -6, -1, -13, 6, "#558b2f", 4);                        // back arm
    circle(ctx, -13, 7, 2.5, "#558b2f");
    circle(ctx, 2, -5, 2.2, "#eeeeee", "#9e9e9e", 0.8);             // skull necklace
    circle(ctx, 1.4, -5.5, 0.6, "#424242"); circle(ctx, 2.8, -5.5, 0.6, "#424242");
    line(ctx, 4, -2, 14, 6 + sw * 0.3, "#558b2f", 4);               // club arm
    circle(ctx, 14, 6 + sw * 0.3, 2.5, "#558b2f");
    line(ctx, 14, 6 + sw * 0.3, 24, -8, "#5d4037", 5);
    body(25, -10, 5, 5, "#6d4c41", "#3e2723", "#3e2723");
    for (const [kx, ky] of [[22, -13], [27, -14], [29, -9], [25, -6]]) circle(ctx, kx, ky, 1.1, "#bdbdbd");
    body(3, -15, 8, 8, "#9ccc65", "#558b2f", "#33691e");            // head
    ellipse(ctx, 4, -11, 6, 3.5, "#7cb342");                        // jaw
    line(ctx, -1, -10, 9, -10, "#33691e", 1.5);
    fang(0, -10, 4); fang(7.5, -10, 4);
    eye(0.5, -17, 1.8, "#ff1744", phase, "#3e0000"); eye(6.5, -17, 1.8, "#ff1744", phase, "#3e0000");
    line(ctx, -2, -20, 9, -20, "#33691e", 2.2);                     // brow
    circle(ctx, -5, -14, 1.6, null, "#ffd54f", 1);                   // ear ring
    circle(ctx, 2, -22.5, 2.2, "#263238"); line(ctx, 2, -23, 2, -28, "#263238", 2.5);   // topknot
    line(ctx, 7, -15, 9.5, -12, "#33691e", 1);                       // scar
  },

  // A hulking troll, chest heaving, club dragging
  troll(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 5;
    const heave = Math.sin(phase * 0.6) * 1.2;
    const lean = still ? 0 : Math.sin(phase) * 1.5;
    line(ctx, -7, 18, -7 + sw, 32, "#607d8b", 7);                   // legs
    line(ctx, 7, 18, 7 - sw, 32, "#607d8b", 7);
    for (const fx of [-7 + sw, 7 - sw]) {
      ellipse(ctx, fx + 1, 33, 5, 2.2, "#546e7a");
      for (const t of [-3, 0, 3]) line(ctx, fx + 1 + t, 34, fx + 1.5 + t, 36.5, "#eceff1", 1.2);   // claws
    }
    body(lean * 0.4, 4, 16, 17 + heave, "#b0bec5", "#607d8b", "#455a64");   // body
    ellipse(ctx, 2, 8, 9, 9 + heave * 0.5, "#cfd8dc");              // belly
    for (const [wx, wy] of [[-10, -2], [-12, 6], [11, -4], [9, 12]]) circle(ctx, wx, wy, 1.6, "#607d8b");   // warts
    poly(ctx, [[-11, 14], [11, 14], [9, 22], [3, 19], [-3, 22], [-9, 19]], "#6d4c41", "#3e2723", 1);   // loincloth
    line(ctx, -12, 14, 12, 14, "#a1887f", 2.5);
    line(ctx, -9, 0, -20, 14, "#78909c", 6);                        // back arm
    body(-21, 16, 4, 4, "#90a4ae", "#607d8b", "#455a64");
    line(ctx, 8, 0, 22, 12 + sw * 0.3, "#78909c", 6);               // club arm
    circle(ctx, 22, 12 + sw * 0.3, 3.5, "#78909c");
    line(ctx, 22, 12 + sw * 0.3, 36, -12, "#5d4037", 7);
    body(38, -15, 7.5, 7.5, "#6d4c41", "#3e2723", "#3e2723");
    for (const a of [-2.4, -1.5, -0.6, 0.3, 1.2]) {
      const px = 38 + Math.cos(a) * 7.5, py = -15 + Math.sin(a) * 7.5;
      poly(ctx, [[px - 1.5, py], [px + 1.5, py], [px + Math.cos(a) * 4.5, py + Math.sin(a) * 4.5]], "#b0bec5", "#37474f", 0.5);
    }
    body(2 + lean * 0.5, -18, 11, 11, "#cfd8dc", "#78909c", "#455a64");   // head
    ellipse(ctx, 3, -12, 8, 5, "#a7b7bf");                          // jaw
    ellipse(ctx, 2, -24, 9, 3.5, "#78909c");                        // brow ridge
    for (let i = -8; i <= 8; i += 3) line(ctx, 2 + i, -28, 2 + i * 1.3, -36 - Math.abs(i) * 0.3, "#558b2f", 2.5);   // mossy hair
    eye(-1, -20, 2.2, "#ffeb3b", phase); eye(7, -20, 2.2, "#ffeb3b", phase);
    ellipse(ctx, 4, -15.5, 2.5, 1.8, "#78909c");                    // nose
    line(ctx, 0.5, -15, 7.5, -15, "#eceff1", 1.6);                  // bone through the nose
    line(ctx, -3, -12, 8, -12, "#455a64", 2);
    fang(-1, -12, 4); fang(7, -12, 4);
    line(ctx, 10, -22, 13, -18, "#455a64", 1.2);                    // scar
  },

  // A wobbling teal slime: a glossy blob with two beady eyes and bubbles inside. Squashes as it hops.
  slime(phase, still) {
    const hop = still ? 0 : Math.max(0, Math.sin(phase * 1.3));
    const sq = 1 + (still ? Math.sin(phase * 2) * 0.05 : (0.18 - hop * 0.3));          // squash wide on landing, stretch tall mid-hop
    ctx.save(); ctx.translate(0, 12 - hop * 6); ctx.scale(sq, 1 / sq);
    // A glassy dome of gel: deep teal at the rim, bright and see-through toward the top, sitting on a wavy skirt
    const skirt = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; skirt.push([Math.cos(a) * 12.5, Math.sin(a) * 2.4 + Math.sin(phase * 2 + i * 1.7) * 0.5]); }
    ctx.fillStyle = "#00796b"; ctx.beginPath(); ctx.ellipse(0, 0, 12.5, 3, 0, 0, Math.PI * 2); ctx.fill();            // the puddle it sits in
    const gel = ctx.createRadialGradient(-3, -13, 1, 0, -8, 14);
    gel.addColorStop(0, "#b2ebf2"); gel.addColorStop(0.45, "#4dd0e1"); gel.addColorStop(1, "#00897b");
    ctx.fillStyle = gel; ctx.beginPath(); ctx.moveTo(-12.5, 0);
    ctx.bezierCurveTo(-13, -9, -8, -19, 0, -19); ctx.bezierCurveTo(8, -19, 13, -9, 12.5, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,105,92,0.55)"; ctx.lineWidth = 0.9; ctx.stroke();
    // A dark core floating inside, wobbling a beat behind the body
    const cx = Math.sin(phase * 1.3) * 1.2, cy = -8 + Math.cos(phase) * 0.8;
    ctx.globalAlpha = 0.75; ellipse(ctx, cx, cy, 4.6, 4, "#00695c"); ctx.globalAlpha = 0.5; ellipse(ctx, cx - 0.8, cy - 0.8, 2.4, 2, "#00897b"); ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.5;
    for (const [bx, by, br] of [[-6, -6, 1.4], [5, -13, 1.1], [7, -5, 1]]) circle(ctx, bx + Math.sin(phase + bx) * 0.6, by + Math.sin(phase * 0.7 + by) * 0.8, br, "#e0f7fa");   // bubbles
    ctx.globalAlpha = 1;
    ellipse(ctx, -4.5, -14.5, 3.6, 1.5, "rgba(255,255,255,0.7)"); circle(ctx, 1.5, -16.5, 0.9, "rgba(255,255,255,0.8)");   // glassy highlights
    circle(ctx, 3, -10, 1.7, "#102a2a"); circle(ctx, 7.5, -9.5, 1.4, "#102a2a");                                          // beady eyes
    circle(ctx, 3.5, -10.5, 0.55, "#fff"); circle(ctx, 7.9, -9.9, 0.45, "#fff");
    ctx.strokeStyle = "#00695c"; ctx.lineWidth = 1; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(4, -6); ctx.quadraticCurveTo(5.5, -4.6, 7.5, -6); ctx.stroke();   // a small, slightly grumpy mouth
    ctx.restore();
    for (let i = 0; i < 2; i++) { ctx.globalAlpha = 0.5; circle(ctx, -9 + i * 16, 13.5, 1.6 + hop, "#4dd0e1"); ctx.globalAlpha = 1; }   // drips
  },

  // A baby slime: half the size, twice as bouncy
  slimeling(phase, still) {
    const hop = still ? 0 : Math.max(0, Math.sin(phase * 2));
    const sq = 1 + (still ? Math.sin(phase * 3) * 0.06 : (0.2 - hop * 0.35));
    ctx.save(); ctx.translate(0, 7 - hop * 5); ctx.scale(sq, 1 / sq);
    ctx.fillStyle = "#00796b"; ctx.beginPath(); ctx.ellipse(0, 0, 7, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    const gel = ctx.createRadialGradient(-1.5, -7, 0.5, 0, -4.5, 8);
    gel.addColorStop(0, "#e0f7fa"); gel.addColorStop(0.5, "#80deea"); gel.addColorStop(1, "#26a69a");
    ctx.fillStyle = gel; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.bezierCurveTo(-7.5, -5, -4.5, -11, 0, -11); ctx.bezierCurveTo(4.5, -11, 7.5, -5, 7, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,105,92,0.5)"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.globalAlpha = 0.7; ellipse(ctx, Math.sin(phase * 2) * 0.7, -4.5, 2.4, 2.1, "#00796b"); ctx.globalAlpha = 1;   // its little core
    ellipse(ctx, -2.5, -8.5, 2, 1, "rgba(255,255,255,0.7)");
    circle(ctx, 2, -5.5, 1.1, "#1b1b1b"); circle(ctx, 4.8, -5, 0.9, "#1b1b1b");
    circle(ctx, 2.3, -5.8, 0.35, "#fff");
    ctx.restore();
  },

  // A hooded goblin thief sprinting with a bulging sack of loot and a dagger in its teeth
  thief(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 6;
    const lean = still ? 0 : 0.25;
    ctx.save(); ctx.rotate(lean);
    line(ctx, -3, 6, -4 + sw, 14, "#37474f", 3); line(ctx, 3, 6, 4 - sw, 14, "#37474f", 3);   // legs
    ellipse(ctx, -2 + sw, 14.5, 3.5, 1.5, "#212121"); ellipse(ctx, 6 - sw, 14.5, 3.5, 1.5, "#212121");
    body(0, 2, 6.5, 8, "#546e7a", "#263238", "#1b1b1b");                                  // dark tunic
    rect(ctx, -6, 6, 12, 2.2, "#3e2723"); for (const px of [-3, 0, 3]) rect(ctx, px - 0.8, 6.3, 1.6, 1.6, "#ffd54f");   // belt with coin pouches
    line(ctx, -4, -1, -11, 2, "#43a047", 2.5);                                            // back arm hoisting the sack
    body(-13, -4, 6, 6.5, "#d7ccc8", "#8d6e63", "#5d4037");                               // sack
    line(ctx, -13, -10, -13, -12, "#5d4037", 2); for (const [cx, cy] of [[-15, -5], [-11, -2], [-13, -7]]) circle(ctx, cx, cy, 1.2, "#ffd54f");   // coins poking out
    line(ctx, 3, 0, 9, 4 + sw * 0.3, "#43a047", 2.5); circle(ctx, 9.5, 4.5 + sw * 0.3, 1.6, "#43a047");   // front arm
    poly(ctx, [[-7, -6], [7, -6], [2, -20], [-2, -20]], "#263238", "#1b1b1b", 1);          // hood
    body(2, -9, 6.5, 6, "#a5d6a7", "#43a047", "#1b5e20");                                  // face
    poly(ctx, [[-5, -11], [9, -11], [8, -6], [-4, -6]], "#263238");                        // hood shadow across the eyes
    rect(ctx, -3, -11, 11, 3, "#1b1b1b");                                                 // eye mask
    circle(ctx, 1.5, -9.5, 1.3, "#ffeb3b"); circle(ctx, 5.5, -9.5, 1.3, "#ffeb3b");       // glinting eyes
    circle(ctx, 1.9, -9.5, 0.6, "#000"); circle(ctx, 5.9, -9.5, 0.6, "#000");
    line(ctx, -3, -4.5, 12, -3.5, "#b0bec5", 1.8); line(ctx, 10, -4, 12.5, -3, "#8d6e63", 1.5);   // dagger clenched in teeth
    poly(ctx, [[8, -10], [16, -17], [8, -5]], "#66bb6a", "#1b5e20", 1);                    // ear sticking out
    ctx.restore();
  },

  // A gaunt necromancer in tattered violet robes, skull-topped staff crackling with green magic
  necromancer(phase, still) {
    const sw = still ? 0 : Math.sin(phase) * 2;
    const hover = Math.sin(phase * 0.9) * 1.2;
    const glow = 0.55 + Math.sin(phase * 3) * 0.25;
    ctx.save(); ctx.translate(0, hover);
    poly(ctx, [[-8, -4], [8, -4], [11 + sw, 16], [-11 - sw, 16]], "#4a148c", "#2a0a4e", 1);     // long robe
    for (const rx of [-9, -5, -1, 3, 7]) poly(ctx, [[rx, 16], [rx + 3, 16], [rx + 1.5 + sw * 0.3, 19]], "#4a148c");   // tattered hem
    line(ctx, -5, 0, 5, 3, "#7b1fa2", 1); line(ctx, -5, 6, 5, 9, "#7b1fa2", 1);               // folds
    poly(ctx, [[-3, -4], [3, -4], [2, 10], [-2, 10]], "#1a0533");                           // dark front panel
    for (const by of [-1, 3, 7]) circle(ctx, 0, by, 1.1, `rgba(118,255,3,${glow})`);         // glowing runes
    ellipse(ctx, -9, 1, 4, 3, "#4a148c", "#2a0a4e", 1);                                     // wide sleeves
    line(ctx, -11, 3, -14, 9, "#cfd8dc", 1.8); for (let i = 0; i < 3; i++) line(ctx, -14, 9, -16 + i * 1.5, 12, "#cfd8dc", 1.2);   // bony hand
    ellipse(ctx, 9, 0, 4, 3, "#4a148c", "#2a0a4e", 1);
    line(ctx, 11, 2, 13, -2, "#cfd8dc", 1.8);
    line(ctx, 13, 16, 13, -20, "#3e2723", 2.5);                                             // staff
    circle(ctx, 13, -23, 4, "#eeeeee", "#9e9e9e", 0.8);                                     // skull
    circle(ctx, 11.8, -23.5, 1, "#1b1b1b"); circle(ctx, 14.2, -23.5, 1, "#1b1b1b"); line(ctx, 11.5, -20.5, 14.5, -20.5, "#9e9e9e", 1);
    const g = ctx.createRadialGradient(13, -23, 1, 13, -23, 11);
    g.addColorStop(0, `rgba(118,255,3,${glow * 0.8})`); g.addColorStop(1, "rgba(118,255,3,0)");
    circle(ctx, 13, -23, 11, g);
    for (let i = 0; i < 3; i++) { const k = (phase * 0.3 + i / 3) % 1; ctx.globalAlpha = 1 - k; circle(ctx, 13 + Math.sin(phase * 2 + i * 2) * 5, -23 - k * 14, 1.2, "#b9f6ca"); }   // rising sparks
    ctx.globalAlpha = 1;
    poly(ctx, [[-7, -8], [7, -8], [1, -26], [-1, -26]], "#2a0a4e", "#1a0533", 1);           // tall hood
    body(0, -11, 5.5, 5, "#b0bec5", "#78909c", "#37474f");                                  // gaunt grey face
    poly(ctx, [[-5.5, -13], [6, -13], [5, -9], [-4.5, -9]], "#1a0533");                      // shadow under the hood
    circle(ctx, 1.5, -11, 1.3, `rgba(118,255,3,${glow + 0.2})`); circle(ctx, 4.5, -11, 1.3, `rgba(118,255,3,${glow + 0.2})`);   // burning green eyes
    line(ctx, 1, -7, 4.5, -7, "#37474f", 1);
    ctx.restore();
  },

  // A wyvern: a big crimson two-legged dragon with huge beating wings, a barbed tail and a horned head
  wyvern(phase, still) {
    const flap = Math.sin(phase * 1.6);
    const wingY = flap * 10, wingTip = flap * 16;
    const wing = (side) => {
      const pts = [[-4, -6], [-10 + side * 4, -14 - wingY], [-6 + side * 14, -22 - wingTip], [10 + side * 16, -16 - wingY * 0.6], [14 + side * 10, -6], [4, -2]];
      poly(ctx, pts, side > 0 ? "#b71c1c" : "#7f0000", "#4a0000", 1.2);
      for (let i = 1; i < 4; i++) line(ctx, -4, -6, pts[i][0], pts[i][1], "#4a0000", 1);  // wing fingers
      poly(ctx, [[-4, -6], pts[1], pts[2]], side > 0 ? "rgba(255,138,128,0.35)" : "rgba(0,0,0,0.15)");   // membrane shade
    };
    wing(-1);                                                                               // far wing
    // Tail whipping behind
    ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-10, 4);
    ctx.quadraticCurveTo(-20, 8 + flap * 3, -28, -2 + flap * 6); ctx.stroke();
    poly(ctx, [[-28, -2 + flap * 6], [-33, -8 + flap * 6], [-25, -7 + flap * 6]], "#4a0000");   // barbed tip
    body(0, 2, 13, 9, "#e53935", "#8e0000", "#4a0000");                                      // body
    ellipse(ctx, 2, 6, 8, 4, "#ffcc80");                                                     // pale belly
    for (let i = 0; i < 4; i++) line(ctx, -4 + i * 3.5, 4, -4 + i * 3.5, 8, "#ef9a9a", 1);   // belly ridges
    for (const [lx, d] of [[-3, 1], [5, -1]]) {                                               // tucked legs with talons
      line(ctx, lx, 8, lx + 2 * d, 15 + flap, "#8e0000", 3.5);
      for (let i = -1; i <= 1; i++) line(ctx, lx + 2 * d, 15 + flap, lx + 2 * d + i * 2.5 + d, 18 + flap, "#ffe082", 1.4);
    }
    // Long neck and horned head
    ctx.strokeStyle = "#e53935"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(9, -2); ctx.quadraticCurveTo(15, -8, 17, -14 + flap * 1.5); ctx.stroke();
    body(19, -16 + flap * 1.5, 7, 5.5, "#ef5350", "#b71c1c", "#4a0000");                    // head
    poly(ctx, [[24, -17 + flap * 1.5], [31, -14 + flap * 1.5], [24, -13 + flap * 1.5]], "#ef5350", "#4a0000", 1);   // snout
    line(ctx, 24.5, -13.5 + flap * 1.5, 30, -14 + flap * 1.5, "#4a0000", 1);
    fang(27, -13.5 + flap * 1.5, 2, false); fang(29, -13.8 + flap * 1.5, 1.5, false);
    for (const [hx, hy] of [[15, -20], [18, -21]]) line(ctx, hx, hy + flap * 1.5, hx - 4, hy - 7 + flap * 1.5, "#3e2723", 2.2);   // horns
    eye(21, -17 + flap * 1.5, 1.8, "#ffeb3b", phase, "#000");
    for (let i = 0; i < 3; i++) { const k = (phase * 0.5 + i / 3) % 1; ctx.globalAlpha = 0.6 * (1 - k); circle(ctx, 31 + k * 6, -14 + flap * 1.5 + (i - 1) * 1.5, 1 + k, "#9e9e9e"); }   // smoke from the nostrils
    ctx.globalAlpha = 1;
    wing(1);                                                                                // near wing
  },
};

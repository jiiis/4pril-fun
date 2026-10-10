import { canvas, ctx, circle, ellipse, rect, line, poly } from "./gfx.js";
import { state } from "../state.js";
import { view } from "../ui.js";
import { map } from "../map.js";
import { SPOT_RADIUS, W, H, TOWERS } from "../config.js";
import { towerRange, abilityDef } from "../towers.js";
import { buildBackground, drawSign, CASTLE_STYLES, gatePillars, lairStakes, drawDecoItem, drawCastleAt, drawGateStructure, gateAnchorY, drawLairStructure, lairAnchorY, lairParts, cherryToneOf } from "./background.js";
import { drawTower, flag } from "./towers.js";
import { drawEnemy, drawCorpse } from "./creatures.js";
import { drawSoldier } from "./soldiers.js";
import { drawCritter, drawWaterBird } from "./critters.js";
import { drawHero, drawDog, drawEagle } from "./hero.js";
import { drawWeather, drawSnowCover } from "../weather.js";

let background = null;   // built on the first frame, after the map has been generated
// Resolution: the canvas keeps its 1440×840 world size on screen, but its pixel buffer follows the
// device pixel ratio and the current zoom (in quarter steps, capped) so nothing goes soft when zoomed in.
// The static background is re-rasterized to match, a moment after the zoom settles.
let res = 0, bgRes = 0, resChangedAt = 0;
const MAX_RES = 2;                                        // crisp enough on 2× screens; above this the fill cost per frame climbs fast
function fitResolution() {
  const want = Math.min(MAX_RES, Math.ceil((window.devicePixelRatio || 1) * view.k * 4) / 4);
  if (want !== res) {
    res = want; resChangedAt = performance.now();
    canvas.width = Math.round(W * res); canvas.height = Math.round(H * res);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  }
  if (!background || (bgRes !== res && performance.now() - resChangedAt > 150)) { background = buildBackground(res); bgRes = res; }
  ctx.setTransform(res, 0, 0, res, 0, 0);
}
export const invalidateBackground = () => { background = null; };

// Living water: glints drifting along the current, and fish leaping out
function drawWater() {
  const T = state.time;
  for (const r of map.rivers) {
    const pts = r.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (let k = 0; k < 2; k++) {
        const t = ((T * 0.25 + i * 0.37 + k * 0.5) % 1);
        const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
        const off = Math.sin(T * 1.3 + i + k * 2) * ((a.w + b.w) / 2) * 0.25;
        const gx = a.x + (b.x - a.x) * t + (nx / nl) * off, gy = a.y + (b.y - a.y) * t + (ny / nl) * off;
        if (map.bridges.some((br) => Math.hypot(br.x - gx, br.y - gy) < br.span / 2 + 14)) continue;   // not under a bridge
        ctx.globalAlpha = 0.35 + Math.sin(T * 4 + i + k) * 0.2;
        line(ctx, gx - (b.x - a.x) * 0.08, gy - (b.y - a.y) * 0.08, gx + (b.x - a.x) * 0.08, gy + (b.y - a.y) * 0.08, "#e3f2fd", 1.5);
      }
    }
  }
  for (const p of map.ponds) {                                             // slow sparkles drifting on the still water
    for (let k = 0; k < 3; k++) {
      const a = T * 0.3 + k * 2.1 + p.seed, r = 0.3 + 0.35 * Math.sin(T * 0.7 + k);
      const gx = p.x + Math.cos(a) * p.rx * r, gy = p.y + Math.sin(a) * p.ry * r;
      ctx.globalAlpha = 0.3 + Math.sin(T * 3 + k * 1.3 + p.seed) * 0.25;
      line(ctx, gx - 3, gy, gx + 3, gy, "#e3f2fd", 1.5);
    }
  }
  ctx.globalAlpha = 1;
  // Ducks and swans paddle slowly around the bigger ponds
  for (const p of map.ponds) for (const b of p.birds || []) {
    const a = b.a0 + T * b.speed, x = p.x + Math.cos(a) * p.rx * b.r, y = p.y + Math.sin(a) * p.ry * b.r;
    const dir = -Math.sin(a) * b.speed >= 0 ? 1 : -1;                     // facing the way it drifts
    ctx.globalAlpha = 0.35; ctx.strokeStyle = "#e3f2fd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - dir * 4, y + 2); ctx.lineTo(x - dir * 16, y + 5); ctx.moveTo(x - dir * 4, y + 2); ctx.lineTo(x - dir * 16, y - 1); ctx.stroke();   // wake
    ctx.globalAlpha = 1;
    drawWaterBird(b.kind, x, y, dir, T + b.a0);
  }
  for (const f of state.fish) {
    const p = Math.min(1, f.t / f.dur);
    if (f.t < 0.15 || (f.t > f.dur - 0.05 && f.t < f.dur + 0.4)) {          // splash rings on the way out and back in
      const k = f.t < 0.15 ? f.t / 0.15 : (f.t - (f.dur - 0.05)) / 0.45;
      const sx = f.x + (f.t < 0.15 ? 0 : f.dir * f.size * 4);
      ctx.globalAlpha = (1 - k) * 0.8;
      circle(ctx, sx, f.y, 2 + k * 5, null, "#e3f2fd", 1.2);
      if (k < 0.5) for (let d = 0; d < 3; d++) circle(ctx, sx + (d - 1) * 3, f.y - 2 - k * 6, 0.8, "#e3f2fd");
      ctx.globalAlpha = 1;
    }
    if (p >= 1) continue;
    const x = f.x + f.dir * p * f.size * 4, y = f.y - Math.sin(p * Math.PI) * f.hop;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f.dir, 1);
    ctx.rotate((0.5 - p) * 1.9);                                            // nose up leaving the water, nose down diving back
    const s = f.size;
    ctx.fillStyle = "#b0bec5";
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#eceff1"; ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.8, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();   // pale belly
    poly(ctx, [[-s, 0], [-s * 1.6, -s * 0.5], [-s * 1.6, s * 0.5]], "#ff8a65", "#e64a19", 0.6);                          // tail
    poly(ctx, [[-s * 0.2, -s * 0.4], [s * 0.2, -s * 0.4], [0, -s * 0.9]], "#ff8a65");                                       // dorsal fin
    circle(ctx, s * 0.6, -s * 0.1, s * 0.12, "#212121");
    ctx.restore();
  }
}

// The blue rally flag where a barracks' soldiers gather
function drawRallyFlag(p, moving) {
  const wave = Math.sin(state.time * 6) * 1.5;
  ctx.globalAlpha = moving ? 0.6 + Math.sin(state.time * 8) * 0.3 : 1;
  circle(ctx, p.x, p.y + 1, 7, "rgba(21,101,192,0.35)", "#90caf9", 1.5);
  line(ctx, p.x, p.y, p.x, p.y - 18, "#3e2723", 2);
  poly(ctx, [[p.x, p.y - 18], [p.x + 12 + wave, p.y - 14], [p.x, p.y - 9]], "#1565c0", "#0d47a1", 1);
  ctx.globalAlpha = 1;
}

// An empty build spot: a weathered stone pad half-sunk in the grass, kept muted so it reads as
// scenery until the mouse is over it. Once a tower stands there, the pad is gone.
export const SPOT_SQUASH = 0.62;   // how much the build pads are foreshortened (1 = seen straight from above)
// A light sense of depth: things lower on the map (nearer the viewer) are drawn a little larger
export const depthScale = (y) => 0.82 + 0.36 * Math.min(1, Math.max(0, y / H));
function drawSpot(s, i, occupied, hovered) {
  if (occupied) return;
  const { x, y } = s, R = SPOT_RADIUS;
  ctx.save();
  const breath = Math.sin(state.time * 1.6 + i * 1.3);                     // each pad breathes gently at its own moment
  const ds = depthScale(y); ctx.translate(x, y); ctx.scale(ds, ds); ctx.translate(-x, -y);
  ctx.globalAlpha = hovered ? 1 : 0.6 + breath * 0.12;
  // Seen from the front and above: the pad is a foreshortened disc with a visible front edge
  ctx.translate(x, y); ctx.scale(1, SPOT_SQUASH); ctx.translate(-x, -y);
  ctx.globalAlpha *= 0.5; circle(ctx, x, y + 3, R + 1, "#2e4a1c"); ctx.globalAlpha = hovered ? 1 : 0.6 + breath * 0.12;
  circle(ctx, x, y + 3, R, "#6f7a62");                                // the disc's front edge, showing below the top face
  const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.4, 2, x, y, R + 1);
  g.addColorStop(0, hovered ? "#d6d0c6" : "#b6b8a6");                  // greener, duller stone when idle
  g.addColorStop(1, hovered ? "#a8a297" : "#8c9280");
  circle(ctx, x, y, R - 1, g, "rgba(70,75,60,0.7)", 1.2);
  // Flagstone cracks (fixed pattern per spot)
  ctx.strokeStyle = "rgba(70,65,58,0.45)"; ctx.lineWidth = 1; ctx.lineCap = "round";
  const a0 = i * 1.7;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.1, r1 = R * 0.22, r2 = R * 0.92;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a + 0.25) * R * 0.55, y + Math.sin(a + 0.25) * R * 0.55);
    ctx.lineTo(x + Math.cos(a + 0.1) * r2, y + Math.sin(a + 0.1) * r2);
    ctx.stroke();
  }
  // Grass creeping over the edge
  for (let k = 0; k < 6; k++) {
    const a = a0 * 0.7 + k * 1.1, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
    for (let j = -1; j <= 1; j++) line(ctx, px, py, px + j * 2, py - 3.5, "#3f7a2a", 1.3);
  }
  // Small engraved plus; a soft gold ring only when hovered
  const m = R * 0.22;
  if (hovered) circle(ctx, x, y, R * 0.65, null, "#ffd54f", 1.3);
  line(ctx, x - m, y + 1, x + m, y + 1, "rgba(255,255,255,0.35)", 2);
  line(ctx, x, y - m + 1, x, y + m + 1, "rgba(255,255,255,0.35)", 2);
  line(ctx, x - m, y, x + m, y, hovered ? "#8d6e2a" : "rgba(80,85,70,0.8)", 2);
  line(ctx, x, y - m, x, y + m, hovered ? "#8d6e2a" : "rgba(80,85,70,0.8)", 2);
  // The old stones hold a little magic: every few seconds a glint of light sweeps across the pad,
  // and now and then a golden mote lifts off and fades into the air. Each pad keeps its own rhythm.
  const T = state.time + i * 1.37;
  const sweep = (T % 4.2) / 4.2;                                           // 0..1 across the stone, then a long rest
  if (sweep < 0.35) {
    const u = sweep / 0.35, sx = x - R + u * 2 * R;
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, R - 1, R - 1, 0, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha *= Math.sin(u * Math.PI) * 0.55;
    const g2 = ctx.createLinearGradient(sx - 7, 0, sx + 7, 0);
    g2.addColorStop(0, "rgba(255,245,200,0)"); g2.addColorStop(0.5, "rgba(255,245,200,0.9)"); g2.addColorStop(1, "rgba(255,245,200,0)");
    ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(sx - 12, y + R + 2); ctx.lineTo(sx + 2, y - R - 2); ctx.lineTo(sx + 16, y - R - 2); ctx.lineTo(sx + 2, y + R + 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  for (let k = 0; k < 2; k++) {                                            // motes: rise about 14px over 2.4s, drifting a little
    const life = ((T * 0.42 + k * 0.5 + i * 0.21) % 1), a = Math.sin(life * Math.PI);
    if (life > 0.98) continue;
    const mx = x + Math.sin(i * 2.3 + k * 4.1) * R * 0.45 + Math.sin(T * 2 + k) * 1.5, my = y - life * 14 / SPOT_SQUASH;   // counter the squash so they rise straight up
    ctx.globalAlpha = a * 0.7; circle(ctx, mx, my, 1.1, "#ffe08a"); ctx.globalAlpha = a * 0.25; circle(ctx, mx, my, 2.6, "#ffd54f");
  }
  ctx.restore();
}

export function draw() {
  fitResolution();
  ctx.drawImage(background, 0, 0, W, H);
  // Arrows worn into the dirt at the map edges: soft filled wedges, no outlines. A gentle wave
  // runs along the three of them so each swells, brightens and nudges forward in turn.
  const wave = (k) => { const p = ((state.time * 0.55 - k * 0.22) % 1 + 1) % 1; return Math.pow(Math.sin(p * Math.PI), 3); };
  const chevron = (cx, cy, ax, ay, glow) => {
    const px = -ay, py = ax;
    // A chubby rounded chevron, like a little footprint of an arrow pressed into the dirt
    ctx.strokeStyle = `rgba(60,38,18,${0.26 + glow * 0.28})`; ctx.lineWidth = 5.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - ax * 4 + px * 8, cy - ay * 4 + py * 8);
    ctx.lineTo(cx + ax * 4, cy + ay * 4);
    ctx.lineTo(cx - ax * 4 - px * 8, cy - ay * 4 - py * 8);
    ctx.stroke();                                                                           // one plain stroke, no inner light or edge
  };
  for (const g of map.exits) for (let k = 0; k < 3; k++) {                 // beyond the gate, on the way out
    const glow = wave(k);
    const off = (g.out.y < 0 ? 84 : 36) + k * 16;                        // a gate on the top edge towers over the road behind it
    chevron(g.x + g.out.x * off, g.y + g.out.y * off, g.out.x, g.out.y, glow);
  }
  for (const e of map.entries) for (let k = 0; k < 3; k++) {               // before the lair, on the way in
    const glow = wave(k);
    chevron(e.rx - e.inn.x * (30 + k * 16), e.ry - e.inn.y * (30 + k * 16), e.inn.x, e.inn.y, glow);
  }

  drawSnowCover(ctx);                                        // settled snow lies on the ground
  drawWater();
  // Fallen monsters lie on the road under everything else
  for (const c of state.corpses) drawCorpse(c);

  // Build spots: stone pads set into the grass
  map.spots.forEach((s, i) => drawSpot(s, i, state.towers.some((t) => t.spot === i), state.hover === i));

  // A ghost of the tower being considered in the build menu, with the range it would have
  if (state.preview && state.selected !== null && !state.towers.some((t) => t.spot === state.selected) && TOWERS[state.preview]) {
    const s = map.spots[state.selected], ghost = { spot: state.selected, type: state.preview, x: s.x, y: s.y, def: TOWERS[state.preview], level: 1, cd: 0, soldiers: [], angle: -Math.PI / 2, anim: 0, recoil: 0, shooter: 0 };
    const r = towerRange(ghost), pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
    circle(ctx, s.x, s.y, r, "rgba(255,255,255,0.1)", `rgba(255,255,255,${0.45 + pulse * 0.25})`, 1.5);
    ctx.save(); ctx.globalAlpha = 0.45 + pulse * 0.1;
    const ds = depthScale(s.y); ctx.translate(s.x, s.y); ctx.scale(ds, ds); ctx.translate(-s.x, -s.y);
    drawTower(ghost);
    ctx.restore();
  }
  // Range preview for the selected tower, or for the barracks whose flag is being moved
  const focus = state.rallyFor || (state.selected !== null && state.towers.find((t) => t.spot === state.selected));
  if (focus) {
    const r = towerRange(focus);
    circle(ctx, focus.x, focus.y, r, "rgba(255,255,255,0.12)", "rgba(255,255,255,0.6)", 2);
    if (state.previewUpgrade && !state.rallyFor && focus.level < 4) {    // the reach it would gain: a dashed gold ring, with the gained band lightly filled
      const r2 = towerRange({ ...focus, level: focus.level + 1 }), pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
      ctx.save();
      ctx.beginPath(); ctx.arc(focus.x, focus.y, r2, 0, Math.PI * 2); ctx.arc(focus.x, focus.y, r, 0, Math.PI * 2, true);
      ctx.fillStyle = `rgba(255,213,79,${0.08 + pulse * 0.06})`; ctx.fill("evenodd");
      ctx.setLineDash([8, 6]); ctx.lineDashOffset = -state.time * 20;
      circle(ctx, focus.x, focus.y, r2, null, `rgba(255,213,79,${0.6 + pulse * 0.3})`, 2);
      ctx.restore();
    }
    if (focus.rally) drawRallyFlag(focus.rally, !!state.rallyFor);
  }

  // Droppings left by the animals, fading away
  for (const p of state.poops) {
    const t = Math.min(1, (p.age || 0) / 0.35), fall = 1 - t;                  // drops in and settles with a tiny bounce
    const bounce = p.age > 0.35 && p.age < 0.6 ? Math.sin(((p.age - 0.35) / 0.25) * Math.PI) * 1.2 : 0;
    const sz = p.size * (0.6 + 0.4 * t);
    ctx.globalAlpha = Math.min(1, p.life / 6) * 0.9;
    for (let i = 0; i < p.n; i++) ellipse(ctx, p.x + Math.sin(p.seed + i * 2.1) * sz * 1.6, p.y + Math.cos(p.seed + i * 1.7) * sz * 0.8 - fall * fall * 7 - bounce, sz, sz * 0.7, "#4e342e", "#3e2723", 0.5);
    if (p.age > 0.4 && p.age < 2.4) {                                            // a few wavy whiffs rise and fade
      const a = (p.age - 0.4) / 2;
      ctx.globalAlpha = (1 - a) * 0.35; ctx.strokeStyle = "#9e9d8a"; ctx.lineWidth = 0.9; ctx.lineCap = "round";
      for (let i = -1; i <= 1; i++) {
        const x0 = p.x + i * 3 * p.size, y0 = p.y - 2 - a * 14;
        ctx.beginPath(); ctx.moveTo(x0, y0 + 6);
        ctx.quadraticCurveTo(x0 + 2, y0 + 3 + Math.sin(state.time * 6 + i) * 1.2, x0, y0);
        ctx.quadraticCurveTo(x0 - 2, y0 - 3 - Math.sin(state.time * 6 + i) * 1.2, x0, y0 - 6);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;

  // Napalm: patches of burning ground
  for (const f of state.fires) {
    const k = Math.min(1, f.life / 0.8), T = state.time * 9 + f.seed;
    ctx.globalAlpha = 0.45 * k; circle(ctx, f.x, f.y + 2, f.r, "rgba(255,112,67,0.6)"); ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const a = f.seed + i * 0.7, rr = f.r * (0.2 + ((i * 0.37) % 0.75)), fx = f.x + Math.cos(a) * rr, fy = f.y + Math.sin(a) * rr * 0.5;
      const h = (6 + 4 * Math.sin(T + i * 1.3)) * k;
      ctx.globalAlpha = 0.9 * k;
      poly(ctx, [[fx - 3, fy], [fx + 3, fy], [fx + Math.sin(T * 1.4 + i) * 2, fy - h]], "#ff9800");
      poly(ctx, [[fx - 1.5, fy], [fx + 1.5, fy], [fx + Math.sin(T * 1.4 + i) * 1.5, fy - h * 0.6]], "#ffeb3b");
    }
    ctx.globalAlpha = 0.25 * k; circle(ctx, f.x + Math.sin(T * 0.3) * 4, f.y - 14 - (T % 8) * 1.5, 4 + (T % 8) * 0.5, "#9e9e9e"); ctx.globalAlpha = 1;
  }

  // Shots
  for (const s of state.shots) {
    const a = Math.atan2(s.ty - s.y, s.tx - s.x);
    if (s.ballistic) {
      // Shadow on the ground shrinks as the ball climbs; the ball grows as it gets closer to the camera
      const k = s.z / 150;
      ctx.globalAlpha = 0.3 * (1 - k * 0.6);
      circle(ctx, s.x, s.y + 3, 5 * (1 - k * 0.5), "#000");
      ctx.globalAlpha = 1;
      const r = 5 * (1 + k * 0.6);
      circle(ctx, s.x, s.y - s.z, r, "#212121", "#000", 1);
      circle(ctx, s.x - r * 0.3, s.y - s.z - r * 0.3, r * 0.3, "#757575");
    } else if (s.fireball) {                                 // a roaring fireball with a flame trail
      s.trail.forEach((p, i) => {
        ctx.globalAlpha = ((i + 1) / s.trail.length) * 0.6;
        circle(ctx, p.x + (Math.random() - 0.5) * 3, p.y + (Math.random() - 0.5) * 3, 2 + i * 0.7, i % 2 ? "#ff9800" : "#ffeb3b");
      });
      ctx.globalAlpha = 1;
      const r = 6 + Math.min(6, s.fireball.splash * 0.12);
      const glow = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, r * 1.8);
      glow.addColorStop(0, "rgba(255,255,255,0.95)"); glow.addColorStop(0.35, "rgba(255,193,7,0.9)"); glow.addColorStop(0.7, "rgba(255,87,34,0.6)"); glow.addColorStop(1, "rgba(255,87,34,0)");
      circle(ctx, s.x, s.y, r * 1.8, glow);
      circle(ctx, s.x, s.y, r * 0.5, "#fff8e1");
    } else if (s.def.type === "magic") {
      s.trail.forEach((p, i) => {                            // fading trail behind the bolt
        ctx.globalAlpha = ((i + 1) / s.trail.length) * 0.5;
        circle(ctx, p.x, p.y, 2 + i * 0.4, "#ce93d8");
      });
      ctx.globalAlpha = 1;
      const glow = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 10);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.4, "rgba(206,147,216,0.8)");
      glow.addColorStop(1, "rgba(206,147,216,0)");
      circle(ctx, s.x, s.y, 10, glow);
      circle(ctx, s.x, s.y, 3, "#f3e5f5");
    } else {
      // Arrow: shaft, steel head and feather fletching, tilted along its flight
      const y = s.y - s.z, cx = Math.cos(a), cy = Math.sin(a);
      ctx.globalAlpha = 0.25; circle(ctx, s.x, s.y + 2, 1.5, "#000"); ctx.globalAlpha = 1;
      if (s.poison) {                                        // venom-green tip with a dripping trail
        ctx.globalAlpha = 0.5; for (const p of s.trail) circle(ctx, p.x, p.y, 1.5, "#9ccc65"); ctx.globalAlpha = 1;
        circle(ctx, s.x + cx * 8, y + cy * 8, 2.2, "#7cb342");
      }
      if (s.frost) {                                         // icy tip with a sparkling frost trail
        s.trail.forEach((p, i) => {
          ctx.globalAlpha = ((i + 1) / s.trail.length) * 0.5;
          circle(ctx, p.x + (Math.random() - 0.5) * 3, p.y + (Math.random() - 0.5) * 3, 1 + i * 0.3, i % 2 ? "#e0f7fa" : "#80deea");
        });
        ctx.globalAlpha = 1;
        const tipX = s.x + cx * 8, tipY = y + cy * 8;
        const glow = ctx.createRadialGradient(tipX, tipY, 1, tipX, tipY, 8);
        glow.addColorStop(0, "rgba(255,255,255,0.95)"); glow.addColorStop(0.5, "rgba(128,222,234,0.6)"); glow.addColorStop(1, "rgba(128,222,234,0)");
        circle(ctx, tipX, tipY, 8, glow);
      }
      if (s.fire) {                                          // burning tip with a flickering flame trail
        s.trail.forEach((p, i) => {
          ctx.globalAlpha = ((i + 1) / s.trail.length) * 0.6;
          circle(ctx, p.x + (Math.random() - 0.5) * 2, p.y - 1 + (Math.random() - 0.5) * 2, 1.5 + i * 0.6, i % 2 ? "#ff9800" : "#ffeb3b");
        });
        ctx.globalAlpha = 1;
        const glow = ctx.createRadialGradient(s.x + cx * 8, y + cy * 8, 1, s.x + cx * 8, y + cy * 8, 9);
        glow.addColorStop(0, "rgba(255,235,59,0.9)"); glow.addColorStop(0.5, "rgba(255,152,0,0.6)"); glow.addColorStop(1, "rgba(255,152,0,0)");
        circle(ctx, s.x + cx * 8, y + cy * 8, 9, glow);
      }
      line(ctx, s.x - cx * 8, y - cy * 8, s.x + cx * 6, y + cy * 6, "#8d6e63", 1.5);
      poly(ctx, [[s.x + cx * 9, y + cy * 9], [s.x + cx * 5 - cy * 2, y + cy * 5 + cx * 2], [s.x + cx * 5 + cy * 2, y + cy * 5 - cx * 2]], "#cfd8dc");
      line(ctx, s.x - cx * 8, y - cy * 8, s.x - cx * 10 - cy * 2.5, y - cy * 10 + cx * 2.5, "#e53935", 1.5);
      line(ctx, s.x - cx * 8, y - cy * 8, s.x - cx * 10 + cy * 2.5, y - cy * 10 - cx * 2.5, "#e53935", 1.5);
    }
  }

  // Towers, soldiers, monsters and animals, sorted so things lower on screen are drawn in front.
  // A tower's "feet" are the bottom of its stone pad, so monsters walking above it go behind it.
  // Everything standing on the ground is scaled about its feet by depthScale (buildings excepted)
  const actors = [];
  const scaled = (x, y, fn) => () => { const ds = depthScale(y); ctx.save(); ctx.translate(x, y); ctx.scale(ds, ds); ctx.translate(-x, -y); fn(); ctx.restore(); };
  for (const d of map.deco) actors.push({ y: d.y, draw: scaled(d.x, d.y, () => drawDecoItem(ctx, d)) });   // trees, bushes, rocks, flowers...
  for (const k of map.castles) actors.push({ y: k.y + 8 * k.scale, draw: () => drawCastleAt(ctx, k) });
  for (const g of map.exits) actors.push({ y: gateAnchorY(g), draw: () => drawGateStructure(ctx, g) });
  for (const e of map.entries) for (const p of lairParts(e)) actors.push({ y: p.y, draw: () => p.draw(ctx) });   // stakes and dead tree sort separately
  for (const e of map.entries) actors.push({ y: e.y + 12, draw: scaled(e.x, e.y, () => { drawSign(ctx, e.x, e.y, e.face); flag(e.x, e.y - 40, 20, "#c62828", 2 + e.y); }) });
  for (const t of state.towers) actors.push({ y: t.y + 12, draw: scaled(t.x, t.y, () => {
    drawTower(t);
    if (t.level > 1) {
      ctx.fillStyle = "#ffd54f"; ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("★".repeat(t.level), t.x, t.y + 34);
    }
  }) });
  for (const t of state.towers) for (const s of t.soldiers) if (s.hp > 0) actors.push({ y: s.y, draw: scaled(s.x, s.y, () => drawSoldier(s)) });
  for (const e of state.enemies) actors.push({ y: e.y, draw: scaled(e.x, e.y, () => drawEnemy(e)) });
  for (const c of state.critters) actors.push({ y: c.y, draw: scaled(c.x, c.y, () => drawCritter(c)) });
  for (const h of state.heroes) actors.push({ y: h.hp > 0 ? h.y : h.spawn.y, draw: scaled(h.hp > 0 ? h.x : h.spawn.x, h.hp > 0 ? h.y : h.spawn.y, () => drawHero(h)) });
  if (state.dog && state.dog.hp > 0) actors.push({ y: state.dog.y, draw: scaled(state.dog.x, state.dog.y, drawDog) });
  actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());
  // Falling blossom and leaves: cherry trees shed petals, autumn trees shed leaves. Both loosen from the
  // canopy, flutter down on the breeze with a tumbling spin and fade as they reach the grass.
  const AUTUMN = ["#e65100", "#f9a825", "#bf360c", "#ffb300", "#d84315"];
  for (const d of map.deco) {
    if (d.type !== "tree" || (d.variant !== 3 && d.variant !== 4)) continue;
    const autumn = d.variant === 4, s = d.s, topY = d.y - 22 * s, h0 = (d.seed % 1000) / 1000, tone = autumn ? null : cherryToneOf(d.seed);
    const n = autumn ? 4 : 5, speed = autumn ? 0.16 : 0.22;                   // leaves are heavier and fewer
    for (let i = 0; i < n; i++) {
      const p = ((state.time * speed + i * 0.23 + h0) % 1);                   // 0 at the canopy, 1 on the ground
      const px = d.x + Math.sin(h0 * 6.3 + i * 2.1) * 12 * s + Math.sin(state.time * 1.6 + i) * 4 + p * 14;   // drifting on the breeze
      const py = topY + p * (d.y + 2 - topY), rot = state.time * (autumn ? 2.2 : 3) + i;
      ctx.save(); ctx.globalAlpha = Math.min(1, Math.sin(Math.min(1, p / 0.9) * Math.PI) * 1.4) * 0.9;
      ctx.translate(px, py); ctx.rotate(rot); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(rot * 0.7)));
      if (autumn) ellipse(ctx, 0, 0, 2.3, 1.3, AUTUMN[(d.seed + i) % AUTUMN.length]);
      else ellipse(ctx, 0, 0, 1.9, 1.2, `hsl(${tone.hue},${tone.sat}%,${Math.min(97, tone.lit + (i % 2 ? 6 : -4))}%)`);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  // Living details on the structures, drawn over them: lantern glows, torches, banners, the temple's glint, the fountain
  // Lairs: the skulls' eyes glow and green mist seeps out of the entrance
  map.entries.forEach((e, i) => {
    const T = state.time + i * 1.7;
    for (const s of lairStakes(e)) { const gl = 0.5 + Math.sin(T * 3 + s.x) * 0.4; circle(ctx, s.x - 2.2, s.y - 36, 1.4, `rgba(118,255,3,${gl})`); circle(ctx, s.x + 2.2, s.y - 36, 1.4, `rgba(118,255,3,${gl})`); }
    for (let k = 0; k < 5; k++) {
      const p = (T * 0.25 + k / 5) % 1, spread = Math.sin(T * 0.7 + k * 2.3) * 22;
      const mx = e.rx + e.inn.x * p * 70 - e.inn.y * spread, my = e.ry + e.inn.y * p * 70 + e.inn.x * spread - p * 6;
      ctx.globalAlpha = 0.22 * (1 - p) * (0.6 + 0.4 * Math.sin(T * 2 + k));
      circle(ctx, mx, my, 10 + p * 16, "#8bc34a");
    }
    ctx.globalAlpha = 1;
  });
  // Exit gates: torches burn on the pillars and a chain with the castle's banner hangs across the road
  map.exits.forEach((g, i) => {
    const [a, b] = gatePillars(g), T = state.time * 9 + i;
    if (g.style === 2) {                                                    // Moorish gate: the gold tips of the domes catch the sun
      const tw = 0.5 + 0.5 * Math.sin(state.time * 2.2 + i + 2);
      const tips = [{ x: a.x, y: a.y - 39 - 7 * 2.25 }, { x: b.x, y: b.y - 39 - 7 * 2.25 }];
      if (Math.abs(a.y - b.y) < 1) tips.push({ x: (a.x + b.x) / 2, y: a.y - 36 - 22 - 6 * 2.25 });
      for (const f of tips) { ctx.globalAlpha = 0.12 + tw * 0.18; circle(ctx, f.x, f.y, 4 + tw * 3, "rgba(255,225,130,0.7)"); ctx.globalAlpha = 0.3 + tw * 0.5; circle(ctx, f.x - 0.4, f.y - 0.4, 0.8, "#fffbe6"); ctx.globalAlpha = 1; }
      return;
    }
    if (g.style === 1) {                                                    // paifang: red lanterns swing from the posts with a warm glow
      // The gold finials on the roofs catch the sun with a soft pulsing glow
      const tw = 0.5 + 0.5 * Math.sin(state.time * 2.2 + i + 1);
      const finials = Math.abs(a.y - b.y) < 1 ? [{ x: (a.x + b.x) / 2, y: a.y - 66 }] : [{ x: a.x, y: a.y - 58 }, { x: b.x, y: b.y - 58 }];
      for (const f of finials) { ctx.globalAlpha = 0.12 + tw * 0.18; circle(ctx, f.x, f.y, 4 + tw * 3, "rgba(255,225,130,0.7)"); ctx.globalAlpha = 0.3 + tw * 0.5; circle(ctx, f.x - 0.5, f.y - 0.5, 0.9, "#fffbe6"); ctx.globalAlpha = 1; }
      for (const p of [a, b]) {
        const sway = Math.sin(state.time * 1.6 + p.x) * 2.5, lx = p.x + 7 + sway, ly = p.y - 36;
        line(ctx, p.x + 5, p.y - 42, lx, ly - 6, "#5d0000", 1);
        ctx.globalAlpha = 0.3; circle(ctx, lx, ly, 13, "rgba(255,120,60,0.6)"); ctx.globalAlpha = 1;
        ellipse(ctx, lx, ly, 4, 5.5, "#c84a3f", "#7a2420", 0.8);
        line(ctx, lx - 3, ly - 2, lx + 3, ly - 2, "rgba(255,255,255,0.25)", 1); line(ctx, lx - 3, ly + 2, lx + 3, ly + 2, "rgba(0,0,0,0.25)", 1);
        rect(ctx, lx - 2, ly - 7, 4, 1.6, "#ffd54f"); rect(ctx, lx - 2, ly + 5.4, 4, 1.6, "#ffd54f");
        line(ctx, lx, ly + 7, lx + sway * 0.3, ly + 12, "#ffd54f", 1);      // tassel
      }
      return;
    }
    const style = CASTLE_STYLES[(map.castles[i] || map.castles[0]).style];
    ctx.strokeStyle = "#4e342e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y - 44); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 36, b.x, b.y - 44); ctx.stroke();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 40;
    poly(ctx, [[mx - 7, my], [mx + 7, my], [mx + 6, my + 12 + Math.sin(state.time * 4) * 1.5], [mx, my + 18 + Math.sin(state.time * 5) * 2], [mx - 6, my + 12 + Math.sin(state.time * 4) * 1.5]], style.banner, "rgba(0,0,0,0.3)", 0.8);
    for (const p of [a, b]) {
      const fl = Math.sin(T + p.x) * 1.5, fl2 = Math.sin(T * 1.7 + p.y) * 1.2;
      poly(ctx, [[p.x - 3, p.y - 46], [p.x + 3, p.y - 46], [p.x + fl, p.y - 56 - fl2]], "#ff9800");
      poly(ctx, [[p.x - 1.5, p.y - 46], [p.x + 1.5, p.y - 46], [p.x + fl * 0.6, p.y - 52 - fl2]], "#ffeb3b");
      ctx.globalAlpha = 0.25; circle(ctx, p.x, p.y - 50, 14, "rgba(255,180,60,0.6)"); ctx.globalAlpha = 1;
    }
  });
  map.castles.forEach((k, i) => {
    if (k.style === 2) {                                                    // the temple flies no flag: lanterns sway gently by the doors
      // The gold finial catches the sun: a soft glow and a four-point glint that pulses
      const fx = k.x, fy = k.y - 114 * k.scale, tw = 0.5 + 0.5 * Math.sin(state.time * 2.2 + i);
      ctx.globalAlpha = 0.12 + tw * 0.18; circle(ctx, fx, fy, (5 + tw * 3) * k.scale, "rgba(255,225,130,0.7)"); ctx.globalAlpha = 1;
      const r = (2 + tw * 3.5) * k.scale;
      ctx.strokeStyle = `rgba(255,250,220,${0.25 + tw * 0.45})`; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(fx - r, fy); ctx.lineTo(fx + r, fy); ctx.moveTo(fx, fy - r); ctx.lineTo(fx, fy + r); ctx.stroke();
      for (const side of [-1, 1]) {
        const sway = Math.sin(state.time * 1.4 + i + side) * 1.6 * k.scale, lx = k.x + side * 45 * k.scale + sway, ly = k.y - 23 * k.scale;
        line(ctx, k.x + side * 45 * k.scale, ly - 8 * k.scale, lx, ly - 4 * k.scale, "rgba(90,26,22,0.3)", 0.5);   // a barely-there string
        ctx.globalAlpha = 0.28; circle(ctx, lx, ly, 9 * k.scale, "rgba(255,120,60,0.6)"); ctx.globalAlpha = 1;
        ellipse(ctx, lx, ly, 2.6 * k.scale, 3.4 * k.scale, "#c84a3f", "#7a2420", 0.8);
        rect(ctx, lx - 1.3 * k.scale, ly - 4.4 * k.scale, 2.6 * k.scale, 1, "#e9c55a"); rect(ctx, lx - 1.3 * k.scale, ly + 3.4 * k.scale, 2.6 * k.scale, 1, "#e9c55a");
      }
      return;
    }
    if (k.style === 1) {                                                    // the palace flies no flag: the crescent glints and the fountain plays
      const sc = k.scale, tw = 0.5 + 0.5 * Math.sin(state.time * 2.2 + i + 3);
      const cx = k.x, cy = k.y - (60 + 20 * 2.25 + 5) * sc;
      ctx.globalAlpha = 0.1 + tw * 0.16; circle(ctx, cx, cy, (6 + tw * 3) * sc, "rgba(255,225,130,0.7)"); ctx.globalAlpha = 0.3 + tw * 0.5; circle(ctx, cx - 3.5 * sc, cy + 1 * sc, 0.8, "#fffbe6"); ctx.globalAlpha = 1;
      const fx = k.x, fy = k.y + 17 * sc;
      for (let j = 0; j < 6; j++) {                                         // water droplets arcing out of the spout
        const p = (state.time * 0.9 + j / 6) % 1, side = j % 2 ? 1 : -1, dx = side * p * 7 * sc, dy = -(Math.sin(p * Math.PI) * 10 + 2) * sc;
        ctx.globalAlpha = 0.85 * (1 - p * 0.6); circle(ctx, fx + dx, fy - 1 * sc + dy, 1 * sc, "#e3f2fd");
      }
      for (let j = 0; j < 2; j++) { const p = (state.time * 0.6 + j / 2) % 1; ctx.globalAlpha = (1 - p) * 0.5; ctx.strokeStyle = "#e3f2fd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(fx, fy, (2 + p * 6) * sc, (1 + p * 2.8) * sc, 0, 0, Math.PI * 2); ctx.stroke(); }   // ripples
      ctx.globalAlpha = 1;
      return;
    }
    flag(k.x, k.y - 92 * k.scale, 22 * k.scale, CASTLE_STYLES[k.style].banner, 1 + i);
  });

  // Scorch marks from cannonballs slowly fade away
  for (const sc of state.scorches) {
    ctx.globalAlpha = 0.45 * (sc.life / sc.maxLife);
    circle(ctx, sc.x, sc.y, sc.r, "#2b1d14");
    circle(ctx, sc.x, sc.y, sc.r * 0.55, "#140c08");
    ctx.globalAlpha = 1;
  }

  // Blood splashes soak into the ground
  for (const b of state.blood) {
    const fade = Math.min(1, b.life / 3);
    ctx.globalAlpha = 0.55 * fade;
    for (const d of b.drops) circle(ctx, b.x + d.x, b.y + d.y, d.r, "#8e1b1b");
    ctx.globalAlpha = 0.35 * fade;                                   // darker centres so the drops look wet
    for (const d of b.drops) circle(ctx, b.x + d.x, b.y + d.y, d.r * 0.55, "#5a0f0f");
    ctx.globalAlpha = 1;
  }

  drawEagle();                                               // airborne, so always on top

  // Chain lightning from the spires: jagged white bolts with a blue glow, gone in a flash
  for (const b of state.bolts) {
    const p = b.life / b.maxLife, jit = Math.floor(state.time * 40);
    for (let i = 0; i < b.pts.length - 1; i++) {
      const a = b.pts[i], c = b.pts[i + 1], segs = 6, pts = [[a.x, a.y]];
      for (let k = 1; k < segs; k++) {
        const f = k / segs, nx = -(c.y - a.y), ny = c.x - a.x, len = Math.hypot(nx, ny) || 1;
        const off = Math.sin(b.seed * 13 + jit * 7 + k * 5 + i * 3) * 7;
        pts.push([a.x + (c.x - a.x) * f + (nx / len) * off, a.y + (c.y - a.y) * f + (ny / len) * off]);
      }
      pts.push([c.x, c.y]);
      ctx.globalAlpha = p * 0.6; ctx.strokeStyle = "#4fc3f7"; ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
      ctx.globalAlpha = p; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.8;
      ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Bursts (explosions, hits, deaths)
  for (const b of state.bursts) {
    const p = 1 - b.life / b.maxLife;
    ctx.globalAlpha = 1 - p;
    circle(ctx, b.x, b.y, b.maxR * (0.3 + 0.7 * p), null, b.color, 3);
    ctx.globalAlpha = 1;
  }

  // Smoke
  for (const p of state.smoke) {
    ctx.globalAlpha = 0.5 * (p.life / p.maxLife);
    circle(ctx, p.x, p.y, p.r, "#9e9e9e");
    ctx.globalAlpha = 1;
  }

  // Floating text
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.min(f.life, 1);
    ctx.fillStyle = f.color;
    ctx.font = `bold ${f.size}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  drawWeather(ctx);                                          // rain or snow falls over everything
}

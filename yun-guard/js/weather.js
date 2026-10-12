import { state } from "./state.js";
import { W, H } from "./config.js";
import { map } from "./map.js";
import { lights, LIGHT_TINT } from "./render/lights.js";

// Weather drifts in now and then: a shower of rain, a flurry of snow, or night falling over the land,
// fading in, lingering for a while, then clearing up again.
const CLEAR_MIN = 35, CLEAR_MAX = 80;      // seconds of clear sky between spells
const SPELL_MIN = 18, SPELL_MAX = 40;      // how long a spell lasts
const FADE = 4;                            // seconds to fade in / out

export function initWeather() {
  state.weather = { type: null, intensity: 0, timer: CLEAR_MIN * 0.3 + Math.random() * 20, ending: false, drops: [], cover: 0, splashes: [] };
}

export function updateWeather(dt) {
  const w = state.weather;
  if (!w) return;
  w.timer -= dt;
  if (!w.type) {
    if (w.timer <= 0) {                                      // a spell begins
      const roll = Math.random();
      w.type = roll < 0.42 ? "rain" : roll < 0.7 ? "snow" : "night";
      w.timer = SPELL_MIN + Math.random() * (SPELL_MAX - SPELL_MIN);
      if (w.type === "night") w.timer += 20;                 // a night lingers a little longer
      w.ending = false;
      w.drops = [];
      const n = w.type === "rain" ? 220 : w.type === "snow" ? 140 : 0;
      for (let i = 0; i < n; i++) w.drops.push(newDrop(w.type, true));
      if (w.type === "night") w.fireflies = makeFireflies();
    }
    return;
  }
  if (w.timer <= 0) w.ending = true;
  w.intensity += (w.ending ? -1 : 1) * dt / FADE;
  w.intensity = Math.max(0, Math.min(1, w.intensity));
  if (w.ending && w.intensity <= 0) {                        // cleared up
    w.type = null;
    w.timer = CLEAR_MIN + Math.random() * (CLEAR_MAX - CLEAR_MIN);
    w.drops = [];
    return;
  }
  for (const d of w.drops) {
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (w.type === "snow") d.x += Math.sin(state.time * 1.5 + d.wob) * 12 * dt;
    if (d.y > d.land) {                                        // it lands: a little splash ring, or a flake settling
      if (d.x > 0 && d.x < W && w.splashes.length < 160) w.splashes.push({ x: d.x, y: d.land, t: 0, snow: w.type === "snow" });
      Object.assign(d, newDrop(w.type, false));
    } else if (d.x < -20 || d.x > W + 20) Object.assign(d, newDrop(w.type, false));
  }
  if (w.type === "night") updateFireflies(dt);
  for (const s of w.splashes) s.t += dt;
  w.splashes = w.splashes.filter((s) => s.t < (s.snow ? 1.2 : 0.45));
  // Snow settles into a soft dusting over the land while it falls, and melts away afterwards
  const settling = w.type === "snow" && !w.ending ? dt / 25 : -dt / 20;
  w.cover = Math.max(0, Math.min(1, w.cover + settling));
}

function newDrop(type, anywhere) {
  const x = Math.random() * (W + 80) - 40;
  const land = type === "snow" ? H / 3 + Math.random() * (H * 2 / 3) : Math.random() * H;   // where it hits the ground; snow settles anywhere below the top third
  const y = anywhere ? Math.random() * land : -10 - Math.random() * 30;
  if (type === "rain") return { x, y, land, vx: -60, vy: 520 + Math.random() * 160, len: 10 + Math.random() * 8 };
  return { x, y, land, vx: -8, vy: 28 + Math.random() * 30, r: 1 + Math.random() * 1.8, wob: Math.random() * 6 };
}

export function drawWeather(ctx) {
  const w = state.weather;
  if (!w || !w.type || w.intensity <= 0) return;
  const k = w.intensity;
  if (w.type === "night") { drawNight(ctx, k); return; }
  // A light overcast over the whole land while the weather lasts: cool and dim in rain, pale and flat in snow
  ctx.fillStyle = w.type === "rain" ? `rgba(40,52,74,${0.11 * k})` : `rgba(170,180,200,${0.09 * k})`;
  ctx.fillRect(0, 0, W, H);
  if (w.type === "rain") {
    // Splash rings where drops hit the ground
    ctx.strokeStyle = "#e3f2fd"; ctx.lineWidth = 1; ctx.fillStyle = "#e3f2fd";
    for (const s of w.splashes) {
      const p = s.t / 0.45;
      ctx.globalAlpha = (1 - p) * 0.45 * k;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 1.5 + p * 5, (1.5 + p * 5) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      if (p < 0.4) { ctx.beginPath(); ctx.arc(s.x, s.y - 2 - p * 6, 0.8, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(200,225,255,${0.35 * k})`; ctx.lineWidth = 1; ctx.lineCap = "round";   // no overall tint: just the rain itself
    ctx.beginPath();
    for (const d of w.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.12, d.y + d.len); }
    ctx.stroke();
  } else {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`;         // no haze: just the falling snow
    for (const d of w.drops) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    // Flakes settling: a small white fleck that fades into the dusting
    ctx.fillStyle = "#ffffff";
    for (const s of w.splashes) { ctx.globalAlpha = (1 - s.t / 1.2) * 0.7; ctx.beginPath(); ctx.ellipse(s.x, s.y, 2.2, 1.1, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

// Snow that has settled: soft white patches drifting over the land, drawn under everything that stands
export function drawSnowCover(ctx) {
  const w = state.weather;
  if (!w || w.cover <= 0) return;
  ctx.globalAlpha = w.cover * 0.32;
  for (let i = 0; i < 70; i++) {                               // a fixed scatter of soft patches
    const x = ((i * 193.7) % W), y = ((i * 131.3 + 40) % H), rx = 60 + (i % 5) * 18, ry = rx * 0.45;
    const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- Night ----------
// Darkness settles over the land. Only what really glows pushes it back: flames, lanterns, lit windows,
// the mages' orbs, gold finials. Those are registered by their own drawing code (see render/lights.js).
// A few fireflies wander the whole map, blinking.
const nightLayer = document.createElement("canvas"), nctx = nightLayer.getContext("2d");
function makeFireflies() {
  const out = [];
  for (let i = 0; i < 14; i++) out.push({ x: Math.random() * W, y: H * 0.1 + Math.random() * H * 0.85, a: Math.random() * 6.3, turn: 0, ph: Math.random() * 6.3, rate: 1.6 + Math.random() * 1.4 });
  return out;
}
export function updateFireflies(dt) {
  const w = state.weather;
  if (!w || !w.fireflies) return;
  for (const f of w.fireflies) {                               // a slow, meandering flight
    f.turn += (Math.random() - 0.5) * 3 * dt; f.turn *= 0.98;
    f.a += f.turn * dt * 4;
    f.x += Math.cos(f.a) * 22 * dt; f.y += Math.sin(f.a) * 14 * dt;
    if (f.x < 10 || f.x > W - 10) f.a = Math.PI - f.a;
    if (f.y < 30 || f.y > H - 10) f.a = -f.a;
  }
}
function drawNight(ctx, k) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  if (nightLayer.width !== cw || nightLayer.height !== ch) { nightLayer.width = cw; nightLayer.height = ch; }
  nctx.setTransform(1, 0, 0, 1, 0, 0);
  nctx.globalCompositeOperation = "source-over";
  nctx.clearRect(0, 0, cw, ch);
  nctx.fillStyle = `rgba(6,10,36,${0.62 * k})`;                 // the dark of night, deep blue
  nctx.fillRect(0, 0, cw, ch);
  nctx.globalCompositeOperation = "destination-out";             // each light leaves a soft hole in the dark
  for (const l of lights) {
    const flick = l.kind === "flame" ? 0.97 + 0.03 * Math.sin(state.time * 23 + l.x) : 1;   // flames breathe a little, nothing else moves
    const r = l.r * flick;
    const g = nctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
    g.addColorStop(0, "rgba(0,0,0,0.9)"); g.addColorStop(0.3, "rgba(0,0,0,0.6)"); g.addColorStop(0.7, "rgba(0,0,0,0.18)"); g.addColorStop(1, "rgba(0,0,0,0)");
    nctx.fillStyle = g; nctx.beginPath(); nctx.ellipse(l.x, l.y, r, r * 0.85, 0, 0, Math.PI * 2); nctx.fill();
  }
  // Each light also tints its surroundings with its own colour
  nctx.globalCompositeOperation = "source-over";
  for (const l of lights) {
    const [cr, cg, cb] = LIGHT_TINT[l.kind] || LIGHT_TINT.flame, r = l.r * 0.8;
    const g = nctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.16 * k})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    nctx.fillStyle = g; nctx.beginPath(); nctx.ellipse(l.x, l.y, r, r * 0.85, 0, 0, Math.PI * 2); nctx.fill();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(nightLayer, 0, 0); ctx.restore();
  // Fireflies: a tiny spark with a faint halo, blinking on and off as it drifts
  for (const f of state.weather.fireflies || []) {
    const on = Math.max(0, Math.sin(state.time * f.rate + f.ph) - 0.2) / 0.8;
    if (on <= 0.02) continue;
    ctx.globalAlpha = on * k;
    ctx.fillStyle = "rgba(205,255,120,0.3)"; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#eaffb0"; ctx.beginPath(); ctx.arc(f.x, f.y, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

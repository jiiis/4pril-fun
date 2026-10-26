import { W, H, ROAD_WIDTH, ROAD_EDGE } from "../config.js";
import { rng, pointsAlongPath, closestPointOnPath, pointAtArc } from "../util.js";
import { map } from "../map.js";
import { createCanvas, rect, circle, ellipse, poly, line, shadow } from "./gfx.js";
import { addLight } from "./lights.js";
import { state } from "../state.js";

let canvasBlurSupported;
function drawBlurredMask(c, source, sigma) {
  if (canvasBlurSupported === undefined) {
    const probe = createCanvas(5, 5);
    const p = probe.getContext("2d");
    p.filter = "blur(1px)"; p.fillRect(2, 2, 1, 1);
    canvasBlurSupported = p.getImageData(1, 2, 1, 1).data[3] > 0;
  }
  if (canvasBlurSupported) {
    c.save(); c.filter = `blur(${sigma}px)`; c.drawImage(source, 0, 0); c.restore();
    return;
  }
  c.drawImage(source, 0, 0);
  const w = c.canvas.width, h = c.canvas.height, img = c.getImageData(0, 0, w, h);
  // Only alpha is used by these masks. Three sliding box blurs approximate the native Gaussian
  // in linear time, even for the wide junction blur. Outside the canvas stays transparent.
  let a = new Float32Array(w * h), b = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = img.data[i * 4 + 3];
  const ideal = Math.sqrt(4 * sigma * sigma + 1);
  let lower = Math.floor(ideal); if (lower % 2 === 0) lower--;
  lower = Math.max(1, lower);
  const upper = lower + 2;
  const count = Math.round((12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4));
  const pass = (radius, horizontal) => {
    const length = horizontal ? w : h, lines = horizontal ? h : w, stride = horizontal ? 1 : w;
    const divisor = 2 * radius + 1;
    for (let line = 0; line < lines; line++) {
      const base = horizontal ? line * w : line;
      let sum = 0;
      for (let j = 0; j <= Math.min(radius, length - 1); j++) sum += a[base + j * stride];
      for (let j = 0; j < length; j++) {
        b[base + j * stride] = sum / divisor;
        if (j >= radius) sum -= a[base + (j - radius) * stride];
        if (j + radius + 1 < length) sum += a[base + (j + radius + 1) * stride];
      }
    }
    [a, b] = [b, a];
  };
  for (let i = 0; i < 3; i++) {
    const radius = ((i < count ? lower : upper) - 1) / 2;
    pass(radius, true); pass(radius, false);
  }
  for (let i = 0; i < a.length; i++) img.data[i * 4 + 3] = a[i];
  c.putImageData(img, 0, 0);
}

// The scenery never changes, so we draw it once onto a hidden canvas
// and then just copy that picture every frame.
export function buildBackground(res = 1) {                      // res: device pixels per world pixel
  const off = createCanvas(Math.round(W * res), Math.round(H * res));
  const c = off.getContext("2d");
  c.scale(res, res);
  const rand = rng(1234);
  const Y0 = 0, HH = H;

  // Grass base
  const g = c.createLinearGradient(0, Y0, 0, H);
  g.addColorStop(0, "#7bbb47");
  g.addColorStop(1, "#5a9a34");
  c.fillStyle = g;
  c.fillRect(0, Y0, W, HH);

  // Rolling hills: lit from the top-left, shaded toward the bottom-right, with a soft shadow at their foot
  for (let i = 0; i < 14; i++) {
    const hx = rand() * W, hy = Y0 + rand() * HH, rx = 70 + rand() * 110, ry = rx * (0.45 + rand() * 0.2);
    ellipse(c, hx + rx * 0.12, hy + ry * 0.35, rx * 1.02, ry * 0.9, "rgba(20,60,15,0.11)");          // shadow at the foot of the hill
    const hg = c.createRadialGradient(hx - rx * 0.35, hy - ry * 0.45, 4, hx, hy, rx);
    hg.addColorStop(0, "rgba(170,225,110,0.55)");
    hg.addColorStop(0.6, "rgba(120,185,70,0.25)");
    hg.addColorStop(1, "rgba(60,110,35,0.35)");
    ellipse(c, hx, hy, rx, ry, hg);
    ellipse(c, hx - rx * 0.1, hy - ry * 0.15, rx * 0.7, ry * 0.55, "rgba(255,255,170,0.08)");       // sun on the crest
  }
  // Sunlit patches
  for (let i = 0; i < 60; i++) {
    ellipse(c, rand() * W, Y0 + rand() * HH, 40 + rand() * 80, 20 + rand() * 40, rand() < 0.35 ? `rgba(225,175,80,${0.05 + rand() * 0.07})` : `rgba(255,255,160,${0.04 + rand() * 0.06})`);   // sun, and patches of straw-dry grass
  }

  // Thousands of tiny grass blades
  for (let i = 0; i < 5000; i++) {
    const x = rand() * W, y = Y0 + rand() * HH, len = 3 + rand() * 5, lean = (rand() - 0.5) * 3;
    line(c, x, y, x + lean, y - len, rand() < 0.5 ? "rgba(30,90,20,0.35)" : "rgba(170,230,110,0.35)", 1);
  }

  // Ponds and rivers run under the road
  for (const p of map.ponds) drawPond(c, p);
  const rivers = [...map.rivers].sort((a, b) => (a.parent ? 0 : 1) - (b.parent ? 0 : 1));   // tributaries first, so the river they join is painted over their end
  for (const r of rivers) drawRiver(c, r, rand, 0);              // banks and mud for every river first ...
  for (const r of rivers) drawRiver(c, r, rand, 1);              // ... then the water, so a tributary flows into its river

  drawRoad(c, rand, map.paths);
  liftGrass(c);                                                  // the grass stands above the roads and rivers: a soil wall, a lit crest and a shadow

  for (const b of map.bridges) drawBridge(c, b);
  for (const g of map.exits) drawGateGround(c, g);                // chevrons on the road
  for (const e of map.entries) drawLairGround(c, e, rand);         // scorched earth and bones
  // Everything that stands up (scenery, gates, stakes, buildings, signposts) is drawn each frame in draw.js,
  // sorted by depth with the monsters, so nearer things always overlap farther ones.

  // Vignette: the corners fall away into shade
  const v = c.createRadialGradient(W * 0.5, H * 0.45, H * 0.45, W * 0.5, H * 0.5, H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,20,0,0.28)");
  c.fillStyle = v; c.fillRect(0, Y0, W, HH);
  // Sunlight falls from the top-left
  const sun = c.createLinearGradient(0, Y0, W, H);
  sun.addColorStop(0, "rgba(255,255,200,0.10)");
  sun.addColorStop(1, "rgba(0,0,40,0.10)");
  c.fillStyle = sun; c.fillRect(0, Y0, W, HH);
  return off;
}

// The grass is higher ground. Roads and rivers are cut into it, so wherever the grass meets one from the north
// (sunlight from the top-left, looking in from the south) you see a short wall of soil under a bright crest,
// with a soft shadow on the road or water just below. Found from what is actually drawn: any pixel that is
// not green counts as road or water, so rounded corners and ragged edges are followed exactly.
function liftGrass(c) {
  const res = c.getTransform().a, cv = c.canvas, W1 = cv.width, H1 = cv.height;   // the mask is found at full resolution, then blurred a hair so its edges run smooth
  const mk = createCanvas;
  const S = mk(W1, H1), sctx = S.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(cv, 0, 0, W1, H1);
  const img = sctx.getImageData(0, 0, W1, H1), d = img.data, n = W1 * H1;
  for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; d[i + 3] = (g < r + 6 || b > g) ? 255 : 0; }   // not grass: road, mud or water
  const w = W1;
  { // small islands of green inside a road or the water (lily pads, tufts, specks) are not ground: fill them in
    const seen = new Uint8Array(n), limit = 700 * res * res, stack = new Int32Array(n), comp = new Int32Array(n);
    for (let s0 = 0; s0 < n; s0++) {
      if (seen[s0] || d[s0 * 4 + 3]) continue;
      let sp = 0, cn = 0; stack[sp++] = s0; seen[s0] = 1;
      while (sp) {
        const q = stack[--sp]; comp[cn++] = q; const x = q % w;
        if (x > 0 && !seen[q - 1] && !d[(q - 1) * 4 + 3]) { seen[q - 1] = 1; stack[sp++] = q - 1; }
        if (x < w - 1 && !seen[q + 1] && !d[(q + 1) * 4 + 3]) { seen[q + 1] = 1; stack[sp++] = q + 1; }
        if (q >= w && !seen[q - w] && !d[(q - w) * 4 + 3]) { seen[q - w] = 1; stack[sp++] = q - w; }
        if (q < n - w && !seen[q + w] && !d[(q + w) * 4 + 3]) { seen[q + w] = 1; stack[sp++] = q + w; }
      }
      if (cn <= limit) for (let i = 0; i < cn; i++) d[comp[i] * 4 + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  const M = mk(cv.width, cv.height), mctx = M.getContext("2d");                              // the mask, edges smoothed
  drawBlurredMask(mctx, S, 1.4 * res);
  { const q = mctx.getImageData(0, 0, cv.width, cv.height), qd = q.data;                       // blur then cut at half: a smooth outline with a crisp, anti-aliased edge
    for (let i = 3; i < qd.length; i += 4) qd[i] = Math.max(0, Math.min(255, (qd[i] - 128) * 6 + 128));
    mctx.putImageData(q, 0, 0); }
  const K = mk(cv.width, cv.height), kc = K.getContext("2d");
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  const lay = (keep, cut, fill, clip = false) => {                                              // M shifted by `keep` minus M shifted by `cut` (px, down is positive): a strip along the north edges
    kc.globalCompositeOperation = "source-over"; kc.clearRect(0, 0, K.width, K.height);
    const shifted = (dy) => { kc.drawImage(M, 0, dy * res); if (dy > 0) kc.drawImage(M, 0, 0, M.width, 1, 0, 0, M.width, dy * res); };   // a road or river running off the top carries on above it: no wall along the screen's edge
    shifted(keep); kc.globalCompositeOperation = "destination-out"; shifted(cut);
    if (clip) { kc.globalCompositeOperation = "destination-in"; kc.drawImage(M, 0, 0); }
    kc.globalCompositeOperation = "source-in"; kc.fillStyle = fill; kc.fillRect(0, 0, K.width, K.height);
    c.drawImage(K, 0, 0);
  };
  const WALL = 3.5;
  lay(WALL, WALL + 6, "rgba(15,8,4,0.32)", true);                                                // a soft shadow on the road or water just under the wall
  lay(0, WALL, "#4d3524");                                                                      // the soil wall
  lay(0, WALL * 0.45, "#7d5c3b");                                                               // its sunlit upper part
  lay(-1.6, 0, "rgba(205,242,135,0.6)");                                                        // a bright crest of grass above it
  c.restore();
}

// A long, soft shadow stretching to the lower-right, as if the sun were high on the left
function castShadow(c, x, y, w, h) {
  if (!w) return;
  c.save();
  c.translate(x + w * 0.35, y + 2);
  c.transform(1, 0, -0.55, 0.35, 0, 0);                        // skew and flatten onto the ground
  const g = c.createRadialGradient(0, -h * 0.3, 1, 0, -h * 0.3, h);
  g.addColorStop(0, "rgba(10,30,5,0.32)");
  g.addColorStop(1, "rgba(10,30,5,0)");
  c.fillStyle = g;
  c.beginPath(); c.ellipse(0, -h * 0.3, w, h, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

function strokePath(c, width, color) {
  strokePoly(c, map.path, width, color);
}

// The road: a sunken dirt track that is never the same width twice. It is drawn as hundreds of
// short, round-capped strokes whose width wanders along the way, then the edges are roughed up
// with earth lumps and grass creeping in, so there is no clean outline anywhere.
let roadSamples = [];                                           // every road sample with its drawn width (bridges read these)
const ROAD_BANK = 8;                                             // the earthen bank layer is this much wider than the surface
const ROAD_RAGGED = 10;                                          // how far lumps of earth and grass can bulge past the bank
const roadReach = (w) => w / 2 + ROAD_BANK / 2 + ROAD_RAGGED;    // from the centre line to the outermost bit of road at width w
function drawRoad(c, rand, paths) {
  // Pre-compute the sample points and the wandering width of every route
  roadSamples = [];
  const roads = paths.map((path) => {
    const pts = pointsAlongPath(path, 4);
    pts.push({ ...path[path.length - 1], nx: 0, ny: 1 });
    const ph1 = rand() * 6, ph2 = rand() * 6;
    let w = pts.map((_, i) => ROAD_WIDTH * (1 + 0.07 * Math.sin(i * 0.06 + ph1) + 0.03 * Math.sin(i * 0.19 + ph2)));   // gentle: within ±10%
    for (let pass = 0; pass < 3; pass++) w = w.map((v, i) => (w[Math.max(0, i - 1)] + v + w[Math.min(w.length - 1, i + 1)]) / 3);
    pts.forEach((p, i) => roadSamples.push({ x: p.x, y: p.y, w: w[i] }));
    return { path, pts, w };
  });
  // Is this point on the surface of one of the OTHER routes? (used to keep edge details off junctions)
  const onOtherRoad = (k, p) => roads.some((r, j) => j !== k && closestPointOnPath(r.path, p).d < ROAD_WIDTH / 2 - 2);

  // Junctions: where a branch leaves or joins another route, the strokes meet in a sharp grass point
  const junctions = [];
  for (let k = 1; k < paths.length; k++) {
    const br = paths[k], others = paths.filter((_, j) => j !== k);
    const onOther = (q) => others.some((o) => closestPointOnPath(o, q).d < ROAD_WIDTH * 0.35);
    for (const seq of [br, br.slice().reverse()]) {
      let i = 0; while (i < seq.length && onOther(seq[i])) i++;
      if (i === 0 || i >= seq.length) continue;
      // How sharply the branch meets the other road decides how big a fillet it needs: an acute join already
      // has a long thin wedge, so it gets a smaller rounding than a square one
      const P = seq[i - 1], nx = seq[Math.min(i + 3, seq.length - 1)];
      const other = others.map((o) => ({ o, d: closestPointOnPath(o, P).d })).sort((a, b) => a.d - b.d)[0].o;
      let bi = 0, bd = Infinity; for (let j = 0; j < other.length; j++) { const d = Math.hypot(other[j].x - P.x, other[j].y - P.y); if (d < bd) { bd = d; bi = j; } }
      const a = other[Math.max(0, bi - 3)], b = other[Math.min(other.length - 1, bi + 3)];
      const l1 = Math.hypot(b.x - a.x, b.y - a.y) || 1, l2 = Math.hypot(nx.x - P.x, nx.y - P.y) || 1;
      const cosA = Math.abs(((b.x - a.x) * (nx.x - P.x) + (b.y - a.y) * (nx.y - P.y)) / (l1 * l2));   // 1 = running alongside, 0 = square
      junctions.push({ x: P.x, y: P.y, sigma: ROAD_WIDTH * (0.36 - 0.14 * cosA) });
    }
  }
  // Grass can also pinch to a boxy point without any junction: inside a sharp bend, or where a road doubles back
  // close to itself or to another route. Round those the same way.
  {
    const addJ = (x, y) => { if (!junctions.some((J) => Math.hypot(J.x - x, J.y - y) < ROAD_WIDTH * 1.1)) junctions.push({ x, y, sigma: ROAD_WIDTH * 0.3 }); };
    const samp = [];
    paths.forEach((path, k) => { const pts = pointsAlongPath(path, 16); pts.forEach((p, i) => samp.push({ x: p.x, y: p.y, k, i })); });
    for (const a of samp) {                                                              // sharp bends: the heading turns far within a short stretch
      const A = samp.find((q) => q.k === a.k && q.i === a.i - 3), B = samp.find((q) => q.k === a.k && q.i === a.i + 3);
      if (!A || !B) continue;
      const v1x = a.x - A.x, v1y = a.y - A.y, v2x = B.x - a.x, v2y = B.y - a.y;
      const cos = (v1x * v2x + v1y * v2y) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1);
      if (cos < 0.35) addJ(a.x, a.y);
    }
    for (let m = 0; m < samp.length; m++) for (let n = m + 1; n < samp.length; n++) {     // near misses: two stretches closer than a road's width apart
      const a = samp[m], b = samp[n];
      if (a.k === b.k && Math.abs(a.i - b.i) < 22) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < ROAD_WIDTH * 1.55 && d > ROAD_WIDTH * 0.45) addJ((a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  }
  // Around each junction the layer is redrawn as a mask (strokes, blurred, cut at a threshold): that rounds
  // the corners where the roads meet, inside and out, and leaves straight stretches exactly as they were.
  const res = c.getTransform().a, REG = Math.round(ROAD_WIDTH * 3.4), RP = Math.round(REG * res);
  const strokes = createCanvas(), soft = createCanvas();
  strokes.width = soft.width = RP; strokes.height = soft.height = RP;
  const sc = strokes.getContext("2d"), fc = soft.getContext("2d");
  // One blurred field per junction (from the base-width strokes); every layer cuts its own shape from it at a
  // level matching its width, so bank, base and surface stay parallel round the corner. Gaussian blur of a
  // straight edge falls off at 255 / (sigma * sqrt(2 pi)) alpha per pixel: that converts a width offset to a level.
  const slopeOf = (J) => 255 / (J.sigma * 2.5066);
  const fields = new Map();
  const fieldFor = (J) => {
    if (fields.has(J)) return fields.get(J);
    const x0 = J.x - REG / 2, y0 = J.y - REG / 2;
    sc.setTransform(res, 0, 0, res, -x0 * res, -y0 * res); sc.clearRect(x0, y0, REG, REG);
    sc.strokeStyle = "#000"; sc.lineCap = "round"; sc.lineJoin = "round";
    for (const { pts, w } of roads) for (let i = 0; i < pts.length - 1; i++) {
      if (Math.abs(pts[i].x - J.x) > REG || Math.abs(pts[i].y - J.y) > REG) continue;
      sc.lineWidth = Math.max(2, w[i]); sc.beginPath(); sc.moveTo(pts[i].x, pts[i].y); sc.lineTo(pts[i + 1].x, pts[i + 1].y); sc.stroke();
    }
    fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(0, 0, RP, RP);
    drawBlurredMask(fc, strokes, J.sigma * res);
    const field = fc.getImageData(0, 0, RP, RP);
    fields.set(J, field);
    return field;
  };
  const roundJunction = (J, color, scale, extra, dy) => {
    const x0 = J.x - REG / 2, y0 = J.y - REG / 2;
    const field = fieldFor(J), img = fc.createImageData(RP, RP), d = img.data, f = field.data;
    const level = 128 - (extra / 2) * slopeOf(J);                                  // wider layer: lower level
    for (let i = 0; i < d.length; i += 4) {
      const a = Math.max(0, Math.min(255, (f[i + 3] - level) * 40 + 128));        // ~1.5px anti-aliased edge
      d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]; d[i + 3] = a;
    }
    fc.setTransform(1, 0, 0, 1, 0, 0); fc.putImageData(img, 0, 0);
    // Keep only what the rounding adds (the filled corner); everywhere else this layer's plain strokes already match
    sc.setTransform(res, 0, 0, res, -x0 * res, -y0 * res); sc.clearRect(x0, y0, REG, REG);
    sc.strokeStyle = "#000"; sc.lineCap = "round"; sc.lineJoin = "round";
    for (const { pts, w } of roads) for (let i = 0; i < pts.length - 1; i++) {
      if (Math.abs(pts[i].x - J.x) > REG || Math.abs(pts[i].y - J.y) > REG) continue;
      sc.lineWidth = Math.max(2, w[i] * scale + extra); sc.beginPath(); sc.moveTo(pts[i].x, pts[i].y); sc.lineTo(pts[i + 1].x, pts[i + 1].y); sc.stroke();
    }
    fc.globalCompositeOperation = "destination-out"; fc.drawImage(strokes, 0, 0); fc.globalCompositeOperation = "source-over";
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(soft, Math.round(x0 * res), Math.round((y0 + dy) * res)); c.restore();
  };
  // One layer = a chain of short strokes along EVERY route, so where routes meet the layers merge
  // into one surface with no bank line between them. scale/extra shape the layer, dy sinks it.
  const layer = (color, scale, extra, dy = 0, skip = 0, rgb = null) => {
    c.strokeStyle = color; c.lineCap = "round"; c.lineJoin = "round";
    for (const { pts, w } of roads) {
      for (let i = 0; i < pts.length - 1; i++) {
        if (skip && rand() < skip) continue;                        // patchy layers leave gaps
        c.lineWidth = Math.max(2, w[i] * scale + extra + (skip ? (rand() - 0.5) * 8 : 0));
        c.beginPath(); c.moveTo(pts[i].x, pts[i].y + dy); c.lineTo(pts[i + 1].x, pts[i + 1].y + dy); c.stroke();
      }
    }
    if (rgb) for (const J of junctions) roundJunction(J, rgb, scale, extra, dy);
  };
  layer("rgba(190,235,120,0.2)", 1, 10, 4, 0.45);                // faint, broken patches of lit grass along the lower lip
  layer("#5d4037", 1, ROAD_BANK, 0, 0, [93, 64, 55]);            // earthen banks
  layer("#7a5230", 1, 0, 0, 0, [122, 82, 48]);                   // shaded base
  layer("#a1703f", 1, -6, 5, 0, [161, 112, 63]);                 // surface, leaving a shadow band along the upper bank
  layer("#b8864f", 1, -20, 6, 0, [184, 134, 79]);                // worn centre

  // Inside the rounded corner of a junction? (edge details follow the strokes, so they must stay out of the fillet)
  const inFillet = (q) => {
    for (const J of junctions) {
      if (Math.abs(q.x - J.x) > REG / 2 - 2 || Math.abs(q.y - J.y) > REG / 2 - 2) continue;
      const f = fields.get(J); if (!f) continue;
      const px = Math.round((q.x - (J.x - REG / 2)) * res), py = Math.round((q.y - (J.y - REG / 2)) * res);
      // Edge details sit just outside their own road's stroke, where the field reads a little under 128 on a
      // plain stretch; well above 128 means the rounded surface has swallowed this spot
      if (f.data[(py * RP + px) * 4 + 3] >= 128 + 4 * slopeOf(J)) return true;
    }
    return false;
  };
  const edgeOk = (k, q) => !onOtherRoad(k, q) && !inFillet(q);
  roads.forEach(({ pts, w }, k) => {
    // Rough the edges: lumps of earth bulging out, grass creeping in, so the outline is ragged
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i], half = w[i] / 2;
      if (rand() < 0.45) {
        const side = rand() < 0.5 ? 1 : -1, o = side * (half + 1 + rand() * (ROAD_RAGGED - 6));
        const q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
        if (edgeOk(k, q)) ellipse(c, q.x, q.y, 3 + rand() * 3, 2 + rand() * 3, rand() < 0.5 ? "#5d4037" : "#7a5230");
      }
      if (rand() < 0.4) {
        const side = rand() < 0.5 ? 1 : -1, o = side * (half + 2 - rand() * 6);
        const q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
        if (edgeOk(k, q)) ellipse(c, q.x, q.y, 3 + rand() * 4, 2 + rand() * 2.5, rand() < 0.5 ? "#4f8a2c" : "#6fae3e");
      }
    }
    // Surface texture: dark blotches, pebbles, wheel-worn patches and grass tufts along the edges
    const verge = patchyField(rand, pts.length);
    for (const [i, p] of pts.entries()) {
      const half = w[i] / 2;
      if (rand() < 0.4) {
        const o = (rand() - 0.5) * (w[i] - 10);
        ellipse(c, p.x + p.nx * o, p.y + p.ny * o + 3, 3 + rand() * 5, 2 + rand() * 3, `rgba(80,50,30,${0.08 + rand() * 0.1})`);
      }
      if (rand() < 0.15) {
        const o = (rand() - 0.5) * (w[i] - 12);
        { const pr = 0.9 + rand() * 1.1; rockShape(c, p.x + p.nx * o, p.y + p.ny * o + 3, pr, pr * (0.55 + rand() * 0.5), rand, rand() < 0.5 ? "#8d8d8d" : "#c2a98a", null); }
      }
      if (rand() < 0.08) {
        const o = (rand() - 0.5) * (w[i] - 16);
        ellipse(c, p.x + p.nx * o, p.y + p.ny * o + 3, 5 + rand() * 6, 2 + rand() * 2, "rgba(255,230,180,0.12)");
      }
      if (rand() < 0.03 + 1.0 * verge[i]) {                                  // grass tufts along the verge, bunched in clumps
        const o = (rand() < 0.5 ? 1 : -1) * (half + 2 + rand() * 6);
        const q = { x: p.x + p.nx * o, y: p.y + p.ny * o }, h = 4 + rand() * 4, shade = rand() < 0.5 ? "#2f6b1f" : "#3e7f2a";
        if (edgeOk(k, q)) for (let kk = -1; kk <= 1; kk++) line(c, q.x, q.y, q.x + kk * (2.5 + rand()), q.y - h - rand() * 3, shade, 1.5);
      }
      if (rand() < 0.1) {                                                    // the odd broad-leaved weed or small flower
        const o = (rand() < 0.5 ? 1 : -1) * (half + 4 + rand() * 6);
        const q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
        if (edgeOk(k, q)) {
          if (rand() < 0.6) { for (let kk = 0; kk < 3; kk++) { const a = -Math.PI / 2 + (kk - 1) * 0.7; ellipse(c, q.x + Math.cos(a) * 3, q.y + Math.sin(a) * 3, 2.6, 1.4, "#4f8a2c", "rgba(30,70,20,0.35)", 0.5); } }
          else { line(c, q.x, q.y, q.x, q.y - 6, "#4f8a2c", 1); circle(c, q.x, q.y - 7, 1.6, ["#f8bbd0", "#fff59d", "#e1bee7", "#ffffff"][Math.floor(rand() * 4)]); }
        }
      }
    }
    // A rough, bumpy surface: wheel ruts, mounds, half-buried stones, potholes, cracks and dried clods
    const inside = (i, frac) => { const o = (rand() - 0.5) * 2 * frac * (w[i] / 2 - 9); const p = pts[i]; return { x: p.x + p.nx * o, y: p.y + p.ny * o, o }; };
    for (const side of [-1, 1]) {                                                          // two wavering ruts worn along the road
      let on = false; c.lineCap = "round"; c.lineJoin = "round";
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], o = side * (w[i] * 0.2 + Math.sin(i * 0.11 + side) * 3 + Math.sin(i * 0.37) * 1.2), q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
        if (onOtherRoad(k, q) || (i % 40 > 30 && rand() < 0.3)) { on = false; continue; }   // ruts fade in and out, and stop at junctions
        if (on) { const a = pts[i - 1], oa = side * (w[i - 1] * 0.2 + Math.sin((i - 1) * 0.11 + side) * 3 + Math.sin((i - 1) * 0.37) * 1.2), qa = { x: a.x + a.nx * oa, y: a.y + a.ny * oa };
          line(c, qa.x, qa.y + 1.2, q.x, q.y + 1.2, "rgba(255,225,180,0.07)", 2.4); line(c, qa.x, qa.y, q.x, q.y, "rgba(50,28,14,0.09)", 3); }
        on = true;
      }
    }
    for (let i = 0; i < pts.length; i++) {
      const r0 = rand();
      if (r0 < 0.12) {                                                                     // a mound of packed earth: lit on the upper left, shaded below
        const q = inside(i, 0.95), rx = 2.5 + rand() * 2.5, ry = rx * (0.5 + rand() * 0.25);
        if (!onOtherRoad(k, q)) { ellipse(c, q.x + 0.8, q.y + 1.2, rx, ry, "rgba(45,24,10,0.45)"); ellipse(c, q.x, q.y, rx, ry, "rgba(190,140,88,0.75)"); ellipse(c, q.x - rx * 0.25, q.y - ry * 0.3, rx * 0.55, ry * 0.45, "rgba(255,230,185,0.45)"); }
      } else if (r0 < 0.2) {                                                              // a stone half-sunk in the dirt, never the same shape twice
        const q = inside(i, 0.95), rr = 1.2 + rand() * 1.3, ry = rr * (0.55 + rand() * 0.5);
        if (!onOtherRoad(k, q)) {
          rockShape(c, q.x + 0.7, q.y + 1, rr * 1.15, ry * 1.15, rand, "rgba(40,24,12,0.38)");
          rockShape(c, q.x, q.y, rr, ry, rand, ["#9b9488", "#8a8378", "#aaa194", "#7c766c", "#a39a8a"][Math.floor(rand() * 5)], "rgba(40,30,22,0.5)");
          rockShape(c, q.x - rr * 0.28, q.y - ry * 0.28, rr * 0.4, ry * 0.3, rand, "rgba(255,255,255,0.3)");
        }
      } else if (r0 < 0.215) {                                                            // a pothole: dark inside, a lit lower lip
        const q = inside(i, 0.8), rx = 3.5 + rand() * 4, ry = rx * 0.6;
        if (!onOtherRoad(k, q)) { ellipse(c, q.x, q.y + 1.2, rx + 0.8, ry + 0.8, "rgba(255,225,180,0.28)"); ellipse(c, q.x, q.y, rx, ry, "rgba(45,26,12,0.55)"); ellipse(c, q.x + 0.5, q.y + 0.6, rx * 0.6, ry * 0.55, "rgba(30,16,8,0.4)"); }
      } else if (r0 < 0.36) {                                                               // a crack in the dried earth, forking at the end
        const q = inside(i, 0.85); if (onOtherRoad(k, q)) continue;
        let x = q.x, y = q.y, a = rand() * 6.28; c.strokeStyle = "rgba(50,30,16,0.45)"; c.lineWidth = 0.9; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y);
        for (let m = 0; m < 4; m++) { a += (rand() - 0.5) * 1.2; x += Math.cos(a) * (2.5 + rand() * 3); y += Math.sin(a) * (2.5 + rand() * 3); c.lineTo(x, y); }
        c.stroke(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + 0.8) * 3, y + Math.sin(a + 0.8) * 3); c.stroke();
      } else if (r0 < 0.46) {                                                               // loose gravel and dried clods
        const q = inside(i, 1);
        if (!onOtherRoad(k, q)) for (let m = 0; m < 2 + Math.floor(rand() * 3); m++) { const gr = 0.6 + rand() * 1.0; rockShape(c, q.x + (rand() - 0.5) * 9, q.y + (rand() - 0.5) * 5, gr, gr * (0.6 + rand() * 0.5), rand, rand() < 0.5 ? "rgba(120,96,70,0.85)" : "rgba(205,185,150,0.8)", null); }
      } else if (r0 < 0.62) {                                                              // fallen leaves, singly or in a little drift
        const q = inside(i, 0.95);
        if (!onOtherRoad(k, q)) for (let m = 0, n = 1 + Math.floor(rand() * 3); m < n; m++) {
          const lx = q.x + (rand() - 0.5) * 9, ly = q.y + (rand() - 0.5) * 5, len = 3 + rand() * 2.6, wd = len * (0.38 + rand() * 0.14), a = rand() * 6.28, ca = Math.cos(a), sa = Math.sin(a);
          const tone = ["#a65b2a", "#c8873a", "#8a6a2a", "#7a8a3a", "#b5482a", "#d2a04a", "#6f5a2a"][Math.floor(rand() * 7)];
          const at = (u, v) => [lx + u * ca - v * sa, ly + (u * sa + v * ca) * 0.7];                    // leaf coordinates to the ground, foreshortened
          poly(c, [at(-len, 0), at(-len * 0.3, -wd), at(len * 0.5, -wd * 0.8), at(len, 0), at(len * 0.5, wd * 0.8), at(-len * 0.3, wd)], tone, "rgba(50,28,12,0.4)", 0.5);
          const e0 = at(-len, 0), e1 = at(len * 0.85, 0); line(c, e0[0], e0[1], e1[0], e1[1], "rgba(50,28,12,0.45)", 0.6);   // the midrib
        }
      }
    }
  });
}

// A rock of random shape: 4 to 8 corners at uneven distances, stretched and turned any way
function rockShape(c, x, y, rx, ry, rand, fill, stroke, lw = 0.6) {
  const n = 4 + Math.floor(rand() * 5), rot = rand() * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * (Math.PI * 1.1 / n), k = 0.68 + rand() * 0.5, px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k;
    pts.push([x + px * cr - py * sr, y + px * sr + py * cr]);
  }
  poly(c, pts, fill, stroke, lw);
  return pts;
}

function strokePoly(c, pts, width, color) {
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = color; c.lineWidth = width;
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}

// A stream whose width changes along its length: muddy banks, deep water, a paler current,
// a sunlit centre, with pebbles, reeds and lily pads along the way.
// A small still pond: an irregular blob of water with a damp bank, lily pads, reeds and pebbles
export function pondOutline(p, scale = 1, extra = 0) {
  const n = p.wobble.length, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = p.wobble[i];
    pts.push([p.x + Math.cos(a) * (p.rx * k * scale + extra), p.y + Math.sin(a) * (p.ry * k * scale + extra)]);
  }
  return pts;
}
function blob(c, pts, fill) {                                           // closed smooth curve through the midpoints
  c.fillStyle = fill; c.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (i === 0) c.moveTo((pts[n - 1][0] + a[0]) / 2, (pts[n - 1][1] + a[1]) / 2);
    c.quadraticCurveTo(a[0], a[1], mx, my);
  }
  c.closePath(); c.fill();
}
function drawPond(c, p) {
  const rand = rng(p.seed);
  blob(c, pondOutline(p, 1, 7), "rgba(60,90,35,0.55)");                // damp bank
  blob(c, pondOutline(p, 1, 2), "rgba(92,74,51,0.75)");                 // mud edge, thin and soft
  blob(c, pondOutline(p, 1, 0), "#2f6a93");                             // deep water
  const g = c.createRadialGradient(p.x - p.rx * 0.2, p.y - p.ry * 0.3, 1, p.x, p.y, p.rx);
  g.addColorStop(0, "rgba(140,200,235,0.6)"); g.addColorStop(0.6, "rgba(74,147,196,0.5)"); g.addColorStop(1, "rgba(47,106,147,0)");
  blob(c, pondOutline(p, 0.85, 0), g);                                  // sunlit shallows
  for (let i = 0; i < 3; i++) {                                         // lily pads, one with a flower
    const a = rand() * Math.PI * 2, r = rand() * 0.55;
    const lx = p.x + Math.cos(a) * p.rx * r, ly = p.y + Math.sin(a) * p.ry * r, lr = 4.5 + rand() * 3.5;
    ellipse(c, lx, ly, lr, lr * 0.62, "#5faa4a", "rgba(50,110,40,0.5)", 0.7);                         // foreshortened like everything on the ground
    line(c, lx, ly, lx + lr, ly - lr * 0.25, "#3c7a2a", 1);
    if (i === 0) { for (let k = 0; k < 5; k++) { const fa = k * 1.26; ellipse(c, lx + Math.cos(fa) * 1.8, ly - 1 + Math.sin(fa) * 1.2, 1.6, 0.9, "#f8bbd0"); } circle(c, lx, ly - 1, 0.9, "#ffeb3b"); }
  }
  for (let i = 0; i < 5; i++) {                                         // reeds around the edge
    const a = rand() * Math.PI * 2, rx = p.x + Math.cos(a) * (p.rx + 4), ry = p.y + Math.sin(a) * (p.ry + 4);
    for (let k = -1; k <= 1; k++) line(c, rx, ry, rx + k * 2.5, ry - 9 - rand() * 5, "#4f7f2a", 1.5);
    if (rand() < 0.6) circle(c, rx, ry - 11, 1.2, "#6d4c41");
  }
  { // tufts and weeds crowding the bank all the way round, a few reeds standing in the shallows
    const edge = pondOutline(p, 1, 0), n = edge.length, clumps = Array.from({ length: 2 + Math.floor(rand() * 4) }, () => rand() * n), count = Math.round((p.rx + p.ry) * 0.55 * Math.min(1, (p.rx + p.ry) / 180));   // small ponds get far fewer
    for (let i = 0; i < count; i++) {
      const f = ((rand() < 0.8 ? clumps[Math.floor(rand() * clumps.length)] + (rand() + rand() - 1) * n * 0.07 : rand() * n) % n + n) % n, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, t = f - Math.floor(f);
      const ex = edge[i0][0] + (edge[i1][0] - edge[i0][0]) * t, ey = edge[i0][1] + (edge[i1][1] - edge[i0][1]) * t;
      const dx = ex - p.x, dy = ey - p.y, dl = Math.hypot(dx, dy) || 1, out = 2 + rand() * 11;
      const x = ex + (dx / dl) * out, y = ey + (dy / dl) * out * 0.8 + (rand() - 0.5) * 3, v = rand();
      if (v < 0.5) drawTuft(c, x, y, 0.9 + rand() * 0.4, Math.floor(rand() * TUFT_KINDS), rand);
      else if (v < 0.9) drawWeed(c, x, y, 0.9 + rand() * 0.4, Math.floor(rand() * WEED_KINDS), rand);
      else { const h = 12 + rand() * 6, lean = (rand() - 0.5) * 4; line(c, x, y, x + lean, y - h, "#5a8a30", 1.3); line(c, x + lean, y - h, x + lean, y - h - 4, "#6d4c41", 2.2); }   // a cattail
    }
  }
  for (let i = 0; i < 6; i++) {                                         // pebbles on the bank
    const a = rand() * Math.PI * 2, d = 2 + rand() * 5;
    circle(c, p.x + Math.cos(a) * (p.rx + d), p.y + Math.sin(a) * (p.ry + d), 1 + rand() * 1.5, rand() < 0.5 ? "#9e9e9e" : "#c2b280");
  }
}

// ---------- Small plants (shared by the river banks and the open grass) ----------
const GREENS = ["#4f8a34", "#5f9e3d", "#3e7a2c", "#6aa845", "#487a30"];
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
export const TUFT_KINDS = 4, WEED_KINDS = 4;
// Grass tufts: 0 a fan of curved blades, 1 a seeding grass with tiny golden heads, 2 a low dense clump, 3 a clover patch
function drawTuft(c, x, y, s, v, r) {
  const col = pick(GREENS, r);
  if (v === 0) {
    const blades = 4 + Math.floor(r() * 4), h = (5 + r() * 6) * s;
    for (let q = 0; q < blades; q++) line(c, x, y, x + (q - (blades - 1) / 2) * (1.4 + r() * 0.8) * s + (r() - 0.5) * 2, y - h * (0.65 + r() * 0.5), col, 1.2);
  } else if (v === 1) {
    const n = 3 + Math.floor(r() * 3);
    for (let q = 0; q < n; q++) { const lean = (q - (n - 1) / 2) * 2.4 * s + (r() - 0.5) * 2, h = (9 + r() * 6) * s; line(c, x, y, x + lean, y - h, "#8aa84a", 1.1); ellipse(c, x + lean, y - h - 1.5 * s, 1 * s, 2.2 * s, "#d8b84a"); }
  } else if (v === 2) {
    const n = 8 + Math.floor(r() * 6);
    for (let q = 0; q < n; q++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.2, h = (3 + r() * 4) * s; line(c, x + (r() - 0.5) * 5 * s, y, x + Math.cos(a) * h * 1.2, y + Math.sin(a) * h, pick(GREENS, r), 1.1); }
  } else {
    const n = 3 + Math.floor(r() * 4);
    for (let q = 0; q < n; q++) {
      const px = x + (r() - 0.5) * 12 * s, py = y + (r() - 0.5) * 5 * s;
      line(c, px, py, px, py - 3 * s, "#4f8a34", 0.9);
      for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * 0.9; circle(c, px + Math.cos(a) * 1.7 * s, py - 3 * s + Math.sin(a) * 1.7 * s, 1.5 * s, k === 1 ? "#6aa845" : "#58a03c"); }
    }
  }
}
// Weeds: 0 tall and leafy, sometimes flowering; 1 a fern with arching fronds; 2 a thistle with a purple head; 3 a dandelion with its seed puff
function drawWeed(c, x, y, s, v, r) {
  const col = pick(GREENS, r);
  if (v === 0) {
    const h = (10 + r() * 9) * s, lean = (r() - 0.5) * 6;
    line(c, x, y, x + lean, y - h, col, 1.4);
    for (let q = 1; q <= 3; q++) { const t = q / 4, lx = x + lean * t, ly = y - h * t, d = (q % 2 ? 1 : -1) * (3 + r() * 2) * s; line(c, lx, ly, lx + d, ly - (3 + r() * 2) * s, col, 1.2); }
    if (r() < 0.3) circle(c, x + lean, y - h, 1.3 * s, pick(["#ffeb3b", "#fff", "#f48fb1", "#ce93d8"], r));
  } else if (v === 1) {
    const n = 5 + Math.floor(r() * 3);
    for (let q = 0; q < n; q++) {
      const side = q % 2 ? 1 : -1, len = (9 + r() * 6) * s, a = side * (0.5 + (q >> 1) * 0.28 + r() * 0.15);
      const ex = x + Math.sin(a) * len, ey = y - Math.cos(a) * len * 0.8 + len * 0.18 * Math.abs(Math.sin(a));
      c.strokeStyle = "#3f7a33"; c.lineWidth = 1.2; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(a) * len * 0.45, y - len * 0.85, ex, ey); c.stroke();
      for (let k = 1; k <= 4; k++) { const t = k / 5, bx = x + (ex - x) * t, by = y + (ey - y) * t - Math.sin(t * 2.2) * len * 0.3; line(c, bx, by, bx + side * 1.8 * s, by - 1.6 * s, "#4f8f3d", 1); line(c, bx, by, bx - side * 1.4 * s, by - 1.2 * s, "#4f8f3d", 1); }
    }
  } else if (v === 2) {
    const h = (11 + r() * 7) * s;
    line(c, x, y, x, y - h, "#5a8a3a", 1.5);
    for (const d of [-1, 1]) { poly(c, [[x, y - h * 0.3], [x + d * 5 * s, y - h * 0.42], [x + d * 2.6 * s, y - h * 0.2]], "#6f9a4a"); poly(c, [[x, y - h * 0.55], [x + d * 4 * s, y - h * 0.7], [x + d * 2 * s, y - h * 0.46]], "#6f9a4a"); }
    circle(c, x, y - h - 1 * s, 2.6 * s, "#8e6bb0"); for (let k = -2; k <= 2; k++) line(c, x + k * 0.9 * s, y - h - 2 * s, x + k * 1.4 * s, y - h - 5 * s, "#b995d6", 1);
    ellipse(c, x, y - h + 1.5 * s, 2.8 * s, 1.6 * s, "#5f9e3d");
  } else {
    const h = (8 + r() * 5) * s, lean = (r() - 0.5) * 3;
    for (let q = -1; q <= 1; q++) poly(c, [[x, y], [x + q * 5 * s - 1, y - 3 * s], [x + q * 5 * s + 1, y - 2.5 * s]], "#5f9e3d");
    line(c, x, y, x + lean, y - h, "#6aa845", 1.1);
    if (r() < 0.55) { circle(c, x + lean, y - h, 2.3 * s, "#ffd600"); for (let k = 0; k < 8; k++) { const a = k * 0.785; line(c, x + lean, y - h, x + lean + Math.cos(a) * 3.3 * s, y - h + Math.sin(a) * 3.3 * s, "#ffeb3b", 1); } }
    else { circle(c, x + lean, y - h, 2.8 * s, "rgba(255,255,255,0.75)"); for (let k = 0; k < 9; k++) { const a = k * 0.7; line(c, x + lean, y - h, x + lean + Math.cos(a) * 3.8 * s, y - h + Math.sin(a) * 3.8 * s, "rgba(255,255,255,0.8)", 0.8); } }
  }
}

// How crowded plants are along a stretch of bank or verge: bunched into clumps with bare gaps between, never even.
// Returns one 0..1 density per sample.
function patchyField(rand, len) {
  const ph = [rand() * 6.3, rand() * 6.3, rand() * 6.3], f = [0.07 + rand() * 0.05, 0.19 + rand() * 0.1, 0.47 + rand() * 0.2];
  return Array.from({ length: len }, (_, i) => {
    const v = (Math.sin(i * f[0] + ph[0]) + Math.sin(i * f[1] + ph[1]) * 0.7 + Math.sin(i * f[2] + ph[2]) * 0.4) / 2.1;
    const t = Math.max(0, Math.min(1, (v + 0.1) / 0.7));
    return t * t * (3 - 2 * t);
  });
}

function drawRiver(c, r, rand, pass) {
  const pts = r.points;
  // Smooth sideways normals at every point (average of the two neighbouring segments)
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
  // Each bank wanders on its own: smooth, uneven noise so the water's edge bulges and pinches like real
  // ground (coves, small points, a muddy shelf that comes and goes), never a clean ribbon
  const nz = (seed) => {
    const r2 = rng(seed), f = [0.5 + r2() * 0.4, 1.3 + r2() * 0.8, 2.6 + r2() * 1.2], ph = f.map(() => r2() * 6.3), amp = 0.6 + r2() * 0.7;
    let v = pts.map((_, i) => (Math.sin(i * f[0] + ph[0]) * 0.55 + Math.sin(i * f[1] + ph[1]) * 0.33 + Math.sin(i * f[2] + ph[2]) * 0.17 + (r2() - 0.5) * 0.9) * amp);
    for (let pass = 0; pass < 4; pass++) v = v.map((x, i) => (v[Math.max(0, i - 1)] + 2 * x + v[Math.min(v.length - 1, i + 1)]) / 4);   // smoothed, so the edge flows with no kinks
    return v.map((x) => x * 1.5);
  };
  const sd = Math.floor(pts[0].x * 3 + pts[0].y * 5) + 13;
  const nzL = nz(sd), nzR = nz(sd + 1), mudL = nz(sd + 2), mudR = nz(sd + 3);
  // Fill the band between the two banks, scaled to a fraction of the local width, shifted sideways if asked
  const band = (scale, color, extra = 0, shift = 0, mud = 0) => {
    const sc = (i) => (typeof scale === "function" ? scale(i) : scale);
    const offL = (i) => pts[i].w * sc(i) / 2 + extra + shift + nzL[i] * 5 * Math.min(1, sc(i) + 0.3) + (mud ? mud * (1 + mudL[i]) : 0);
    const offR = (i) => -(pts[i].w * sc(i) / 2 + extra - shift + nzR[i] * 5 * Math.min(1, sc(i) + 0.3) + (mud ? mud * (1 + mudR[i]) : 0));
    c.fillStyle = color;
    c.beginPath();
    pts.forEach((p, i) => { const o = offL(i); const x = p.x + normals[i].x * o, y = p.y + normals[i].y * o; i ? c.lineTo(x, y) : c.moveTo(x, y); });
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], o = offR(i); c.lineTo(p.x + normals[i].x * o, p.y + normals[i].y * o); }
    c.closePath();
    c.fill();
  };
  if (pass === 0) {
    band(1, "rgba(60,90,35,0.5)", 6, 0, 4.5);                           // damp bank, wider in places
    band(1, "rgba(70,58,38,0.7)", 3, 0, 2.4);                           // wet soil
    band(1, "#5c4a33", 1.5, 0, 2);                                      // muddy bank, a shelf that comes and goes
    for (let i = 0; i < pts.length - 1; i++) {                       // muddy slumps, sandy spits and wet stones strewn along both banks
      for (const side of [1, -1]) {
        if (rand() < 0.45) continue;
        const p = pts[i], n = normals[i], o = side * (p.w / 2 + 1 + rand() * 7), x = p.x + n.x * o, y = p.y + n.y * o, k = rand();
        if (k < 0.4) ellipse(c, x, y, 3 + rand() * 6, 2 + rand() * 3, "rgba(80,62,40,0.55)");
        else if (k < 0.7) ellipse(c, x, y, 2.5 + rand() * 5, 1.5 + rand() * 2.5, "rgba(196,176,128,0.5)");
        else ellipse(c, x, y, 1.8 + rand() * 2.4, 1.3 + rand() * 1.6, ["#8e8a82", "#74706a", "#a29d92"][Math.floor(rand() * 3)], "rgba(40,36,30,0.5)", 0.6);
      }
    }
    return;
  }
  band(1, "rgba(25,45,40,0.4)", 1.8, 0, 0.8);                         // a dark wet rim hugging the water's edge
  band(1, "#2f6a93");                                                 // deep water
  // The shallows lighten toward the middle in soft, wavering layers rather than hard stripes
  const ph = rand() * 6;
  band((i) => 0.86 + Math.sin(i * 0.7 + ph) * 0.05, "rgba(74,147,196,0.35)", 0, 1);
  band((i) => 0.68 + Math.sin(i * 0.9 + ph + 1) * 0.07, "rgba(74,147,196,0.45)", 0, 2);
  band((i) => 0.46 + Math.sin(i * 1.1 + ph + 2) * 0.08, "rgba(120,185,225,0.35)", 0, 2.5);
  band((i) => 0.22 + Math.sin(i * 1.4 + ph + 3) * 0.06, "rgba(160,210,240,0.35)", 0, 2.5);
  // Ripples: short pale streaks along the flow, and a few darker eddies near the banks
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = normals[i], tx = (b.x - a.x), ty = (b.y - a.y);
    for (let k = 0; k < 3; k++) {
      if (rand() < 0.55) continue;
      const t = rand(), o = (rand() - 0.5) * a.w * 0.8, x = a.x + tx * t + n.x * o, y = a.y + ty * t + n.y * o;
      const len = 0.08 + rand() * 0.1;
      line(c, x - tx * len, y - ty * len, x + tx * len, y + ty * len, `rgba(200,230,250,${0.15 + rand() * 0.2})`, 1 + rand());
    }
    if (rand() < 0.18) {                                              // eddy
      const side = rand() < 0.5 ? 1 : -1, o = side * a.w * (0.25 + rand() * 0.12);
      c.strokeStyle = "rgba(30,70,110,0.25)"; c.lineWidth = 1.2; c.beginPath(); c.arc(a.x + n.x * o, a.y + n.y * o, 2 + rand() * 2.5, 0, Math.PI * 1.5); c.stroke();
    }
  }
  // Details along the banks, following the local width
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = normals[i];
    for (let t = 0; t < 1; t += 0.15) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, w = a.w + (b.w - a.w) * t;
      if (rand() < 0.3) {                                             // pebbles
        const side = rand() < 0.5 ? 1 : -1, o = side * (w / 2 + 2 + rand() * 4);
        circle(c, x + n.x * o, y + n.y * o, 1 + rand() * 1.5, rand() < 0.5 ? "#9e9e9e" : "#c2b280");
      }
      if (rand() < 0.12) {                                            // reeds, thicker where the water is wide and slow
        const side = rand() < 0.5 ? 1 : -1, o = side * (w / 2 + 5 + rand() * 3);
        const rx = x + n.x * o, ry = y + n.y * o;
        for (let k = -1; k <= 1; k++) line(c, rx, ry, rx + k * 2.5, ry - 9 - rand() * 5, "#4f7f2a", 1.5);
        circle(c, rx, ry - 11, 1.2, "#6d4c41");
      }
      if (w > 22 && rand() < 0.1) {                                   // lily pads only on the wide pools
        const o = (rand() - 0.5) * w * 0.7;
        { const lr = 4 + rand() * 3; ellipse(c, x + n.x * o, y + n.y * o, lr, lr * 0.62, "#5faa4a", "rgba(50,110,40,0.5)", 0.7); }
      }
      if (w < 18 && rand() < 0.12) {                                  // white water in the narrow runs
        const o = (rand() - 0.5) * w * 0.6;
        line(c, x + n.x * o - 3, y + n.y * o, x + n.x * o + 3, y + n.y * o, "rgba(255,255,255,0.55)", 1.5);
      }
    }
  }
  // Tufts and weeds crowding the banks: grass clumps, tall weeds, ferns, thistles and dandelions, right at the water's edge
  const crowdL = patchyField(rand, pts.length), crowdR = patchyField(rand, pts.length);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], n = normals[i];
    for (const side of [1, -1]) {
      const nzv = side > 0 ? nzL[i] : nzR[i], crowd = side > 0 ? crowdL[i] : crowdR[i];
      for (let k = 0; k < 2; k++) {
        if (rand() > 0.06 + 1.3 * crowd) continue;
        const o = side * (p.w / 2 + nzv * 5 + 2 + rand() * 9), x = p.x + n.x * o + (rand() - 0.5) * 4, y = p.y + n.y * o + (rand() - 0.5) * 4, v = rand();
        if (v < 0.55) drawTuft(c, x, y, 1, Math.floor(rand() * TUFT_KINDS), rand);
        else if (v < 0.88) drawWeed(c, x, y, 1, Math.floor(rand() * WEED_KINDS), rand);
        else { const h = 12 + rand() * 6, lean = (rand() - 0.5) * 4; line(c, x, y, x + lean, y - h, "#5a8a30", 1.3); line(c, x + lean, y - h, x + lean, y - h - 4, "#6d4c41", 2.2); }   // a cattail
      }
    }
  }
}

// A wooden plank bridge carrying the road over a river
function drawBridge(c, b) {
  // The deck is a ribbon laid along the road's own centre line, a little wider than the road (its bank and
  // ragged edge included), so its sides follow the road's edges round any bend
  const r = rng(Math.floor(b.x * 7 + b.y * 13));
  const widthAt = (p) => {
    let best = null, bd = Infinity;
    for (const s of roadSamples) { const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2; if (d < bd) { bd = d; best = s; } }
    return roadReach(best ? best.w : ROAD_WIDTH) - 6;   // just past the road's bank (its ragged fringe can show)
  };
  // Plank edges every ~7px along the road; on a bend the inner side bunches up, so an edge is only kept
  // when both sides have moved forward (no plank ever crosses its neighbour)
  const edges = [];
  const n = Math.max(8, Math.round(b.span / 7));
  for (let i = 0; i <= n; i++) {
    // Left and right sides each run over their own stretch of road, so the ends come out slanted on a skew crossing
    const t = i / n, qL = pointAtArc(b.path, b.s1L + (b.s2L - b.s1L) * t), qR = pointAtArc(b.path, b.s1R + (b.s2R - b.s1R) * t);
    const q = pointAtArc(b.path, (b.s1L + (b.s2L - b.s1L) * t + b.s1R + (b.s2R - b.s1R) * t) / 2), hwL = widthAt(qL), hwR = widthAt(qR);
    const e = { q, L: [qL.x + qL.nx * hwL, qL.y + qL.ny * hwL], R: [qR.x - qR.nx * hwR, qR.y - qR.ny * hwR] };
    const last = edges[edges.length - 1];
    if (last && i < n) {
      const fwd = (a, bb) => (bb[0] - a[0]) * q.tx + (bb[1] - a[1]) * q.ty;
      if (fwd(last.L, e.L) < 3 || fwd(last.R, e.R) < 3) continue;
    }
    if (last && i === n && (((e.L[0] - last.L[0]) * q.tx + (e.L[1] - last.L[1]) * q.ty) < 3 || ((e.R[0] - last.R[0]) * q.tx + (e.R[1] - last.R[1]) * q.ty) < 3)) edges.pop();
    edges.push(e);
  }
  const lampRand = rng(Math.floor(b.x * 5 + b.y * 11) + 77); b.lamps = [];
  const left = edges.map((e) => e.L), right = edges.map((e) => e.R);
  const deck = [...left, ...right.slice().reverse()];
  // One weathered plank between two cross-lines (each [left, right]): its own shade, uneven corners, grain,
  // cracks, knots, stains, moss, nails; some planks are split, shortened, bleached, rotten or missing
  const mix = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  const TONES = ["#8d6e63", "#947668", "#86675c", "#9a7a6b", "#80625a", "#8f7064", "#a99383", "#b09d8c", "#6e554b", "#5f4a41", "#7b6a52", "#867560"];
  const jit = (pt, k) => [pt[0] + (r() - 0.5) * k, pt[1] + (r() - 0.5) * k];
  const wornPlank = (a, d, ramp) => {
    const roll = r();
    let aL = jit(a[0], 1.6), aR = jit(a[1], 1.6), dL = jit(d[0], 1.6), dR = jit(d[1], 1.6);
    if (roll < 0.04) { poly(c, [a[0], d[0], d[1], a[1]], "rgba(18,12,10,0.75)"); return; }                          // a missing plank: a dark gap
    if (roll < 0.13) { const cut = 0.45 + r() * 0.4, fromLeft = r() < 0.5; if (fromLeft) { aR = mix(aL, aR, cut); dR = mix(dL, dR, cut + (r() - 0.5) * 0.1); } else { aL = mix(aR, aL, cut); dL = mix(dR, dL, cut + (r() - 0.5) * 0.1); }
      const other = fromLeft ? [mix(a[0], a[1], cut), a[1], d[1], mix(d[0], d[1], cut)] : [a[0], mix(a[0], a[1], 1 - cut), mix(d[0], d[1], 1 - cut), d[0]];
      poly(c, other, "rgba(18,12,10,0.6)"); }                                                                        // a broken plank: only part of it is left
    const tone = TONES[Math.floor(r() * TONES.length)];
    poly(c, [aL, dL, dR, aR], tone, "rgba(40,26,22,0.6)", 0.8);
    const across = (t, u) => mix(mix(aL, dL, t), mix(aR, dR, t), u);
    for (let g = 0; g < 1 + Math.floor(r() * 3); g++) { const t = 0.15 + r() * 0.7, p0 = across(t, 0.05 + r() * 0.3), p1 = across(t, 0.55 + r() * 0.4); line(c, p0[0], p0[1], p1[0], p1[1], "rgba(62,39,35,0.25)", 0.8); }   // grain
    if (r() < 0.35) {                                                                                                // a crack, zigzagging across the plank
      let u = 0.1 + r() * 0.5, t = 0.2 + r() * 0.6, pt = across(t, u); c.strokeStyle = "rgba(20,12,10,0.7)"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(pt[0], pt[1]);
      for (let k = 0; k < 4; k++) { u += 0.12 + r() * 0.1; t += (r() - 0.5) * 0.25; pt = across(Math.min(0.95, Math.max(0.05, t)), Math.min(1, u)); c.lineTo(pt[0], pt[1]); } c.stroke(); }
    if (r() < 0.25) { const k = across(0.3 + r() * 0.4, 0.15 + r() * 0.7); circle(c, k[0], k[1], 1 + r() * 1.3, "rgba(45,28,22,0.6)"); }                  // a knot
    if (r() < 0.22) { const k = across(0.5, 0.2 + r() * 0.6); ellipse(c, k[0], k[1], 3 + r() * 5, 2 + r() * 3, "rgba(25,35,25,0.28)"); }                    // a damp, dark stain
    if (r() < 0.14) { const k = across(0.5, r() < 0.5 ? 0.1 : 0.9); ellipse(c, k[0], k[1], 2.5 + r() * 3, 1.6 + r() * 1.6, "rgba(90,140,60,0.5)"); }        // moss
    if (r() < 0.12) { const k = across(0.5, 0.2 + r() * 0.6); ellipse(c, k[0], k[1], 4 + r() * 5, 2 + r() * 2, "rgba(220,205,185,0.16)"); }              // sun-bleached patch
    for (const side of [0.08, 0.92]) if (r() < 0.8) { const k = across(0.5, side); circle(c, k[0], k[1], 0.7, r() < 0.2 ? "rgba(120,60,30,0.7)" : "rgba(40,30,28,0.7)"); }   // nails, some rusted
    if (r() < 0.1) { const k = across(r() < 0.5 ? 0.04 : 0.96, 0.1 + r() * 0.8); ellipse(c, k[0], k[1], 3 + r() * 3, 1.2, "rgba(20,12,10,0.45)"); }       // a chipped end
  };
  // Ramps: at each end the deck's own planks run on and slope down to the road, widening as they go, with
  // a shading that darkens toward the ground (no seam where they meet the level deck)
  for (const [e, dir] of [[edges[0], -1], [edges[edges.length - 1], 1]]) {
    const q = e.q, ax = q.tx * dir, ay = q.ty * dir, L = 34, flare = 9;
    const nL = [e.L[0] - e.R[0], e.L[1] - e.R[1]], nl = Math.hypot(nL[0], nL[1]) || 1, ux = nL[0] / nl, uy = nL[1] / nl;
    const far = (pt, sgn) => [pt[0] + ax * L + ux * flare * sgn, pt[1] + ay * L + uy * flare * sgn];
    const fL = far(e.L, 1), fR = far(e.R, -1);
    poly(c, [e.L, fL, fR, e.R], "#8d6e63");
    const planks = 8;
    for (let k = 0; k < planks; k++) {                                                      // planks bunch up toward the foot, as the slope foreshortens
      const t0 = 1 - Math.pow(1 - k / planks, 1.3), t1 = 1 - Math.pow(1 - (k + 1) / planks, 1.3);
      wornPlank([mix(e.L, fL, t0), mix(e.R, fR, t0)], [mix(e.L, fL, t1), mix(e.R, fR, t1)], true);
    }
    for (const [u, v] of [[e.L, fL], [e.R, fR]]) {                                           // worn side beams, uneven
      line(c, u[0], u[1], v[0], v[1], "#3e2723", 3);
      line(c, u[0], u[1], v[0], v[1], "#6d4c41", 1.2);
    }
    line(c, fL[0], fL[1], fR[0], fR[1], "rgba(40,26,22,0.7)", 1.6);                           // a crisp end where the last plank meets the road
    for (let k = 0; k < 6; k++) { const pt = mix(mix(e.L, fL, 0.8 + r() * 0.2), mix(e.R, fR, 0.8 + r() * 0.2), r()); circle(c, pt[0], pt[1], 0.9 + r() * 1.3, "rgba(139,111,85,0.9)"); }   // a little crisp dirt trodden onto the last planks
    for (let k = 0; k < 5; k++) { const pt = mix(fR, fL, r()), d = 2 + r() * 8; circle(c, pt[0] + ax * d, pt[1] + ay * d, 0.8 + r() * 1.1, "rgba(150,140,125,0.7)"); }   // a few pebbles
  }
  c.globalAlpha = 0.42; poly(c, deck.map(([x, y]) => [x + 3, y + 7]), "#0a1a14"); c.globalAlpha = 1;   // a clear shadow thrown onto the water
  poly(c, deck, "#8d6e63");                                                                 // base
  for (let i = 0; i < edges.length - 1; i++) wornPlank([edges[i].L, edges[i].R], [edges[i + 1].L, edges[i + 1].R], false);
  for (let k = 0; k < Math.round(b.span / 25); k++) { const e = edges[Math.floor(r() * edges.length)], pt = mix(e.L, e.R, 0.1 + r() * 0.8); ellipse(c, pt[0], pt[1], 4 + r() * 8, 3 + r() * 5, r() < 0.5 ? "rgba(20,28,22,0.2)" : "rgba(210,195,175,0.12)"); }   // big stains and bleached stretches across planks
  poly(c, deck, null, "#4e342e", 1.5);                                                      // deck outline
  for (const side of [left, right]) {                                                       // low rails on upright posts along each edge
    const RISE = 6;                                                                         // how high the rail stands above the deck, as seen from above
    c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = "rgba(30,18,14,0.35)"; c.lineWidth = 2.5; c.beginPath();               // the rail's shadow on the deck edge
    side.forEach(([x, y], i) => (i ? c.lineTo(x, y + 1) : c.moveTo(x, y + 1))); c.stroke();
    for (let i = 0; i < side.length; i += 3) {                                              // upright posts: a short shaft with a cap
      const [x, y] = side[i];
      if (lampRand() < 0.28) b.lamps.push({ x, y: y - RISE - 2.7, ph: lampRand() * 6.28 });   // a few post tips glow at night (drawn live, not baked in)
      line(c, x, y, x, y - RISE - 2, "#4e342e", 3.2);
      line(c, x - 0.6, y, x - 0.6, y - RISE - 2, "#6d4c41", 1.6);
      rect(c, x - 2.6, y - RISE - 4.2, 5.2, 3, "#8d6e63", "#3e2723", 0.7);
    }
    c.strokeStyle = "#3e2723"; c.lineWidth = 3.4; c.beginPath();                            // the rail itself, raised over the posts
    side.forEach(([x, y], i) => (i ? c.lineTo(x, y - RISE) : c.moveTo(x, y - RISE))); c.stroke();
    c.strokeStyle = "#7a5646"; c.lineWidth = 1.8; c.beginPath();
    side.forEach(([x, y], i) => (i ? c.lineTo(x, y - RISE - 0.6) : c.moveTo(x, y - RISE - 0.6))); c.stroke();
  }
}

// ---------- Scenery ----------
// Every function gets a size, a variant (0-2) and its own random generator, so no two pieces look alike.
export function drawDecoItem(c, d) {
  const s = d.s || 1;
  castShadow(c, d.x, d.y, d.type === "tree" ? 16 * s : d.type === "flower" || d.type === "mushroom" || d.type === "tuft" || d.type === "weed" ? 0 : 9 * s, d.type === "tree" ? 22 * s : 6);
  DRAW_DECO[d.type](c, d.x, d.y, s, d.variant || 0, rng(d.seed || 1));
}
// Age marks on a wall region: a hairline crack or two, a damp stain, a few chipped flecks and moss at the foot
function wearOut(c, r, regions) {
  for (const [x0, y0, w, h] of regions) {
    for (let n = 0; n < 2 + Math.floor(r() * 2); n++) {                                 // cracks
      let cx = x0 + w * (0.15 + r() * 0.7), cy = r() < 0.5 ? y0 : y0 + h;
      const dir = cy === y0 ? 1 : -1, len = h * (0.25 + r() * 0.3);
      c.strokeStyle = "rgba(0,0,0,0.28)"; c.lineWidth = 0.8; c.lineCap = "round"; c.beginPath(); c.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) { cx += (r() - 0.5) * 4; cy += dir * len / 4; c.lineTo(cx, cy); }
      c.stroke();
    }
    for (let n = 0; n < 3; n++) ellipse(c, x0 + w * (0.2 + r() * 0.6), y0 + h * (0.3 + r() * 0.6), w * (0.08 + r() * 0.14), h * (0.1 + r() * 0.18), "rgba(30,20,10,0.09)");   // damp stains
    for (let n = 0; n < 2; n++) ellipse(c, x0 + w * (0.1 + r() * 0.8), y0 + h * (0.55 + r() * 0.4), 1.5 + r() * 2.5, 4 + r() * 6, "rgba(40,30,20,0.07)");                 // rain streaks
    for (let n = 0; n < 6; n++) circle(c, x0 + w * r(), y0 + h * r(), 0.7 + r() * 0.6, "rgba(255,255,255,0.22)");                                                         // chipped flecks
    if (h > 12) for (let n = 0; n < 2; n++) ellipse(c, x0 + w * (0.1 + r() * 0.8), y0 + h - 1.5 - r() * 2, 2.5 + r() * 3, 1.2 + r() * 1.2, "rgba(90,140,60,0.4)");       // moss at the foot
  }
}
// Damage that piles up as monsters get through: each mark is its own self-contained item (its look is fixed by
// its index), so wear only ever adds marks, and the ones already there never move.
function battleWear(c, seed, regions, count) {
  const area = regions.reduce((a, [, , w, h]) => a + w * h, 0);
  for (let n = 0; n < count; n++) {
    const r = rng(seed * 31 + n * 977 + 5);
    let pick = r() * area, reg = regions[0];
    for (const g of regions) { pick -= g[2] * g[3]; if (pick <= 0) { reg = g; break; } }
    const [x0, y0, w, h] = reg, x = x0 + w * (0.06 + r() * 0.88), y = y0 + h * (0.06 + r() * 0.88);
    const kind = n % 6;
    if (kind === 0) {                                                                   // a deep crack
      let cx = x, cy = y; c.strokeStyle = "rgba(0,0,0,0.42)"; c.lineWidth = 1 + r() * 0.6; c.lineCap = "round"; c.beginPath(); c.moveTo(cx, cy);
      for (let i = 0; i < 5; i++) { cx += (r() - 0.5) * 5; cy += 2 + r() * 3; c.lineTo(cx, cy); }
      c.stroke();
    } else if (kind === 1) {                                                            // a scorch mark: soot with a dull glow at its heart
      ellipse(c, x, y, 2.5 + r() * 3.5, 2 + r() * 3, "rgba(20,14,10,0.3)"); ellipse(c, x, y + 0.5, 1.6 + r() * 2, 1.2 + r() * 1.6, "rgba(60,30,14,0.3)");
    } else if (kind === 2) {                                                            // a long dark streak down the wall
      c.strokeStyle = `rgba(40,30,20,${0.12 + r() * 0.14})`; c.lineWidth = 1.2 + r() * 2; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 3, Math.min(y0 + h, y + 6 + r() * 14)); c.stroke();
    } else if (kind === 3) {                                                            // plaster knocked off, dark stone beneath
      const pw = 2.5 + r() * 6, ph = 2 + r() * 5, pts = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; pts.push([x + Math.cos(a) * pw * (0.6 + r() * 0.6), y + Math.sin(a) * ph * (0.6 + r() * 0.6)]); }
      poly(c, pts, "rgba(70,56,44,0.58)", "rgba(30,22,16,0.4)", 0.5);
    } else if (kind === 4) {                                                            // a damp stain with creeping green
      ellipse(c, x, y, 3 + r() * 6, 2 + r() * 4, "rgba(30,20,10,0.12)"); if (r() < 0.6) ellipse(c, x + (r() - 0.5) * 4, y + 2, 1.5 + r() * 3, 1 + r() * 2, "rgba(80,125,50,0.35)");
    } else {                                                                            // chipped stone: bright flecks and a dark gouge
      for (let i = 0; i < 4; i++) circle(c, x + (r() - 0.5) * 6, y + (r() - 0.5) * 5, 0.6 + r() * 0.7, "rgba(255,255,255,0.28)");
      line(c, x - 2, y, x + 2 + r() * 3, y + r() * 3, "rgba(30,20,12,0.45)", 1.2);
    }
  }
}
function castleRegions(k) {
  const S = CASTLE_STYLES[k.style] || CASTLE_STYLES[0];
  return S.pagoda ? [[-38, -34, 76, 20], [-28, -60, 56, 10]]
    : S.palace ? [[-44, -36, 88, 40], [-18, -60, 36, 26]]
    : [[-44, -36, 88, 40], [-16, -70, 32, 36], [-52, -64, 24, 68], [28, -64, 24, 68]];
}
export function drawCastleAt(c, k, damage = true) {
  castShadow(c, k.x, k.y, 50 * k.scale, 90 * k.scale);
  c.save(); c.translate(k.x, k.y); c.scale(k.scale, k.scale);
  drawCastle(c, 0, 0, k.style);
  const r = rng(Math.floor(k.x * 13 + k.y * 7));
  const regions = castleRegions(k);
  wearOut(c, r, regions);                                                              // lightly weathered to begin with ...
  c.restore();
  if (damage) drawCastleDamage(c, k);
}
export function drawCastleDamage(c, k) {
  const lost = state.diff ? 1 - state.lives / (state.diff.lives || 20) : 0;              // ... then worse with every monster that gets through
  const count = Math.round(Math.max(0, Math.min(1, lost)) * 70);
  if (!count) return;
  c.save(); c.translate(k.x, k.y); c.scale(k.scale, k.scale);
  battleWear(c, Math.floor(k.x * 13 + k.y * 7), castleRegions(k), count);
  c.restore();
}

// A cherry tree's blossom colour, drawn from its random stream (the first draws, so it can be replayed
// from the tree's seed for the falling petals). Most are pink; some are white or the palest blush.
export function cherryTone(r) {
  const hue = 330 + (r() - 0.5) * 30;
  let sat = 55 + r() * 35, lit = 68 + r() * 12;
  if (r() < 0.3) { sat = 20 + r() * 25; lit = 90 + r() * 6; }
  return { hue, sat, lit };
}
export const cherryToneOf = (seed) => cherryTone(rng(seed || 1));

const DRAW_DECO = {
  tree(c, x, y, s, v, r) {
    if (v === 1) s *= 1.35;                                                  // pines grow tall
    shadow(c, x, y + 4 * s, 14 * s, 5 * s, 34 * s);
    if (v === 0) {                                                           // broadleaf: a knobbly canopy of blobs
      const trunk = ["#6d4c41", "#5d4037", "#795548"][Math.floor(r() * 3)];
      rect(c, x - 3 * s, y - 18 * s, 6 * s, 22 * s, trunk);                                             // runs up into the canopy
      line(c, x - 1 * s, y - 8 * s, x - 5 * s, y - 14 * s, trunk, 2.5 * s);
      const tint = Math.floor(r() * 3), dark = ["#397a3c", "#4a6b2a", "#2b5c2e"][tint], light = ["#56964f", "#6c8a42", "#3f7a43"][tint];
      circle(c, x, y - 15 * s, 8 * s, dark);                                                             // the crown always sits on the trunk
      const blobs = 4 + Math.floor(r() * 3);
      for (let i = 0; i < blobs; i++) { const a = r() * Math.PI * 2, d = r() * 7 * s; circle(c, x + Math.cos(a) * d, y - 17 * s + Math.sin(a) * d * 0.7, (7 + r() * 5) * s, dark); }
      circle(c, x + (r() - 0.5) * 4 * s, y - 21 * s, (8 + r() * 3) * s, light);
      circle(c, x - 3 * s, y - 25 * s, 4 * s, "rgba(255,255,255,0.15)");
      if (r() < 0.35) for (let i = 0; i < 4; i++) circle(c, x + (r() - 0.5) * 16 * s, y - 16 * s + (r() - 0.5) * 10 * s, 1.3 * s, r() < 0.5 ? "#e53935" : "#ffb300");   // fruit
    } else if (v === 1) {                                                    // pine: stacked triangles
      rect(c, x - 2.5 * s, y - 8 * s, 5 * s, 12 * s, "#5d4037");
      const tiers = 3 + Math.floor(r() * 2), g1 = ["#1b5e20", "#2e7d32", "#245a1a"][Math.floor(r() * 3)];
      for (let i = 0; i < tiers; i++) {
        const w = (14 - i * 3) * s, ty = y - 6 * s - i * 9 * s;
        // Not a perfect triangle: the tip leans a little, the skirts droop unevenly, and a branch pokes out
        const lean = (r() - 0.5) * 3 * s, lDrop = r() * 2.5 * s, rDrop = r() * 2.5 * s, lw = w * (0.85 + r() * 0.3), rw = w * (0.85 + r() * 0.3);
        poly(c, [[x - lw, ty + lDrop], [x - lw * 0.55, ty - 4 * s - r() * 2 * s], [x + lean, ty - 13 * s], [x + rw * 0.55, ty - 4 * s - r() * 2 * s], [x + rw, ty + rDrop]], g1, "rgba(13,61,18,0.45)", 0.7);
        poly(c, [[x - lw, ty + lDrop], [x + lean, ty - 13 * s], [x - lw * 0.2, ty]], "rgba(255,255,255,0.1)");
        if (r() < 0.35) line(c, x + (r() < 0.5 ? -1 : 1) * lw * 0.9, ty - 1 * s, x + (r() < 0.5 ? -1 : 1) * (lw + 3 * s), ty + 1 * s, "rgba(13,61,18,0.45)", 1.2);   // a stray branch, as soft as the outline
      }
      if (r() < 0.3) for (let i = 0; i < 3; i++) circle(c, x + (r() - 0.5) * 10 * s, y - 12 * s - r() * 14 * s, 1.1 * s, "#8d6e63");   // cones
    } else if (v === 3) {                                                    // cherry: dark trunk, a cloud of blossom in its own shade of pink
      rect(c, x - 2.5 * s, y - 18 * s, 5 * s, 22 * s, "#4e342e");
      line(c, x - 1 * s, y - 9 * s, x - 6 * s, y - 15 * s, "#4e342e", 2 * s); line(c, x + 1 * s, y - 10 * s, x + 6 * s, y - 15 * s, "#4e342e", 2 * s);
      const { hue, sat, lit } = cherryTone(r);                                                             // its own shade: peach-pink to magenta, or nearly white
      const pink = (dl, ds = 0) => `hsl(${hue},${sat + ds}%,${Math.min(97, lit + dl)}%)`;
      circle(c, x, y - 16 * s, 7 * s, pink(-6));                                                         // the crown always sits on the trunk
      const blobs = 5 + Math.floor(r() * 3);
      for (let i = 0; i < blobs; i++) { const a = r() * Math.PI * 2, d = r() * 8 * s; circle(c, x + Math.cos(a) * d, y - 18 * s + Math.sin(a) * d * 0.7, (6 + r() * 4) * s, pink(r() < 0.5 ? -6 : 2)); }
      circle(c, x + (r() - 0.5) * 4 * s, y - 22 * s, (7 + r() * 3) * s, pink(12, -15));
      for (let i = 0; i < 5; i++) circle(c, x + (r() - 0.5) * 20 * s, y - 16 * s + (r() - 0.5) * 12 * s, 1.1 * s, pink(-20, 10));   // deeper blossoms
      for (let i = 0; i < 3; i++) circle(c, x + (r() - 0.5) * 26 * s, y - 2 * s + r() * 3, 1 * s, pink(4));                        // fallen petals
    } else if (v === 4) {                                                    // autumn: a canopy turned gold, orange or red, leaves on the ground
      const trunk = ["#5d4037", "#4e342e", "#6d4c41"][Math.floor(r() * 3)];
      rect(c, x - 3 * s, y - 18 * s, 6 * s, 22 * s, trunk);
      line(c, x + 1 * s, y - 8 * s, x + 5 * s, y - 14 * s, trunk, 2.5 * s);
      const pal = [["#cf6424", "#dd8f3c", "#deae4c"], ["#d1a235", "#dcbd55", "#e5d07e"], ["#ad4a22", "#c35f33", "#d6835a"], ["#d2742c", "#d1a235", "#ab3f3a"]][Math.floor(r() * 4)];
      const blobs = 4 + Math.floor(r() * 3), thin = r() < 0.35;             // some have already dropped half their leaves
      circle(c, x, y - 15 * s, (thin ? 5.5 : 8) * s, pal[0]);                                           // the crown always sits on the trunk
      for (let i = 0; i < blobs; i++) { const a = r() * Math.PI * 2, d = r() * 7 * s; circle(c, x + Math.cos(a) * d, y - 17 * s + Math.sin(a) * d * 0.7, (thin ? 5 : 7 + r() * 5) * s, pal[Math.floor(r() * 2)]); }
      circle(c, x + (r() - 0.5) * 4 * s, y - 21 * s, (thin ? 5 : 7 + r() * 3) * s, pal[1 + Math.floor(r() * 2)]);
      if (thin) for (let i = 0; i < 3; i++) line(c, x, y - 14 * s, x + (r() - 0.5) * 16 * s, y - 24 * s - r() * 4 * s, trunk, 1.2 * s);   // bare twigs poking through
      for (let i = 0; i < 6; i++) circle(c, x + (r() - 0.5) * 30 * s, y - 1 * s + r() * 4, 1.1 * s, pal[Math.floor(r() * 3)]);        // fallen leaves
    } else if (v === 5) {                                                    // bare: a leafless tree, just trunk and branching twigs
      const trunk = ["#5d4037", "#4e342e", "#6d4c41"][Math.floor(r() * 3)];
      rect(c, x - 2.5 * s, y - 12 * s, 5 * s, 16 * s, trunk);
      const branch = (bx, by, ang, len, wd, depth) => {
        const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
        line(c, bx, by, ex, ey, trunk, wd);
        if (depth > 0) { branch(ex, ey, ang - 0.35 - r() * 0.4, len * 0.68, wd * 0.65, depth - 1); branch(ex, ey, ang + 0.35 + r() * 0.4, len * 0.68, wd * 0.65, depth - 1); }
      };
      branch(x, y - 11 * s, -Math.PI / 2 - 0.5, 9 * s, 2.2 * s, 2); branch(x, y - 11 * s, -Math.PI / 2 + 0.45, 9 * s, 2.2 * s, 2); branch(x, y - 12 * s, -Math.PI / 2 + (r() - 0.5) * 0.3, 10 * s, 2 * s, 2);
      for (let i = 0; i < 4; i++) circle(c, x + (r() - 0.5) * 26 * s, y - 1 * s + r() * 4, 1 * s, r() < 0.5 ? "#bf360c" : "#f9a825");   // the last fallen leaves
    } else if (v === 6) {                                                    // dead oak: a stout, gnarled trunk, wide crooked limbs, a hollow, a few brown leaves still clinging
      const bark = ["#4e342e", "#3e2723", "#5d4037"][Math.floor(r() * 3)];
      poly(c, [[x - 4.5 * s, y + 4 * s], [x - 3 * s, y - 10 * s], [x + 3 * s, y - 10 * s], [x + 4.5 * s, y + 4 * s]], bark);   // trunk, wider at the foot
      const limb = (bx, by, ang, len, wd, depth) => {
        // Each limb bends as it goes, so the tree looks twisted rather than drawn with a ruler
        let px = bx, py = by, a = ang; const steps = 3;
        for (let i = 0; i < steps; i++) { const nx = px + Math.cos(a) * len / steps, ny = py + Math.sin(a) * len / steps; line(c, px, py, nx, ny, bark, wd * (1 - i * 0.2)); px = nx; py = ny; a += (r() - 0.5) * 0.7; }
        if (depth > 0) { limb(px, py, a - 0.5 - r() * 0.5, len * 0.6, wd * 0.6, depth - 1); limb(px, py, a + 0.3 + r() * 0.6, len * 0.6, wd * 0.6, depth - 1); }
        else if (r() < 0.4) circle(c, px, py, 1.2 * s, "#8d6e63");                                       // a clinging dead leaf
      };
      limb(x - 2 * s, y - 9 * s, -Math.PI / 2 - 1.1, 11 * s, 2.6 * s, 2);                               // a limb reaching out left...
      limb(x + 2 * s, y - 9 * s, -Math.PI / 2 + 1.0, 10 * s, 2.4 * s, 2);                               // ...and right
      limb(x, y - 10 * s, -Math.PI / 2 + (r() - 0.5) * 0.4, 9 * s, 2.2 * s, 1);                         // a shorter one up the middle
      ellipse(c, x + 1 * s, y - 3 * s, 1.6 * s, 2.4 * s, "#1b0f0a");                                     // the hollow
      for (let i = 0; i < 3; i++) circle(c, x + (r() - 0.5) * 24 * s, y - 1 * s + r() * 4, 1 * s, r() < 0.5 ? "#8d6e63" : "#a1887f");   // dry leaves on the ground
    } else {                                                                 // birch: pale trunk with bands, airy light canopy
      rect(c, x - 2.5 * s, y - 24 * s, 5 * s, 28 * s, "#eceff1", "#9e9e9e", 0.6);
      for (let i = 0; i < 4; i++) line(c, x - 2.5 * s, y - 12 * s + i * 4 * s + r() * 2, x + 2.5 * s, y - 11 * s + i * 4 * s, "#424242", 1);
      circle(c, x, y - 21 * s, 6.5 * s, "#93b86a");                                                      // the crown always sits on the trunk
      const blobs = 5 + Math.floor(r() * 3);
      for (let i = 0; i < blobs; i++) { const a = r() * Math.PI * 2, d = r() * 8 * s; circle(c, x + Math.cos(a) * d, y - 22 * s + Math.sin(a) * d * 0.8, (5 + r() * 4) * s, r() < 0.5 ? "#93b86a" : "#a6c484"); }
      circle(c, x - 2 * s, y - 26 * s, 3.5 * s, "rgba(255,255,255,0.2)");
    }
  },
  leaves(c, x, y, s, v, r) {                                                 // a drift of fallen leaves lying flat on the grass
    const pal = [["#cf6424", "#dd8f3c", "#ad4a22", "#deae4c"], ["#d1a235", "#dcbd55", "#d2742c", "#b56a35"], ["#ab3f3a", "#c35f33", "#d6835a", "#d1a235"]][v];
    const n = 7 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = r() * 14 * s, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.5;
      c.save(); c.translate(lx, ly); c.rotate(r() * Math.PI);
      ellipse(c, 0, 0, 1.9 * s, 1.1 * s, pal[Math.floor(r() * pal.length)]);
      c.restore();
    }
  },
  pebbles(c, x, y, s, v, r) {                                                // a few small stones lying together
    const greys = [["#8d8d8d", "#b0b0b0"], ["#9e9789", "#c4bcae"], ["#7d8a92", "#a6b3bb"]][v];
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const px = x + (i - (n - 1) / 2) * 6 * s + (r() - 0.5) * 4, py = y + (r() - 0.5) * 4, pr = (1.6 + r() * 1.6) * s;
      ellipse(c, px, py + 1, pr * 1.1, pr * 0.5, "rgba(20,50,15,0.25)");
      ellipse(c, px, py, pr, pr * 0.7, greys[0], "rgba(40,40,40,0.22)", 0.5);
      ellipse(c, px - pr * 0.25, py - pr * 0.25, pr * 0.45, pr * 0.3, greys[1]);
    }
  },
  rock(c, x, y, s, v, r) {
    shadow(c, x, y + 5 * s, 12 * s, 4 * s);
    const greys = [["#8d8d8d", "#5f5f5f", "#aaaaaa"], ["#9e9789", "#6b655a", "#bdb5a6"], ["#7d8a92", "#4f5a61", "#9fadb5"]][v];
    const n = 5 + Math.floor(r() * 3), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rad = (6 + r() * 6) * s; pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.65]); }
    poly(c, pts, greys[0], "rgba(40,40,40,0.22)", 0.6);
    poly(c, pts.slice(0, Math.ceil(n / 2)).map(([px, py]) => [x + (px - x) * 0.55, y - 3 * s + (py - y) * 0.45]), greys[2]);   // lit top facet
    if (r() < 0.5) line(c, x - 3 * s, y + 1 * s, x + 2 * s, y - 3 * s, greys[1], 1);                                           // crack
    if (r() < 0.5) { circle(c, x + (r() - 0.5) * 8 * s, y + 2 * s, 2.2 * s, "#5b8f33"); circle(c, x + (r() - 0.5) * 8 * s, y - 2 * s, 1.5 * s, "#6ea83f"); }   // moss
    if (r() < 0.4) { const sx = x + 10 * s, sy = y + 3 * s; poly(c, [[sx - 3 * s, sy + 2 * s], [sx, sy - 2 * s], [sx + 4 * s, sy + 1 * s], [sx + 2 * s, sy + 3 * s]], greys[0], greys[1], 0.8); }   // a smaller stone beside it
  },
  bush(c, x, y, s, v, r) {
    shadow(c, x, y + 6 * s, 12 * s, 4 * s);
    const greens = r() < 0.22 ? [["#8d4a1e", "#c0652a"], ["#a0521f", "#d98c3a"], ["#7a3e1a", "#b8641f"]][v]      // some bushes have turned russet
      : [["#33691e", "#558b2f"], ["#2e7d32", "#43a047"], ["#4e6b1f", "#6b8e23"]][v];
    const n = 2 + Math.floor(r() * 3), rim = r() < 0.22 ? "#4a2a12" : "#1f4a1c";
    const lobes = [];
    for (let i = 0; i < n; i++) lobes.push([x + (i - (n - 1) / 2) * 6 * s + (r() - 0.5) * 3, y + (r() - 0.5) * 3, (6 + r() * 3) * s, greens[0]]);
    lobes.push([x + (r() - 0.5) * 4, y - 5 * s, (6 + r() * 3) * s, greens[1]]);
    // No drawn outlines: the edge is a ragged crown of small leaf clusters, with a deeper shade tucked under each lobe
    for (const [lx, ly, lr] of lobes) {
      circle(c, lx + 0.4 * s, ly + 1.2 * s, lr, rim, null);                                                      // the shade beneath
      for (let k = 0, m = 7 + Math.floor(r() * 4); k < m; k++) { const a = r() * Math.PI * 2, d = lr * (0.82 + r() * 0.3); circle(c, lx + Math.cos(a) * d, ly + Math.sin(a) * d * 0.9, (1.4 + r() * 1.6) * s, r() < 0.5 ? greens[0] : rim); }   // leaf clusters breaking the outline
    }
    for (const [lx, ly, lr, col] of lobes) circle(c, lx, ly, lr * 0.96, col);
    for (const [lx, ly, lr] of lobes) for (let k = 0; k < 5; k++) { const a = Math.PI * (1.1 + r() * 0.8), d = lr * (0.3 + r() * 0.5); circle(c, lx + Math.cos(a) * d, ly + Math.sin(a) * d, (0.9 + r() * 1.3) * s, greens[1]); }   // lit leaves on top
    circle(c, x - 2 * s, y - 8 * s, 2.5 * s, "rgba(255,255,255,0.12)");
    const berry = r();
    if (berry < 0.35) for (let i = 0; i < 4; i++) circle(c, x + (r() - 0.5) * 14 * s, y - 2 * s + (r() - 0.5) * 8 * s, 1.4 * s, "#e53935");           // red berries
    else if (berry < 0.55) for (let i = 0; i < 4; i++) circle(c, x + (r() - 0.5) * 14 * s, y - 2 * s + (r() - 0.5) * 8 * s, 1.4 * s, "#3949ab");      // blueberries
    else if (berry < 0.75) for (let i = 0; i < 5; i++) { const fx = x + (r() - 0.5) * 14 * s, fy = y - 3 * s + (r() - 0.5) * 8 * s; for (let k = 0; k < 4; k++) circle(c, fx + Math.cos(k * 1.57) * 1.4 * s, fy + Math.sin(k * 1.57) * 1.4 * s, 1 * s, "#fff"); circle(c, fx, fy, 0.8 * s, "#ffeb3b"); }   // white blossom
  },
  flower(c, x, y, s, v, r) {
    const palette = [["#f48fb1", "#ffeb3b"], ["#ffffff", "#ffb300"], ["#ffeb3b", "#ff8f00"], ["#b39ddb", "#ffeb3b"], ["#64b5f6", "#fff176"], ["#ff8a65", "#6d4c41"]][Math.floor(r() * 6)];
    const count = 1 + Math.floor(r() * 3);
    for (let k = 0; k < count; k++) {
      const fx = x + (k ? (r() - 0.5) * 14 : 0), fy = y + (k ? (r() - 0.5) * 8 : 0), fs = s * (0.7 + r() * 0.5);
      line(c, fx, fy + 1, fx + 1, fy + 6 * fs, "#4f7f2a", 1.2);                                             // stem
      poly(c, [[fx + 1, fy + 4 * fs], [fx + 4 * fs, fy + 2 * fs], [fx + 2 * fs, fy + 6 * fs]], "#5b8f33");  // leaf
      const petals = 4 + Math.floor(r() * 3), rot = r() * Math.PI;
      for (let i = 0; i < petals; i++) { const a = rot + (i / petals) * Math.PI * 2; circle(c, fx + Math.cos(a) * 3.5 * fs, fy + Math.sin(a) * 3.5 * fs, 2.6 * fs, palette[0]); }
      circle(c, fx, fy, 2.2 * fs, palette[1]);
    }
  },
  tuft(c, x, y, s, v, r) { drawTuft(c, x, y, s, v % TUFT_KINDS, r); },
  weed(c, x, y, s, v, r) { drawWeed(c, x, y, s, v % WEED_KINDS, r); },
  mushroom(c, x, y, s, v, r) {
    const caps = [["#d84315", "#fff"], ["#8d6e63", "#efebe9"], ["#c62828", "#fff"]][v];
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const mx = x + (k ? (r() - 0.5) * 12 : 0), my = y + (k ? (r() - 0.5) * 4 : 0), ms = s * (0.6 + r() * 0.6);
      shadow(c, mx, my + 2, 4 * ms, 1.5 * ms);
      rect(c, mx - 1.8 * ms, my - 6 * ms, 3.6 * ms, 7 * ms, "#f5f5dc", "rgba(120,90,70,0.22)", 0.5);
      ellipse(c, mx, my - 6 * ms, 5.5 * ms, 3.5 * ms, caps[0], "rgba(60,35,25,0.28)", 0.5);
      if (v !== 1) for (let i = 0; i < 3; i++) circle(c, mx + (r() - 0.5) * 7 * ms, my - 7 * ms + (r() - 0.5) * 2 * ms, 0.8 * ms, caps[1]);
    }
  },
  stump(c, x, y, s, v, r) {
    shadow(c, x, y + 5 * s, 10 * s, 4 * s);
    rect(c, x - 7 * s, y - 6 * s, 14 * s, 10 * s, "#6d4c41", "rgba(62,39,35,0.6)", 0.7);
    for (let i = 0; i < 4; i++) line(c, x - 7 * s + i * 4 * s + 1, y - 5 * s, x - 7 * s + i * 4 * s + 1, y + 3 * s, "#5d4037", 1);   // bark
    ellipse(c, x, y - 6 * s, 7 * s, 3.2 * s, "#d7b899", "rgba(62,39,35,0.6)", 0.7);                                                            // cut face
    for (let i = 1; i <= 3; i++) { c.strokeStyle = "#a1887f"; c.lineWidth = 0.7; c.beginPath(); c.ellipse(x, y - 6 * s, 7 * s * i / 4, 3.2 * s * i / 4, 0, 0, Math.PI * 2); c.stroke(); }   // rings
    if (r() < 0.5) { circle(c, x + 6 * s, y + 1 * s, 2 * s, "#5b8f33"); }                                                       // moss
    if (r() < 0.4) { ellipse(c, x - 6 * s, y - 2 * s, 3 * s, 1.8 * s, "#d84315", "#4e342e", 0.6); }                              // a bracket fungus
  },
};

// Wooden signpost at the monsters' entrance (drawn live, depth-sorted with everything else)
// The monster lair at an entrance: scorched earth at the mouth of the road, skull stakes either side,
// scattered bones and a dead tree. The glowing eyes and green mist are animated in draw.js.
export function lairStakes(e) {
  const px = -e.inn.y, py = e.inn.x;
  return [{ x: e.rx + px * GATE_SPAN, y: e.ry + py * GATE_SPAN }, { x: e.rx - px * GATE_SPAN, y: e.ry - py * GATE_SPAN }];
}
function drawLairGround(c, e, rand) {
  const ax = e.inn.x, ay = e.inn.y, px = -ay, py = ax;
  // (the chevrons on the road are animated, drawn each frame in draw.js)
  // Scorched, trampled earth where the monsters pour in
  const g = c.createRadialGradient(e.rx - ax * 10, e.ry - ay * 10, 4, e.rx - ax * 10, e.ry - ay * 10, 60);
  g.addColorStop(0, "rgba(30,20,25,0.55)"); g.addColorStop(1, "rgba(30,20,25,0)");
  c.fillStyle = g; c.beginPath(); c.ellipse(e.rx - ax * 10, e.ry - ay * 10, 60, 60, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 6; i++) {                                                 // bones in the dirt
    const t = (rand() - 0.5) * 50, s = (rand() - 0.5) * 36, bx = e.rx + ax * (t * 0.3 + 12) + px * s, by = e.ry + ay * (t * 0.3 + 12) + py * s, a = rand() * Math.PI, l = 5 + rand() * 6;
    line(c, bx - Math.cos(a) * l, by - Math.sin(a) * l, bx + Math.cos(a) * l, by + Math.sin(a) * l, "#e0e0e0", 2);
    circle(c, bx - Math.cos(a) * l, by - Math.sin(a) * l, 1.6, "#e0e0e0"); circle(c, bx + Math.cos(a) * l, by + Math.sin(a) * l, 1.6, "#e0e0e0");
  }
}
// The lair's standing parts: skull stakes and the dead tree (drawn live, depth-sorted)
export function lairAnchorY(e) { const [s1, s2] = lairStakes(e); return Math.max(s1.y, s2.y, lairTreePos(e).y) + 2; }
function lairTreePos(e) {
  const ax = e.inn.x, ay = e.inn.y, px = -ay, py = ax;
  const side = (e.x - e.rx) * px + (e.y - e.ry) * py > 0 ? -1 : 1;
  return { x: e.rx + px * side * (GATE_SPAN + 16) + ax * 6, y: e.ry + py * side * (GATE_SPAN + 16) + ay * 6 };
}
export function lairParts(e) {                                                  // each piece sorts by its own feet
  const [a, b] = lairStakes(e), t = lairTreePos(e);
  return [{ y: a.y + 2, draw: (c, T) => drawLairStake(c, a, T) }, { y: b.y + 2, draw: (c, T) => drawLairStake(c, b, T) }, { y: t.y + 2, draw: (c) => drawLairTree(c, t) }];
}
export function drawLairStructure(c, e) { for (const p of lairParts(e)) p.draw(c); }
function drawLairStake(c, s, T) {
  {                                                                             // skull stake
    castShadow(c, s.x, s.y + 2, 5, 22);
    line(c, s.x, s.y + 4, s.x, s.y - 30, "#4e342e", 4); line(c, s.x - 1, s.y + 4, s.x - 1, s.y - 30, "#6d4c41", 1.5);
    for (let k = 0; k < 3; k++) line(c, s.x - 5, s.y - 8 - k * 7, s.x + 5, s.y - 10 - k * 7, "#8d6e63", 1.2);   // rope wraps
    circle(c, s.x, s.y - 35, 6, "#eeeeee", "#9e9e9e", 1);
    circle(c, s.x - 2.2, s.y - 36, 1.6, "#1b1b1b"); circle(c, s.x + 2.2, s.y - 36, 1.6, "#1b1b1b");
    line(c, s.x - 2.5, s.y - 31, s.x + 2.5, s.y - 31, "#9e9e9e", 1); for (let k = -1; k <= 1; k++) line(c, s.x + k * 1.6, s.y - 32, s.x + k * 1.6, s.y - 30, "#9e9e9e", 1);
    if (T !== undefined) {                                                      // the eyes glow green: drawn here so the stake's depth order covers them like the rest of it
      const gl = 0.5 + Math.sin(T * 3 + s.x) * 0.4;
      circle(c, s.x - 2.2, s.y - 36, 1.4, `rgba(118,255,3,${gl})`); circle(c, s.x + 2.2, s.y - 36, 1.4, `rgba(118,255,3,${gl})`);
      addLight(c, s.x, s.y - 36, 7 + gl * 4, "green");
    }
  }
}
// A dead tree leaning over the road, on the signpost's far side
function drawLairTree(c, { x: tx, y: ty }) {
  castShadow(c, tx, ty, 8, 26);
  line(c, tx, ty, tx + 3, ty - 34, "#3e2723", 6);
  line(c, tx + 1, ty - 18, tx - 14, ty - 32, "#3e2723", 3.5); line(c, tx + 2, ty - 26, tx + 16, ty - 40, "#3e2723", 3);
  line(c, tx - 14, ty - 32, tx - 20, ty - 42, "#3e2723", 2); line(c, tx + 16, ty - 40, tx + 22, ty - 44, "#3e2723", 1.8); line(c, tx + 3, ty - 34, tx + 1, ty - 48, "#3e2723", 2.5);
  circle(c, tx - 20, ty - 42, 2.2, "#1b1b1b"); circle(c, tx + 23, ty - 45, 2.2, "#1b1b1b");                  // crows
}

// The exit gate: two stone pillars either side of the road where it leaves the map, with chevrons on the
// road pointing out through it. The torches and banner on top are animated, drawn each frame in draw.js.
export const GATE_SPAN = ROAD_EDGE + 8;                                     // posts stand just off the bank
export function gatePillars(g) {
  const px = -g.out.y, py = g.out.x;                                           // across the road
  return [{ x: g.x + px * GATE_SPAN, y: g.y + py * GATE_SPAN }, { x: g.x - px * GATE_SPAN, y: g.y - py * GATE_SPAN }];
}
function drawGateGround(c, g) {
  // (the chevrons on the road are animated, drawn each frame in draw.js)
}
export function gateAnchorY(g) { const [a, b] = gatePillars(g); return Math.max(a.y, b.y) + 6; }
export function drawGateStructure(c, g) {
  if (g.style === 1) return drawPaifang(c, g);
  if (g.style === 2) return drawMoorishGate(c, g);
  for (const p of gatePillars(g)) {
    castShadow(c, p.x, p.y + 4, 9, 30);
    const grad = c.createLinearGradient(p.x - 9, 0, p.x + 9, 0);
    grad.addColorStop(0, "#b8b4ac"); grad.addColorStop(0.6, "#8f8b84"); grad.addColorStop(1, "#5a5650");
    poly(c, [[p.x - 8, p.y - 34], [p.x + 8, p.y - 34], [p.x + 10.5, p.y + 6], [p.x - 10.5, p.y + 6]], grad, "rgba(58,55,51,0.7)", 0.9);   // tapered: a touch wider at the foot
    for (let yy = p.y - 28; yy < p.y + 4; yy += 8) { const hw = 8 + ((yy - (p.y - 34)) / 40) * 2.5; line(c, p.x - hw, yy, p.x + hw, yy, "rgba(40,36,32,0.35)", 1); }
    rect(c, p.x - 11.5, p.y + 4, 23, 4, "#7a766e", "rgba(58,55,51,0.7)", 0.7);                                        // plinth
    for (const xx of [p.x - 8, p.x - 2, p.x + 4]) rect(c, xx, p.y - 40, 4, 7, "#a8a49c", "rgba(58,55,51,0.7)", 0.7);   // three slim merlons, flush with the pillar top
    rect(c, p.x - 1.5, p.y - 46, 3, 8, "#4e342e");                                                       // torch bracket
    wearOut(c, rng(Math.floor(p.x * 13 + p.y * 7)), [[p.x - 8, p.y - 34, 16, 40]]);                      // old stone: cracks, stains, moss
  }
}

// A Chinese paifang (牌坊): red lacquered posts on stone bases with green glazed roofs whose eaves sweep up at
// the corners, gold trim, and (when the posts stand side by side) a crossbeam with a roof over the road.
function drawPaifang(c, g) {
  const [a, b] = gatePillars(g);
  const across = Math.abs(a.y - b.y) < 1;                                 // posts left and right of the road: one roof spans them
  const roof = (cx, cy, hw) => {                                           // an up-swept tiled roof centred at (cx, cy) with half-width hw
    c.fillStyle = "#2e7d32"; c.beginPath();
    c.moveTo(cx - hw - 8, cy - 2); c.quadraticCurveTo(cx - hw - 2, cy + 3, cx - hw + 6, cy + 3);
    c.lineTo(cx + hw - 6, cy + 3); c.quadraticCurveTo(cx + hw + 2, cy + 3, cx + hw + 8, cy - 2);
    c.quadraticCurveTo(cx + hw * 0.5, cy - 9, cx, cy - 10); c.quadraticCurveTo(cx - hw * 0.5, cy - 9, cx - hw - 8, cy - 2);
    c.closePath(); c.fill();
    c.strokeStyle = "#1b5e20"; c.lineWidth = 1; c.stroke();
    for (let x = cx - hw + 4; x < cx + hw - 2; x += 5) line(c, x, cy - 6 + Math.abs(x - cx) / hw * 3, x, cy + 2, "rgba(27,94,32,0.6)", 1);   // tile ridges
    line(c, cx - hw - 6, cy - 1, cx + hw + 6, cy - 1, "#c9a227", 1.2);    // gold eave trim
    const fg = c.createRadialGradient(cx - 0.6, cy - 10.6, 0.3, cx, cy - 10, 2.4);
    fg.addColorStop(0, "#fff8dc"); fg.addColorStop(0.6, "#ffd54f"); fg.addColorStop(1, "#c9a227");
    circle(c, cx, cy - 10, 2.4, fg, "#b8902a", 0.6);                     // bright ridge finial (glows live in draw.js)
  };
  for (const p of [a, b]) {
    castShadow(c, p.x, p.y + 4, 8, 28);
    rect(c, p.x - 7, p.y - 2, 14, 7, "#8d8d8d", "rgba(78,78,78,0.5)", 0.7);   // stone base
    const grad = c.createLinearGradient(p.x - 5, 0, p.x + 5, 0);
    grad.addColorStop(0, "#c4544a"); grad.addColorStop(0.5, "#a8382f"); grad.addColorStop(1, "#7a2420");
    rect(c, p.x - 5, p.y - 40, 10, 38, grad, "rgba(90,26,22,0.55)", 0.7);   // red lacquered post
    rect(c, p.x - 6, p.y - 44, 12, 5, "#c9a227", "rgba(138,106,0,0.5)", 0.6);   // gold cap
    wearOut(c, rng(Math.floor(p.x * 13 + p.y * 7)), [[p.x - 5, p.y - 40, 10, 38]]);   // the lacquer has seen a few winters
    if (!across) roof(p.x, p.y - 48, 9);                                  // a little roof on each post
  }
  if (across) {
    const lx = Math.min(a.x, b.x), rx = Math.max(a.x, b.x), cy = a.y;
    rect(c, lx - 4, cy - 50, rx - lx + 8, 7, "#a8382f", "rgba(90,26,22,0.55)", 0.7);   // crossbeam
    for (let x = lx + 2; x < rx - 2; x += 8) rect(c, x, cy - 49, 3, 5, "#ffd54f");   // gold studs
    rect(c, (lx + rx) / 2 - 13, cy - 52, 26, 10, "#1a237e", "rgba(13,21,69,0.6)", 0.7);   // name board
    line(c, (lx + rx) / 2 - 9, cy - 47, (lx + rx) / 2 + 9, cy - 47, "#ffd54f", 1.4);
    roof((lx + rx) / 2, cy - 56, (rx - lx) / 2 + 6);
  }
}




// A Moorish gate for the desert palace: cream posts with turquoise tile bands and onion-dome caps tipped
// with gold; when the posts stand side by side a horseshoe arch spans the road between them.
function drawMoorishGate(c, g) {
  const [a, b] = gatePillars(g);
  const across = Math.abs(a.y - b.y) < 1;
  const wall = "#f1e6d0", wallDark = "#cdbb9a", edge = "rgba(141,122,88,0.5)", teal = "#2a9d8f", tealDark = "#1b6f66", tealLight = "#5fc4b6", gold = "#e9c55a", goldDark = "#b8902a";
  const dome = (cx, cy, r) => {
    const gr = c.createLinearGradient(cx - r, 0, cx + r, 0); gr.addColorStop(0, tealLight); gr.addColorStop(0.55, teal); gr.addColorStop(1, tealDark);
    c.fillStyle = gr; c.beginPath();
    c.moveTo(cx - r, cy); c.quadraticCurveTo(cx - r * 1.05, cy - r * 1.1, cx - r * 0.35, cy - r * 1.45);
    c.quadraticCurveTo(cx, cy - r * 1.7, cx, cy - r * 1.95); c.quadraticCurveTo(cx, cy - r * 1.7, cx + r * 0.35, cy - r * 1.45);
    c.quadraticCurveTo(cx + r * 1.05, cy - r * 1.1, cx + r, cy); c.closePath(); c.fill(); c.strokeStyle = tealDark; c.lineWidth = 1; c.stroke();
    line(c, cx - r, cy, cx + r, cy, goldDark, 1.2);
    line(c, cx, cy - r * 1.95, cx, cy - r * 2.2, goldDark, 1.4); circle(c, cx, cy - r * 2.25, 1.5, gold, goldDark, 0.6);
  };
  if (across) {                                                            // a shallow horseshoe arch joining the post caps over the road
    const lx = Math.min(a.x, b.x), rx = Math.max(a.x, b.x), cx = (lx + rx) / 2, cy = a.y - 36, hw = (rx - lx) / 2;
    c.fillStyle = wall; c.beginPath();
    c.ellipse(cx, cy, hw + 2, 22, 0, Math.PI, 0); c.ellipse(cx, cy, hw - 7, 14, 0, 0, Math.PI, true); c.closePath(); c.fill();
    c.strokeStyle = edge; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = teal; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy, hw - 2.5, 18, 0, Math.PI * 1.04, Math.PI * 1.96); c.stroke();   // tile band along the arch
    for (let t = 1.1; t < 1.92; t += 0.1) circle(c, cx + Math.cos(t * Math.PI) * (hw - 2.5), cy + Math.sin(t * Math.PI) * 18, 0.9, gold);
    dome(cx, cy - 22, 6);                                                   // a small dome crowns the arch
  }
  for (const p of [a, b]) {
    castShadow(c, p.x, p.y + 4, 8, 28);
    const gr = c.createLinearGradient(p.x - 7, 0, p.x + 7, 0); gr.addColorStop(0, "#f6ecd8"); gr.addColorStop(1, wallDark);
    rect(c, p.x - 7, p.y - 36, 14, 40, gr, edge, 1.2);                       // post
    rect(c, p.x - 9, p.y + 2, 18, 4, wall, edge, 1);                          // base
    line(c, p.x - 7, p.y - 26, p.x + 7, p.y - 26, teal, 1.6); line(c, p.x - 7, p.y - 12, p.x + 7, p.y - 12, teal, 1.6);   // tile bands
    for (const yy of [-26, -12]) for (const dx of [-4, 0, 4]) rect(c, p.x + dx - 0.8, p.y + yy - 0.8, 1.6, 1.6, gold);
    c.fillStyle = "#3e2a1a"; c.beginPath(); c.moveTo(p.x - 2.5, p.y - 14); c.lineTo(p.x - 2.5, p.y - 20); c.arc(p.x, p.y - 20, 2.5, Math.PI, 0); c.lineTo(p.x + 2.5, p.y - 14); c.closePath(); c.fill();   // little arched window
    wearOut(c, rng(Math.floor(p.x * 13 + p.y * 7)), [[p.x - 7, p.y - 36, 14, 40]]);   // sun-bleached, stained plaster
    rect(c, p.x - 8, p.y - 39, 16, 3, wall, edge, 1);                        // cap ledge
    dome(p.x, p.y - 39, 7);
  }
}

// A desert palace: cream walls with a scalloped parapet and horseshoe arches, two slender minaret towers with
// little balconies, and turquoise onion domes tipped with gold. The big central dome carries the banner.
function drawPalace(c, x, y) {
  const wall = "#f1e6d0", wallDark = "#cdbb9a", edge = "rgba(141,122,88,0.5)", teal = "#2a9d8f", tealDark = "#1b6f66", tealLight = "#5fc4b6", gold = "#e9c55a", goldDark = "#b8902a";
  const dome = (cx, cy, r) => {                                            // an onion dome
    const g = c.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, tealLight); g.addColorStop(0.55, teal); g.addColorStop(1, tealDark);
    c.fillStyle = g; c.beginPath();
    c.moveTo(cx - r, cy); c.quadraticCurveTo(cx - r * 1.05, cy - r * 1.1, cx - r * 0.35, cy - r * 1.45);
    c.quadraticCurveTo(cx, cy - r * 1.7, cx, cy - r * 1.95); c.quadraticCurveTo(cx, cy - r * 1.7, cx + r * 0.35, cy - r * 1.45);
    c.quadraticCurveTo(cx + r * 1.05, cy - r * 1.1, cx + r, cy); c.closePath(); c.fill();
    c.strokeStyle = tealDark; c.lineWidth = 1; c.stroke();
    for (let k = -2; k <= 2; k++) line(c, cx + k * r * 0.3, cy - 1, cx + k * r * 0.12, cy - r * 1.4, "rgba(27,111,102,0.45)", 1);   // ribs
    line(c, cx - r, cy, cx + r, cy, goldDark, 1.2);
    line(c, cx, cy - r * 1.95, cx, cy - r * 2.2, goldDark, 1.5); circle(c, cx, cy - r * 2.25, 1.6, gold, goldDark, 0.6);   // gold tip
  };
  const arch = (ax, ay, w, h) => {                                        // horseshoe arch doorway
    c.fillStyle = "#3e2a1a"; c.beginPath(); c.moveTo(ax - w / 2, ay); c.lineTo(ax - w / 2, ay - h + w / 2);
    c.arc(ax, ay - h + w / 2, w / 2, Math.PI, 0); c.lineTo(ax + w / 2, ay); c.closePath(); c.fill();
    c.strokeStyle = goldDark; c.lineWidth = 1.2; c.stroke();
  };
  shadow(c, x, y + 6, 58, 11, 55);
  // Main block with a scalloped parapet
  rect(c, x - 44, y - 36, 88, 40, wall, edge, 0.8);
  const lg = c.createLinearGradient(x - 44, 0, x + 44, 0); lg.addColorStop(0, "rgba(255,255,255,0.25)"); lg.addColorStop(1, "rgba(80,60,30,0.2)");
  rect(c, x - 44, y - 36, 88, 40, lg);
  for (let sx = x - 42; sx <= x + 42; sx += 8) { c.fillStyle = wall; c.beginPath(); c.arc(sx, y - 36, 4, Math.PI, 0); c.fill(); c.strokeStyle = edge; c.lineWidth = 1; c.stroke(); }
  line(c, x - 44, y - 28, x + 44, y - 28, teal, 2);                       // tile band
  for (let sx = x - 40; sx <= x + 40; sx += 8) rect(c, sx - 1.5, y - 29, 3, 2, gold);
  arch(x, y + 4, 16, 28);                                                  // great door
  for (const ax of [-28, 28]) { arch(x + ax, y - 8, 8, 16); }               // side arches
  rect(c, x - 10, y + 4, 20, 4, "#d9cbb0", edge, 0.8);                     // step
  // Central drum and great dome
  rect(c, x - 18, y - 60, 36, 26, wall, edge, 0.8);
  for (let sx = x - 15; sx <= x + 15; sx += 10) arch(x + sx - x, y - 42, 6, 12);
  line(c, x - 18, y - 54, x + 18, y - 54, teal, 1.6);
  dome(x, y - 60, 20);
  // A gold crescent crowns the great dome (it glints live in draw.js)
  const cy0 = y - 60 - 20 * 2.25 - 5;
  c.fillStyle = gold; c.beginPath();
  c.arc(x, cy0, 5, Math.PI * 0.25, Math.PI * 1.75);                       // outer edge of the crescent
  c.arc(x + 2.6, cy0 - 1.2, 4.2, Math.PI * 1.6, Math.PI * 0.4, true);     // inner edge, curving back
  c.closePath(); c.fill(); c.strokeStyle = goldDark; c.lineWidth = 0.8; c.stroke();
  line(c, x, cy0 + 5, x, cy0 + 9, goldDark, 1.6);                           // its little stem
  // A courtyard fountain before the door: a round basin of blue tile, seen a little from above
  const fy = y + 18;
  ellipse(c, x, fy, 15, 9, wall, edge, 1);                                                       // stone rim (squashed like the build pads)
  ellipse(c, x, fy, 12, 6.9, "#4a93c4", tealDark, 0.8);                                          // water
  ellipse(c, x - 3, fy - 2, 4, 1.6, "rgba(255,255,255,0.35)");                                   // a glint on the water
  circle(c, x, fy - 1.5, 2.4, wall, edge, 0.6);                                                  // central spout
  // Minarets
  for (const tx of [x - 40, x + 40]) {
    const tg = c.createLinearGradient(tx - 7, 0, tx + 7, 0); tg.addColorStop(0, "#f6ecd8"); tg.addColorStop(1, wallDark);
    rect(c, tx - 7, y - 78, 14, 82, tg, edge, 0.8);
    rect(c, tx - 9, y - 50, 18, 4, wall, edge, 1);                          // balcony
    for (let k = -1; k <= 1; k++) rect(c, tx + k * 5 - 0.8, y - 56, 1.6, 6, edge);
    rect(c, tx - 2, y - 70, 4, 7, "#3e2a1a");                              // window
    line(c, tx - 7, y - 62, tx + 7, y - 62, teal, 1.4);
    dome(tx, y - 78, 8);
  }
}

// The Temple of Heaven (祈年殿): a round hall on a wide three-tier white marble terrace with balustrades,
// soft vermilion walls with gold-framed doors, and three conical roofs of deep-blue glazed tiles whose
// eaves flare out at the bottom, crowned by a gold finial.
function drawPagoda(c, x, y) {
  const red = "#a8382f", redDark = "#7a2420", redEdge = "rgba(122,36,32,0.55)", redDeep = "#8e2f29", gold = "#e9c55a", goldDark = "#b8902a";
  const blue = "#2d4e9e", blueDark = "#1c3470", blueLight = "#4a6fc2";
  shadow(c, x, y + 6, 60, 11, 70);
  // Marble terrace: three wide round tiers with balustrades, a stair up the middle
  ellipse(c, x, y + 8, 59, 10, "rgba(35,30,20,0.42)");                                               // the foundation's own shadow on the grass, so it sits firmly on the ground
  for (const [hw, hh, ty] of [[56, 8, y + 3], [46, 7, y - 4], [36, 6, y - 10]]) {
    const EDGE = "#6f685a", wall = c.createLinearGradient(0, ty - 6, 0, ty);                          // stone with a lit top and a shaded front: it has weight
    wall.addColorStop(0, "#d6d0c2"); wall.addColorStop(1, "#b3ab99");
    ellipse(c, x, ty, hw, hh, "#b3ab99", EDGE, 0.9);
    rect(c, x - hw, ty - 6, hw * 2, 6, wall, EDGE, 0.9);
    ellipse(c, x, ty - 6, hw, hh, "#eeeadf", EDGE, 0.9);                                              // the lit top of the tier
    // A solid parapet wall: a firm band with a coping on top and stubby pillars along it, nothing to see through
    rect(c, x - hw + 2, ty - 12, hw * 2 - 4, 6, "#d9d3c5", EDGE, 0.8);
    for (let i = -hw + 4; i <= hw - 4; i += 8) rect(c, x + i - 1.6, ty - 13, 3.2, 8, "#c3bcab", EDGE, 0.6);
    rect(c, x - hw + 1, ty - 14, hw * 2 - 2, 2.4, "#ece7da", EDGE, 0.7);                              // the coping, catching the light
  }
  rect(c, x - 6, y - 2, 12, 12, "#d9d4ca", "rgba(184,178,166,0.6)", 0.6); for (let s = 0; s < 4; s++) line(c, x - 6, y + s * 3, x + 6, y + s * 3, "rgba(184,178,166,0.7)", 0.7);
  // A conical roof: flaring eaves at the base, straight-ish sides rising to a ring at the top
  const cone = (base, hw, top, topHw) => {
    const g = c.createLinearGradient(x - hw, 0, x + hw, 0);
    g.addColorStop(0, blueLight); g.addColorStop(0.5, blue); g.addColorStop(1, blueDark);
    c.fillStyle = g; c.beginPath();
    c.moveTo(x - hw - 5, base - 2); c.quadraticCurveTo(x - hw + 2, base + 3, x - hw + 8, base + 3);
    c.lineTo(x + hw - 8, base + 3); c.quadraticCurveTo(x + hw - 2, base + 3, x + hw + 5, base - 2);
    c.quadraticCurveTo(x + hw * 0.55, base - (base - top) * 0.55, x + topHw, top);
    c.lineTo(x - topHw, top);
    c.quadraticCurveTo(x - hw * 0.55, base - (base - top) * 0.55, x - hw - 5, base - 2);
    c.closePath(); c.fill(); c.strokeStyle = "rgba(28,52,112,0.55)"; c.lineWidth = 0.7; c.stroke();
    for (let k = -3; k <= 3; k++) { const t = k / 3.6; line(c, x + t * topHw, top + 1, x + t * hw * 0.92, base + 1, "rgba(28,52,112,0.45)", 1); }   // tile seams fanning down
    line(c, x - hw - 3, base + 1, x + hw + 3, base + 1, goldDark, 1.2);                                  // gold eave
    ellipse(c, x, top, topHw, 1.6, goldDark);                                                             // gold ring at the top
  };
  // Lower hall: a wide red drum with doors
  rect(c, x - 38, y - 34, 76, 20, red, redEdge, 0.8);
  ellipse(c, x, y - 14, 38, 5, redDeep, redEdge, 0.8);
  line(c, x - 38, y - 31, x + 38, y - 31, goldDark, 1.4);
  for (const dx of [-27, -9, 9, 27]) { rect(c, x + dx - 4, y - 29, 8, 13, "#5a1a16", "rgba(233,197,90,0.7)", 0.7); line(c, x + dx, y - 29, x + dx, y - 16, gold, 0.7); line(c, x + dx - 4, y - 23, x + dx + 4, y - 23, gold, 0.7); }
  cone(y - 36, 50, y - 50, 32);
  // Middle drum and roof
  rect(c, x - 28, y - 60, 56, 10, red, redEdge, 0.8); line(c, x - 28, y - 57, x + 28, y - 57, goldDark, 1.2);
  for (const dx of [-15, 0, 15]) rect(c, x + dx - 2.5, y - 56, 5, 6, "#5a1a16", gold, 0.6);
  cone(y - 62, 40, y - 75, 21);
  // Upper drum and the top cone
  rect(c, x - 18, y - 83, 36, 8, red, redEdge, 0.8); line(c, x - 18, y - 80, x + 18, y - 80, goldDark, 1);
  cone(y - 85, 28, y - 106, 3.5);
  // The gilded 宝顶 on the real Temple of Heaven is a gourd-like stack: a flared base, a squat bulb, a smaller
  // bulb above it and a little pointed knob on top (it glints live in draw.js)
  const fg = c.createLinearGradient(x - 4, 0, x + 4, 0);
  fg.addColorStop(0, "#c9a227"); fg.addColorStop(0.45, "#fff3b0"); fg.addColorStop(1, "#b8902a");
  ellipse(c, x, y - 106.5, 4.6, 1.5, fg, "#b8902a", 0.6);                                                 // flared base plate
  c.fillStyle = fg; c.strokeStyle = "#b8902a"; c.lineWidth = 0.6; c.beginPath();                          // lower bulb: wide, slightly pear-shaped
  c.moveTo(x - 3.6, y - 107); c.bezierCurveTo(x - 4.6, y - 110.5, x - 2.6, y - 112.5, x - 1.4, y - 113);
  c.lineTo(x + 1.4, y - 113); c.bezierCurveTo(x + 2.6, y - 112.5, x + 4.6, y - 110.5, x + 3.6, y - 107); c.closePath(); c.fill(); c.stroke();
  ellipse(c, x, y - 113.2, 1.9, 0.7, "#c9a227");                                                           // waist ring
  c.beginPath();                                                                                            // upper bulb, smaller
  c.moveTo(x - 1.8, y - 113.6); c.bezierCurveTo(x - 2.9, y - 116, x - 1.6, y - 117.6, x - 0.7, y - 118);
  c.lineTo(x + 0.7, y - 118); c.bezierCurveTo(x + 1.6, y - 117.6, x + 2.9, y - 116, x + 1.8, y - 113.6); c.closePath(); c.fill(); c.stroke();
  poly(c, [[x - 0.9, y - 118], [x + 0.9, y - 118], [x, y - 121]], "#ffe082", "#b8902a", 0.5);             // the pointed knob
  circle(c, x - 1.3, y - 110.5, 0.9, "rgba(255,255,255,0.85)");                                            // highlight on the bulb                                                         // gold finial (the banner pole stands on it)
}

export function drawSign(c, x, y, face = { dc: 1, dr: 0 }) {
  const r = rng(Math.floor(x * 31 + y * 17));                                  // this post's own wear, the same every frame
  shadow(c, x, y + 12, 8, 3, 24);
  const lean = (r() - 0.5) * 0.12;                                             // the post leans a little
  c.save(); c.translate(x, y + 12); c.rotate(lean); c.translate(-x, -y - 12);
  rect(c, x - 2, y - 20, 4, 32, "#5d4037");
  line(c, x - 1, y - 14, x - 1, y + 2 + r() * 6, "rgba(40,25,18,0.5)", 0.8);  // a split running down the grain
  for (let i = 0; i < 3; i++) circle(c, x + (r() - 0.5) * 3, y - 16 + r() * 26, 0.9, "rgba(255,255,255,0.18)");   // weathered flecks
  circle(c, x, y + 9, 2.2, "rgba(90,140,60,0.5)"); circle(c, x + 2, y + 10, 1.4, "rgba(110,160,70,0.5)");         // moss at the foot
  const flip = face.dc < 0 ? -1 : 1;                                         // the board points the way the road goes
  const bx = (px) => x + (px + 3) * flip - 3;
  const tilt = (r() - 0.5) * 0.14, cx = bx(-3), cy = y - 17;                // the board hangs a touch crooked on one rusty nail
  c.translate(cx, cy); c.rotate(tilt); c.translate(-cx, -cy);
  const chip = r() < 0.6;                                                    // a corner has broken off
  const board = [[bx(-18), y - 24], [bx(12), y - 24], [bx(20), y - 17], [bx(12), y - 10], [bx(-18), y - 10]];
  if (chip) board[0] = [bx(-15), y - 24], board.splice(1, 0, [bx(-18), y - 21]);
  const grain = c.createLinearGradient(0, y - 24, 0, y - 10); grain.addColorStop(0, "#8d6e63"); grain.addColorStop(0.5, "#7e6155"); grain.addColorStop(1, "#8a6a5a");
  poly(c, board, grain, "rgba(60,36,28,0.6)", 0.9);
  for (let i = 0; i < 3; i++) line(c, bx(-16), y - 22 + i * 4.5 + r() * 2, bx(10 + r() * 6), y - 22 + i * 4.5 + (r() - 0.5) * 2, "rgba(60,36,28,0.25)", 0.7);   // wood grain
  ellipse(c, bx(-8 + r() * 14), y - 20 + r() * 7, 3 + r() * 3, 1.5 + r(), "rgba(40,25,15,0.12)");                 // a dark water stain
  if (r() < 0.5) line(c, bx(-6 + r() * 10), y - 24, bx(-8 + r() * 10), y - 17 - r() * 5, "rgba(40,25,18,0.45)", 0.8);   // a crack from the top edge
  circle(c, bx(-3), y - 22, 0.9, "#4e342e"); circle(c, bx(-3), y - 12, 0.9, "#4e342e");                           // nails
  line(c, bx(-3), y - 21, bx(-3), y - 18 - r() * 2, "rgba(140,70,30,0.45)", 1);                                     // rust running from the nail
  line(c, bx(-12), y - 17, bx(8), y - 17, "rgba(62,39,35,0.85)", 2);
  if (face.dr === 0) poly(c, [[bx(4), y - 21], [bx(10), y - 17], [bx(4), y - 13]], "rgba(62,39,35,0.85)");
  else poly(c, [[x - 3, y - 17 + face.dr * 4], [x - 7, y - 17 - face.dr * 2], [x + 1, y - 17 - face.dr * 2]], "rgba(62,39,35,0.85)");   // arrow up or down
  c.restore();
  // (the red flag on top is animated, drawn each frame in draw.js)
}

// The castle you are defending
// Style 0: a weathered grey stone keep with round corner towers under slate roofs.
// Style 1: a warm sandstone palace with square towers, terracotta tiled roofs and a green banner.
// Both have a gatehouse, battlements, arrow slits and a portcullis. Lit from the left, shaded on the right.
export const CASTLE_STYLES = [
  { light: "#b0aca4", dark: "#6e6a63", keepLight: "#a8a49c", keepDark: "#66625b", gateLight: "#9e9a92", gateDark: "#605c56", towerLight: "#b8b4ac", towerMid: "#8f8b84", towerDark: "#5a5650", roof: "#3f4a56", roofEdge: "#1f262d", roofShine: "rgba(140,160,180,0.35)", mortar: "rgba(40,36,32,0.35)", outline: "rgba(40,38,35,0.4)", banner: "#1565c0", square: false },
  { banner: "#2e7d32", palace: true },                                  // white desert palace with turquoise domes: drawn by drawPalace
  { banner: "#e53935", pagoda: true },                                 // Chinese palace: drawn by drawPagoda
];
function drawCastle(c, x, y, styleIndex = 0) {
  const S = CASTLE_STYLES[styleIndex] || CASTLE_STYLES[0];
  if (S.pagoda) return drawPagoda(c, x, y);
  if (S.palace) return drawPalace(c, x, y);
  const stone = (x0, y0, w, h, light = S.light, dark = S.dark) => {
    const g = c.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    rect(c, x0, y0, w, h, g, S.outline, 0.6);
  };
  const courses = (x0, y0, w, h, step = 7) => {               // stone block courses
    c.strokeStyle = S.mortar; c.lineWidth = 1;
    for (let yy = y0 + step; yy < y0 + h; yy += step) { c.beginPath(); c.moveTo(x0, yy); c.lineTo(x0 + w, yy); c.stroke(); }
    let row = 0;
    for (let yy = y0; yy < y0 + h; yy += step, row++) for (let xx = x0 + (row % 2) * 6 + 4; xx < x0 + w - 2; xx += 12) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, Math.min(yy + step, y0 + h)); c.stroke(); }
  };
  const battlements = (x0, y0, w, light, dark) => {           // merlons spaced to end flush with the wall's edges
    const n = Math.max(2, Math.ceil(w / 10)), step = (w - 4) / (n - 1);     // same count as before, slimmer merlons
    for (let i = 0; i < n; i++) stone(x0 + i * step, y0 - 7, 4, 8, light, dark);
  };
  const slit = (sx, sy) => { rect(c, sx - 1.2, sy, 2.4, 7, "#1b1b1b"); rect(c, sx - 2.5, sy + 2.5, 5, 2, "#1b1b1b"); };
  const roof = (tx, ty, w, h) => {                            // conical (or, for square towers, pyramid) roof with a lit side
    poly(c, [[tx - w, ty], [tx, ty - h], [tx + w, ty]], S.roof, S.roofEdge, 1);
    poly(c, [[tx - w, ty], [tx, ty - h], [tx - w * 0.15, ty]], S.roofShine);
    for (let i = 1; i < 4; i++) line(c, tx - w * (1 - i / 4), ty - h * i / 4, tx + w * (1 - i / 4), ty - h * i / 4, "rgba(0,0,0,0.25)", 1);
    circle(c, tx, ty - h, 1.6, S.square ? "#ffd54f" : "#b0bec5");
  };

  shadow(c, x, y + 6, 58, 11, 55);
  // Curtain wall
  stone(x - 44, y - 36, 88, 40);
  courses(x - 44, y - 36, 88, 40);
  battlements(x - 44, y - 36, 88);
  slit(x - 24, y - 26); slit(x + 24, y - 26);
  // Central keep rising behind the wall
  stone(x - 16, y - 70, 32, 36, S.keepLight, S.keepDark);
  courses(x - 16, y - 70, 32, 36);
  if (S.square) roof(x, y - 70, 18, 16); else battlements(x - 16, y - 70, 32, S.keepLight, S.keepDark);
  slit(x - 7, y - 62); slit(x + 7, y - 62);
  const glowWin = (wx, wy, w, h) => {                        // a warmly lit window
    const gg = c.createRadialGradient(wx + w / 2, wy + h / 2, 1, wx + w / 2, wy + h / 2, 9);
    gg.addColorStop(0, "rgba(255,210,120,0.45)"); gg.addColorStop(1, "rgba(255,210,120,0)");
    c.fillStyle = gg; c.fillRect(wx - 8, wy - 8, w + 16, h + 16);
    rect(c, wx, wy, w, h, "#ffcc80", "#3a3733", 0.8); line(c, wx + w / 2, wy, wx + w / 2, wy + h, "#3a3733", 0.8);
  };
  glowWin(x - 3, y - 50, 6, 7);                              // keep window
  if (S.square) { c.fillStyle = "#ffcc80"; c.beginPath(); c.arc(x, y - 50, 3, Math.PI, 0); c.fill(); }
  glowWin(x - 36, y - 20, 5, 6); glowWin(x + 31, y - 20, 5, 6);   // wall windows
  // Gatehouse: arched gate, portcullis, wooden doors
  stone(x - 13, y - 30, 26, 34, S.gateLight, S.gateDark);
  c.fillStyle = "#1b1b1b";
  c.beginPath(); c.arc(x, y - 12, 8, Math.PI, 0); c.lineTo(x + 8, y + 4); c.lineTo(x - 8, y + 4); c.closePath(); c.fill();
  c.fillStyle = S.square ? "#5d4037" : "#4e342e";
  c.beginPath(); c.arc(x, y - 12, 6.5, Math.PI, 0); c.lineTo(x + 6.5, y + 4); c.lineTo(x - 6.5, y + 4); c.closePath(); c.fill();
  line(c, x, y - 18, x, y + 4, "#2b1b14", 1);                  // door seam
  for (let i = -5; i <= 5; i += 2.5) line(c, x + i, y - 19, x + i, y - 8, "#263238", 1.2);   // portcullis bars
  line(c, x - 6, y - 14, x + 6, y - 14, "#263238", 1.2);
  circle(c, x - 2.5, y - 6, 0.8, "#ffd54f"); circle(c, x + 2.5, y - 6, 0.8, "#ffd54f");    // door rings
  c.strokeStyle = S.square ? "#c9a977" : "#8a8680"; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y - 12, 8.5, Math.PI, 0); c.stroke();   // arch stones
  // Heraldic shield above the gate in the banner colour, and a plank drawbridge laid down in front
  poly(c, [[x - 5, y - 29], [x + 5, y - 29], [x + 5, y - 24], [x, y - 20], [x - 5, y - 24]], S.banner, "#ffd54f", 1);
  line(c, x, y - 28, x, y - 21, "#ffd54f", 1); line(c, x - 4, y - 26, x + 4, y - 26, "#ffd54f", 1);
  rect(c, x - 8, y + 4, 16, 7, "#6d4c41", "#3e2723", 1); for (const px of [-5, -1.5, 2, 5.5]) line(c, x + px, y + 4, x + px, y + 11, "#4e342e", 1);
  line(c, x - 7, y + 4, x - 9, y - 6, "#8d6e63", 1); line(c, x + 7, y + 4, x + 9, y - 6, "#8d6e63", 1);     // chains
  // Corner towers: round with slate cones, or square with tiled pyramid roofs
  for (const tx of [x - 40, x + 40]) {
    const g = c.createLinearGradient(tx - 12, 0, tx + 12, 0);
    g.addColorStop(0, S.towerLight); g.addColorStop(0.55, S.towerMid); g.addColorStop(1, S.towerDark);
    rect(c, tx - 12, y - 64, 24, 68, g, S.outline, 0.6);
    courses(tx - 12, y - 64, 24, 68);
    if (S.square) { rect(c, tx - 14, y - 66, 28, 4, S.towerLight, S.outline, 0.7); roof(tx, y - 66, 16, 20); }   // ledge and pyramid roof
    else { battlements(tx - 12, y - 64, 24, S.towerLight, S.towerDark); roof(tx, y - 70, 15, 26); }
    slit(tx, y - 54); slit(tx, y - 34);
    // A pennant on each corner tower
    const top = S.square ? y - 86 : y - 96;
    line(c, tx, top + 2, tx, top - 10, "#3e2723", 1.2);
    poly(c, [[tx, top - 10], [tx + 9, top - 7], [tx, top - 4]], S.banner, "rgba(0,0,0,0.25)", 0.6);
  }
  // (the banner on the keep is animated, drawn each frame in draw.js)
  // Ivy creeping up the wall
  for (const [ix, iy] of [[x - 36, y - 10], [x - 33, y - 20], [x + 38, y - 14]]) { circle(c, ix, iy, 2.5, "#4a7a2a"); circle(c, ix + 2, iy - 3, 2, "#5b8f33"); }
}

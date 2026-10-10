import { W, H, ROAD_WIDTH } from "../config.js";
import { rng, pointsAlongPath, closestPointOnPath } from "../util.js";
import { map } from "../map.js";
import { rect, circle, ellipse, poly, line, shadow } from "./gfx.js";

// The scenery never changes, so we draw it once onto a hidden canvas
// and then just copy that picture every frame.
export function buildBackground() {
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const c = off.getContext("2d");
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
function drawRoad(c, rand, paths) {
  // Pre-compute the sample points and the wandering width of every route
  roadSamples = [];
  const roads = paths.map((path) => {
    const pts = pointsAlongPath(path, 4);
    pts.push({ ...path[path.length - 1], nx: 0, ny: 1 });
    const ph1 = rand() * 6, ph2 = rand() * 6;
    let w = pts.map((_, i) => ROAD_WIDTH * (0.82 + 0.2 * Math.sin(i * 0.06 + ph1) + 0.1 * Math.sin(i * 0.19 + ph2)) + (rand() - 0.5) * 6);
    for (let pass = 0; pass < 3; pass++) w = w.map((v, i) => (w[Math.max(0, i - 1)] + v + w[Math.min(w.length - 1, i + 1)]) / 3);
    pts.forEach((p, i) => roadSamples.push({ x: p.x, y: p.y, w: w[i] }));
    return { path, pts, w };
  });
  // Is this point on the surface of one of the OTHER routes? (used to keep edge details off junctions)
  const onOtherRoad = (k, p) => roads.some((r, j) => j !== k && closestPointOnPath(r.path, p).d < ROAD_WIDTH / 2 - 2);

  // One layer = a chain of short strokes along EVERY route, so where routes meet the layers merge
  // into one surface with no bank line between them. scale/extra shape the layer, dy sinks it.
  const layer = (color, scale, extra, dy = 0, skip = 0) => {
    c.strokeStyle = color; c.lineCap = "round"; c.lineJoin = "round";
    for (const { pts, w } of roads) {
      for (let i = 0; i < pts.length - 1; i++) {
        if (skip && rand() < skip) continue;                        // patchy layers leave gaps
        c.lineWidth = Math.max(2, w[i] * scale + extra + (skip ? (rand() - 0.5) * 8 : 0));
        c.beginPath(); c.moveTo(pts[i].x, pts[i].y + dy); c.lineTo(pts[i + 1].x, pts[i + 1].y + dy); c.stroke();
      }
    }
  };
  layer("rgba(190,235,120,0.2)", 1, 10, 4, 0.45);                // faint, broken patches of lit grass along the lower lip
  layer("#5d4037", 1, 8);                                        // earthen banks
  layer("#7a5230", 1, 0);                                        // shaded base
  layer("#a1703f", 1, -6, 5);                                    // surface, leaving a shadow band along the upper bank
  layer("#b8864f", 1, -20, 6);                                   // worn centre

  roads.forEach(({ pts, w }, k) => {
    // Rough the edges: lumps of earth bulging out, grass creeping in, so the outline is ragged
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i], half = w[i] / 2;
      if (rand() < 0.45) {
        const side = rand() < 0.5 ? 1 : -1, o = side * (half + 1 + rand() * 4);
        const q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
        if (!onOtherRoad(k, q)) ellipse(c, q.x, q.y, 3 + rand() * 5, 2 + rand() * 3, rand() < 0.5 ? "#5d4037" : "#7a5230");
      }
      if (rand() < 0.4) {
        const side = rand() < 0.5 ? 1 : -1, o = side * (half + 2 - rand() * 6);
        const q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
        if (!onOtherRoad(k, q)) ellipse(c, q.x, q.y, 3 + rand() * 4, 2 + rand() * 2.5, rand() < 0.5 ? "#4f8a2c" : "#6fae3e");
      }
    }
    // Surface texture: dark blotches, pebbles, wheel-worn patches and grass tufts along the edges
    for (const [i, p] of pts.entries()) {
      const half = w[i] / 2;
      if (rand() < 0.4) {
        const o = (rand() - 0.5) * (w[i] - 10);
        ellipse(c, p.x + p.nx * o, p.y + p.ny * o + 3, 3 + rand() * 5, 2 + rand() * 3, `rgba(80,50,30,${0.08 + rand() * 0.1})`);
      }
      if (rand() < 0.15) {
        const o = (rand() - 0.5) * (w[i] - 12);
        circle(c, p.x + p.nx * o, p.y + p.ny * o + 3, 1 + rand() * 1.6, rand() < 0.5 ? "#8d8d8d" : "#c2a98a");
      }
      if (rand() < 0.08) {
        const o = (rand() - 0.5) * (w[i] - 16);
        ellipse(c, p.x + p.nx * o, p.y + p.ny * o + 3, 5 + rand() * 6, 2 + rand() * 2, "rgba(255,230,180,0.12)");
      }
      if (rand() < 0.3) {
        const o = (rand() < 0.5 ? 1 : -1) * (half + 2 + rand() * 4);
        const q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
        if (!onOtherRoad(k, q)) for (let kk = -1; kk <= 1; kk++) line(c, q.x, q.y, q.x + kk * 3, q.y - 5 - rand() * 3, "#2f6b1f", 1.5);
      }
    }
  });
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
  for (let i = 0; i < 6; i++) {                                         // pebbles on the bank
    const a = rand() * Math.PI * 2, d = 2 + rand() * 5;
    circle(c, p.x + Math.cos(a) * (p.rx + d), p.y + Math.sin(a) * (p.ry + d), 1 + rand() * 1.5, rand() < 0.5 ? "#9e9e9e" : "#c2b280");
  }
}

function drawRiver(c, r, rand, pass) {
  const pts = r.points;
  // Smooth sideways normals at every point (average of the two neighbouring segments)
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
  // Fill the band between the two banks, scaled to a fraction of the local width, shifted sideways if asked
  const band = (scale, color, extra = 0, shift = 0) => {
    const sc = (i) => (typeof scale === "function" ? scale(i) : scale);
    c.fillStyle = color;
    c.beginPath();
    pts.forEach((p, i) => { const o = p.w * sc(i) / 2 + extra + shift; const x = p.x + normals[i].x * o, y = p.y + normals[i].y * o; i ? c.lineTo(x, y) : c.moveTo(x, y); });
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], o = -(p.w * sc(i) / 2 + extra) + shift; c.lineTo(p.x + normals[i].x * o, p.y + normals[i].y * o); }
    c.closePath();
    c.fill();
  };
  if (pass === 0) {
    band(1, "rgba(60,90,35,0.55)", 7);                                // damp bank
    band(1, "#5c4a33", 3);                                            // mud edge
    return;
  }
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
}

// A wooden plank bridge carrying the road over a river
function drawBridge(c, b) {
  c.save();
  c.translate(b.x, b.y);
  c.rotate(b.angle);
  const half = b.span / 2, dx = Math.cos(b.angle), dy = Math.sin(b.angle);
  // The deck follows the road's own wandering width: sample the drawn road along the bridge
  const halfAt = (t) => {
    const px = b.x + dx * t, py = b.y + dy * t;
    let best = null, bd = Infinity;
    for (const s of roadSamples) { const d = (s.x - px) ** 2 + (s.y - py) ** 2; if (d < bd) { bd = d; best = s; } }
    return (best ? best.w : ROAD_WIDTH) / 2 + 8;   // past the earthen bank, so no road peeks out
  };
  const steps = Math.max(4, Math.round(b.span / 6)), top = [], bot = [];
  for (let i = 0; i <= steps; i++) { const t = -half - 3 + (i / steps) * (b.span + 6); const hw = halfAt(t); top.push([t, -hw]); bot.push([t, hw]); }
  const deck = [...top, ...bot.slice().reverse()];
  c.globalAlpha = 0.25; poly(c, deck.map(([x, y]) => [x, y + 3]), "#000"); c.globalAlpha = 1;   // shadow onto the water
  poly(c, deck, "#8d6e63", "#4e342e", 1.5);                                                 // deck
  for (let i = 1; i < steps; i++) { const [x, y0] = top[i], y1 = bot[i][1]; line(c, x, y0 + 1, x, y1 - 1, "#6d4c41", 1.2); }   // planks
  for (const side of [-1, 1]) {                                                             // rails and posts, hugging the deck edge
    c.strokeStyle = "#5d4037"; c.lineWidth = 3; c.lineCap = "round"; c.beginPath();
    (side < 0 ? top : bot).forEach(([x, y], i) => (i ? c.lineTo(x, y - side * 2) : c.moveTo(x, y - side * 2))); c.stroke();
    for (let i = 0; i <= steps; i += 2) { const [x, y] = (side < 0 ? top : bot)[i]; rect(c, x - 2, y - side * 2 - 6, 4, 12, "#6d4c41", "#3e2723", 0.8); }
  }
  c.restore();
}

// ---------- Scenery ----------
// Every function gets a size, a variant (0-2) and its own random generator, so no two pieces look alike.
export function drawDecoItem(c, d) {
  const s = d.s || 1;
  castShadow(c, d.x, d.y, d.type === "tree" ? 16 * s : d.type === "flower" || d.type === "mushroom" ? 0 : 9 * s, d.type === "tree" ? 22 * s : 6);
  DRAW_DECO[d.type](c, d.x, d.y, s, d.variant || 0, rng(d.seed || 1));
}
// Age marks on a wall region: a hairline crack or two, a damp stain, a few chipped flecks and moss at the foot
function wearOut(c, r, regions) {
  for (const [x0, y0, w, h] of regions) {
    for (let n = 0; n < 1 + Math.floor(r() * 2); n++) {                                 // cracks
      let cx = x0 + w * (0.15 + r() * 0.7), cy = r() < 0.5 ? y0 : y0 + h;
      const dir = cy === y0 ? 1 : -1, len = h * (0.25 + r() * 0.3);
      c.strokeStyle = "rgba(0,0,0,0.28)"; c.lineWidth = 0.8; c.lineCap = "round"; c.beginPath(); c.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) { cx += (r() - 0.5) * 4; cy += dir * len / 4; c.lineTo(cx, cy); }
      c.stroke();
    }
    for (let n = 0; n < 2; n++) ellipse(c, x0 + w * (0.2 + r() * 0.6), y0 + h * (0.3 + r() * 0.6), w * (0.08 + r() * 0.12), h * (0.1 + r() * 0.15), "rgba(30,20,10,0.08)");   // damp stains
    for (let n = 0; n < 4; n++) circle(c, x0 + w * r(), y0 + h * r(), 0.7 + r() * 0.6, "rgba(255,255,255,0.22)");                                                         // chipped flecks
    if (h > 12) for (let n = 0; n < 2; n++) ellipse(c, x0 + w * (0.1 + r() * 0.8), y0 + h - 1.5 - r() * 2, 2.5 + r() * 3, 1.2 + r() * 1.2, "rgba(90,140,60,0.4)");       // moss at the foot
  }
}
export function drawCastleAt(c, k) {
  castShadow(c, k.x, k.y, 50 * k.scale, 90 * k.scale);
  c.save(); c.translate(k.x, k.y); c.scale(k.scale, k.scale);
  drawCastle(c, 0, 0, k.style);
  const r = rng(Math.floor(k.x * 13 + k.y * 7));
  const S = CASTLE_STYLES[k.style] || CASTLE_STYLES[0];
  if (S.pagoda) wearOut(c, r, [[-38, -34, 76, 20], [-28, -60, 56, 10], [-56, -3, 112, 6], [-46, -10, 92, 6]]);
  else if (S.palace) wearOut(c, r, [[-44, -36, 88, 40], [-18, -60, 36, 26]]);
  else wearOut(c, r, [[-44, -36, 88, 40], [-16, -70, 32, 36], [-52, -64, 24, 68], [28, -64, 24, 68]]);
  c.restore();
}

const DRAW_DECO = {
  tree(c, x, y, s, v, r) {
    if (v === 1) s *= 1.35;                                                  // pines grow tall
    shadow(c, x, y + 4 * s, 14 * s, 5 * s);
    if (v === 0) {                                                           // broadleaf: a knobbly canopy of blobs
      const trunk = ["#6d4c41", "#5d4037", "#795548"][Math.floor(r() * 3)];
      rect(c, x - 3 * s, y - 10 * s, 6 * s, 14 * s, trunk);
      line(c, x - 1 * s, y - 8 * s, x - 5 * s, y - 14 * s, trunk, 2.5 * s);
      const tint = Math.floor(r() * 3), dark = ["#2e7d32", "#33691e", "#1b5e20"][tint], light = ["#43a047", "#558b2f", "#2e7d32"][tint];
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
        if (r() < 0.35) line(c, x + (r() < 0.5 ? -1 : 1) * lw * 0.9, ty - 1 * s, x + (r() < 0.5 ? -1 : 1) * (lw + 3 * s), ty + 1 * s, "#0d3d12", 1.2);   // a stray branch
      }
      if (r() < 0.3) for (let i = 0; i < 3; i++) circle(c, x + (r() - 0.5) * 10 * s, y - 12 * s - r() * 14 * s, 1.1 * s, "#8d6e63");   // cones
    } else if (v === 3) {                                                    // cherry: dark trunk, a cloud of blossom in its own shade of pink
      rect(c, x - 2.5 * s, y - 10 * s, 5 * s, 14 * s, "#4e342e");
      line(c, x - 1 * s, y - 9 * s, x - 6 * s, y - 15 * s, "#4e342e", 2 * s); line(c, x + 1 * s, y - 10 * s, x + 6 * s, y - 15 * s, "#4e342e", 2 * s);
      const hue = 330 + (r() - 0.5) * 30, sat = 55 + r() * 35, lit = 68 + r() * 12;                       // from peach-pink to magenta, pale to vivid
      const pink = (dl, ds = 0) => `hsl(${hue},${sat + ds}%,${lit + dl}%)`;
      const blobs = 5 + Math.floor(r() * 3);
      for (let i = 0; i < blobs; i++) { const a = r() * Math.PI * 2, d = r() * 8 * s; circle(c, x + Math.cos(a) * d, y - 18 * s + Math.sin(a) * d * 0.7, (6 + r() * 4) * s, pink(r() < 0.5 ? -6 : 2)); }
      circle(c, x + (r() - 0.5) * 4 * s, y - 22 * s, (7 + r() * 3) * s, pink(12, -15));
      for (let i = 0; i < 5; i++) circle(c, x + (r() - 0.5) * 20 * s, y - 16 * s + (r() - 0.5) * 12 * s, 1.1 * s, pink(-20, 10));   // deeper blossoms
      for (let i = 0; i < 3; i++) circle(c, x + (r() - 0.5) * 26 * s, y - 2 * s + r() * 3, 1 * s, pink(4));                        // fallen petals
    } else if (v === 4) {                                                    // autumn: a canopy turned gold, orange or red, leaves on the ground
      const trunk = ["#5d4037", "#4e342e", "#6d4c41"][Math.floor(r() * 3)];
      rect(c, x - 3 * s, y - 10 * s, 6 * s, 14 * s, trunk);
      line(c, x + 1 * s, y - 8 * s, x + 5 * s, y - 14 * s, trunk, 2.5 * s);
      const pal = [["#e65100", "#ff8f00", "#ffb300"], ["#f9a825", "#fdd835", "#fff176"], ["#bf360c", "#d84315", "#ff7043"], ["#ef6c00", "#f9a825", "#c62828"]][Math.floor(r() * 4)];
      const blobs = 4 + Math.floor(r() * 3), thin = r() < 0.35;             // some have already dropped half their leaves
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
    } else {                                                                 // birch: pale trunk with bands, airy light canopy
      rect(c, x - 2.5 * s, y - 14 * s, 5 * s, 18 * s, "#eceff1", "#9e9e9e", 0.6);
      for (let i = 0; i < 4; i++) line(c, x - 2.5 * s, y - 12 * s + i * 4 * s + r() * 2, x + 2.5 * s, y - 11 * s + i * 4 * s, "#424242", 1);
      const blobs = 5 + Math.floor(r() * 3);
      for (let i = 0; i < blobs; i++) { const a = r() * Math.PI * 2, d = r() * 8 * s; circle(c, x + Math.cos(a) * d, y - 22 * s + Math.sin(a) * d * 0.8, (5 + r() * 4) * s, r() < 0.5 ? "#9ccc65" : "#aed581"); }
      circle(c, x - 2 * s, y - 26 * s, 3.5 * s, "rgba(255,255,255,0.2)");
    }
  },
  leaves(c, x, y, s, v, r) {                                                 // a drift of fallen leaves lying flat on the grass
    const pal = [["#e65100", "#ff8f00", "#bf360c", "#ffb300"], ["#f9a825", "#fdd835", "#ef6c00", "#c0652a"], ["#c62828", "#d84315", "#ff7043", "#f9a825"]][v];
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
      ellipse(c, px, py, pr, pr * 0.7, greys[0], "rgba(60,60,60,0.5)", 0.6);
      ellipse(c, px - pr * 0.25, py - pr * 0.25, pr * 0.45, pr * 0.3, greys[1]);
    }
  },
  rock(c, x, y, s, v, r) {
    shadow(c, x, y + 5 * s, 12 * s, 4 * s);
    const greys = [["#8d8d8d", "#5f5f5f", "#aaaaaa"], ["#9e9789", "#6b655a", "#bdb5a6"], ["#7d8a92", "#4f5a61", "#9fadb5"]][v];
    const n = 5 + Math.floor(r() * 3), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rad = (6 + r() * 6) * s; pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.65]); }
    poly(c, pts, greys[0], greys[1], 0.7);
    poly(c, pts.slice(0, Math.ceil(n / 2)).map(([px, py]) => [x + (px - x) * 0.55, y - 3 * s + (py - y) * 0.45]), greys[2]);   // lit top facet
    if (r() < 0.5) line(c, x - 3 * s, y + 1 * s, x + 2 * s, y - 3 * s, greys[1], 1);                                           // crack
    if (r() < 0.5) { circle(c, x + (r() - 0.5) * 8 * s, y + 2 * s, 2.2 * s, "#5b8f33"); circle(c, x + (r() - 0.5) * 8 * s, y - 2 * s, 1.5 * s, "#6ea83f"); }   // moss
    if (r() < 0.4) { const sx = x + 10 * s, sy = y + 3 * s; poly(c, [[sx - 3 * s, sy + 2 * s], [sx, sy - 2 * s], [sx + 4 * s, sy + 1 * s], [sx + 2 * s, sy + 3 * s]], greys[0], greys[1], 0.8); }   // a smaller stone beside it
  },
  bush(c, x, y, s, v, r) {
    shadow(c, x, y + 6 * s, 12 * s, 4 * s);
    const greens = r() < 0.22 ? [["#8d4a1e", "#c0652a"], ["#a0521f", "#d98c3a"], ["#7a3e1a", "#b8641f"]][v]      // some bushes have turned russet
      : [["#33691e", "#558b2f"], ["#2e7d32", "#43a047"], ["#4e6b1f", "#6b8e23"]][v];
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) circle(c, x + (i - (n - 1) / 2) * 6 * s + (r() - 0.5) * 3, y + (r() - 0.5) * 3, (6 + r() * 3) * s, greens[0]);
    circle(c, x + (r() - 0.5) * 4, y - 5 * s, (6 + r() * 3) * s, greens[1]);
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
  mushroom(c, x, y, s, v, r) {
    const caps = [["#d84315", "#fff"], ["#8d6e63", "#efebe9"], ["#c62828", "#fff"]][v];
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const mx = x + (k ? (r() - 0.5) * 12 : 0), my = y + (k ? (r() - 0.5) * 4 : 0), ms = s * (0.6 + r() * 0.6);
      shadow(c, mx, my + 2, 4 * ms, 1.5 * ms);
      rect(c, mx - 1.8 * ms, my - 6 * ms, 3.6 * ms, 7 * ms, "#f5f5dc", "#bcaaa4", 0.6);
      ellipse(c, mx, my - 6 * ms, 5.5 * ms, 3.5 * ms, caps[0], "#4e342e", 0.7);
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
export function drawLairStructure(c, e) {
  for (const s of lairStakes(e)) {                                              // skull stakes
    castShadow(c, s.x, s.y + 2, 5, 22);
    line(c, s.x, s.y + 4, s.x, s.y - 30, "#4e342e", 4); line(c, s.x - 1, s.y + 4, s.x - 1, s.y - 30, "#6d4c41", 1.5);
    for (let k = 0; k < 3; k++) line(c, s.x - 5, s.y - 8 - k * 7, s.x + 5, s.y - 10 - k * 7, "#8d6e63", 1.2);   // rope wraps
    circle(c, s.x, s.y - 35, 6, "#eeeeee", "#9e9e9e", 1);
    circle(c, s.x - 2.2, s.y - 36, 1.6, "#1b1b1b"); circle(c, s.x + 2.2, s.y - 36, 1.6, "#1b1b1b");
    line(c, s.x - 2.5, s.y - 31, s.x + 2.5, s.y - 31, "#9e9e9e", 1); for (let k = -1; k <= 1; k++) line(c, s.x + k * 1.6, s.y - 32, s.x + k * 1.6, s.y - 30, "#9e9e9e", 1);
  }
  // A dead tree leaning over the road, on the signpost's far side
  const { x: tx, y: ty } = lairTreePos(e);
  castShadow(c, tx, ty, 8, 26);
  line(c, tx, ty, tx + 3, ty - 34, "#3e2723", 6);
  line(c, tx + 1, ty - 18, tx - 14, ty - 32, "#3e2723", 3.5); line(c, tx + 2, ty - 26, tx + 16, ty - 40, "#3e2723", 3);
  line(c, tx - 14, ty - 32, tx - 20, ty - 42, "#3e2723", 2); line(c, tx + 16, ty - 40, tx + 22, ty - 44, "#3e2723", 1.8); line(c, tx + 3, ty - 34, tx + 1, ty - 48, "#3e2723", 2.5);
  circle(c, tx - 20, ty - 42, 2.2, "#1b1b1b"); circle(c, tx + 23, ty - 45, 2.2, "#1b1b1b");                  // crows
}

// The exit gate: two stone pillars either side of the road where it leaves the map, with chevrons on the
// road pointing out through it. The torches and banner on top are animated, drawn each frame in draw.js.
export const GATE_SPAN = ROAD_WIDTH / 2 + 14;
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
    rect(c, p.x - 7, p.y - 2, 14, 7, "#8d8d8d", "#4e4e4e", 1);           // stone base
    const grad = c.createLinearGradient(p.x - 5, 0, p.x + 5, 0);
    grad.addColorStop(0, "#c4544a"); grad.addColorStop(0.5, "#a8382f"); grad.addColorStop(1, "#7a2420");
    rect(c, p.x - 5, p.y - 40, 10, 38, grad, "#5a1a16", 1);              // red lacquered post
    rect(c, p.x - 6, p.y - 44, 12, 5, "#c9a227", "#8a6a00", 0.8);          // gold cap
    if (!across) roof(p.x, p.y - 48, 9);                                  // a little roof on each post
  }
  if (across) {
    const lx = Math.min(a.x, b.x), rx = Math.max(a.x, b.x), cy = a.y;
    rect(c, lx - 4, cy - 50, rx - lx + 8, 7, "#a8382f", "#5a1a16", 1);     // crossbeam
    for (let x = lx + 2; x < rx - 2; x += 8) rect(c, x, cy - 49, 3, 5, "#ffd54f");   // gold studs
    rect(c, (lx + rx) / 2 - 13, cy - 52, 26, 10, "#1a237e", "#0d1545", 1);   // name board
    line(c, (lx + rx) / 2 - 9, cy - 47, (lx + rx) / 2 + 9, cy - 47, "#ffd54f", 1.4);
    roof((lx + rx) / 2, cy - 56, (rx - lx) / 2 + 6);
  }
}




// A Moorish gate for the desert palace: cream posts with turquoise tile bands and onion-dome caps tipped
// with gold; when the posts stand side by side a horseshoe arch spans the road between them.
function drawMoorishGate(c, g) {
  const [a, b] = gatePillars(g);
  const across = Math.abs(a.y - b.y) < 1;
  const wall = "#f1e6d0", wallDark = "#cdbb9a", edge = "#8d7a58", teal = "#2a9d8f", tealDark = "#1b6f66", tealLight = "#5fc4b6", gold = "#e9c55a", goldDark = "#b8902a";
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
    rect(c, p.x - 8, p.y - 39, 16, 3, wall, edge, 1);                        // cap ledge
    dome(p.x, p.y - 39, 7);
  }
}

// A desert palace: cream walls with a scalloped parapet and horseshoe arches, two slender minaret towers with
// little balconies, and turquoise onion domes tipped with gold. The big central dome carries the banner.
function drawPalace(c, x, y) {
  const wall = "#f1e6d0", wallDark = "#cdbb9a", edge = "#8d7a58", teal = "#2a9d8f", tealDark = "#1b6f66", tealLight = "#5fc4b6", gold = "#e9c55a", goldDark = "#b8902a";
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
  shadow(c, x, y + 6, 58, 11);
  // Main block with a scalloped parapet
  rect(c, x - 44, y - 36, 88, 40, wall, edge, 1.2);
  const lg = c.createLinearGradient(x - 44, 0, x + 44, 0); lg.addColorStop(0, "rgba(255,255,255,0.25)"); lg.addColorStop(1, "rgba(80,60,30,0.2)");
  rect(c, x - 44, y - 36, 88, 40, lg);
  for (let sx = x - 42; sx <= x + 42; sx += 8) { c.fillStyle = wall; c.beginPath(); c.arc(sx, y - 36, 4, Math.PI, 0); c.fill(); c.strokeStyle = edge; c.lineWidth = 1; c.stroke(); }
  line(c, x - 44, y - 28, x + 44, y - 28, teal, 2);                       // tile band
  for (let sx = x - 40; sx <= x + 40; sx += 8) rect(c, sx - 1.5, y - 29, 3, 2, gold);
  arch(x, y + 4, 16, 28);                                                  // great door
  for (const ax of [-28, 28]) { arch(x + ax, y - 8, 8, 16); }               // side arches
  rect(c, x - 10, y + 4, 20, 4, "#d9cbb0", edge, 0.8);                     // step
  // Central drum and great dome
  rect(c, x - 18, y - 60, 36, 26, wall, edge, 1.2);
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
  // A courtyard fountain before the door: an octagonal basin of blue tile
  const fy = y + 17;
  c.fillStyle = wall; c.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; const px = x + Math.cos(a) * 12, py = fy + Math.sin(a) * 6; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); c.strokeStyle = edge; c.lineWidth = 1; c.stroke();
  ellipse(c, x, fy, 9, 4.2, "#4a93c4", tealDark, 0.8);
  circle(c, x, fy - 1, 2, wall, edge, 0.6);                                                      // central spout
  // Minarets
  for (const tx of [x - 40, x + 40]) {
    const tg = c.createLinearGradient(tx - 7, 0, tx + 7, 0); tg.addColorStop(0, "#f6ecd8"); tg.addColorStop(1, wallDark);
    rect(c, tx - 7, y - 78, 14, 82, tg, edge, 1.2);
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
  const red = "#a8382f", redDark = "#7a2420", redDeep = "#8e2f29", gold = "#e9c55a", goldDark = "#b8902a";
  const blue = "#2d4e9e", blueDark = "#1c3470", blueLight = "#4a6fc2";
  shadow(c, x, y + 6, 60, 11);
  // Marble terrace: three wide round tiers with balustrades, a stair up the middle
  for (const [hw, hh, ty] of [[56, 8, y + 3], [46, 7, y - 4], [36, 6, y - 10]]) {
    ellipse(c, x, ty, hw, hh, "#e6e2da", "#b8b2a6", 1);
    rect(c, x - hw, ty - 6, hw * 2, 6, "#efece5", "#b8b2a6", 0.8);
    ellipse(c, x, ty - 6, hw, hh, "#f5f2ec", "#b8b2a6", 1);
    for (let i = -hw + 4; i <= hw - 4; i += 6) rect(c, x + i - 0.8, ty - 12, 1.6, 6, "#d9d4ca");         // balustrade posts
    line(c, x - hw + 3, ty - 12, x + hw - 3, ty - 12, "#c9c3b6", 1.4);                                  // rail
  }
  rect(c, x - 6, y - 2, 12, 12, "#d9d4ca", "#b8b2a6", 0.8); for (let s = 0; s < 4; s++) line(c, x - 6, y + s * 3, x + 6, y + s * 3, "#b8b2a6", 0.8);
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
    c.closePath(); c.fill(); c.strokeStyle = blueDark; c.lineWidth = 1; c.stroke();
    for (let k = -3; k <= 3; k++) { const t = k / 3.6; line(c, x + t * topHw, top + 1, x + t * hw * 0.92, base + 1, "rgba(28,52,112,0.45)", 1); }   // tile seams fanning down
    line(c, x - hw - 3, base + 1, x + hw + 3, base + 1, goldDark, 1.2);                                  // gold eave
    ellipse(c, x, top, topHw, 1.6, goldDark);                                                             // gold ring at the top
  };
  // Lower hall: a wide red drum with doors
  rect(c, x - 38, y - 34, 76, 20, red, redDark, 1.2);
  ellipse(c, x, y - 14, 38, 5, redDeep, redDark, 1);
  line(c, x - 38, y - 31, x + 38, y - 31, goldDark, 1.4);
  for (const dx of [-27, -9, 9, 27]) { rect(c, x + dx - 4, y - 29, 8, 13, "#5a1a16", gold, 0.9); line(c, x + dx, y - 29, x + dx, y - 16, gold, 0.7); line(c, x + dx - 4, y - 23, x + dx + 4, y - 23, gold, 0.7); }
  cone(y - 36, 50, y - 50, 32);
  // Middle drum and roof
  rect(c, x - 28, y - 60, 56, 10, red, redDark, 1.2); line(c, x - 28, y - 57, x + 28, y - 57, goldDark, 1.2);
  for (const dx of [-15, 0, 15]) rect(c, x + dx - 2.5, y - 56, 5, 6, "#5a1a16", gold, 0.6);
  cone(y - 62, 40, y - 75, 21);
  // Upper drum and the top cone
  rect(c, x - 18, y - 83, 36, 8, red, redDark, 1.2); line(c, x - 18, y - 80, x + 18, y - 80, goldDark, 1);
  cone(y - 85, 28, y - 100, 4);
  const fg = c.createRadialGradient(x - 1, y - 104, 0.5, x, y - 103, 4);
  fg.addColorStop(0, "#fff8dc"); fg.addColorStop(0.5, "#ffd54f"); fg.addColorStop(1, "#c9a227");
  circle(c, x, y - 103, 3.6, fg, "#b8902a", 0.8);                                                        // bright gold finial (it glints live in draw.js)
  circle(c, x - 1.2, y - 104.2, 1, "rgba(255,255,255,0.9)");                                                         // gold finial (the banner pole stands on it)
}

export function drawSign(c, x, y, face = { dc: 1, dr: 0 }) {
  const r = rng(Math.floor(x * 31 + y * 17));                                  // this post's own wear, the same every frame
  shadow(c, x, y + 12, 8, 3);
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
  { light: "#b0aca4", dark: "#6e6a63", keepLight: "#a8a49c", keepDark: "#66625b", gateLight: "#9e9a92", gateDark: "#605c56", towerLight: "#b8b4ac", towerMid: "#8f8b84", towerDark: "#5a5650", roof: "#3f4a56", roofEdge: "#1f262d", roofShine: "rgba(140,160,180,0.35)", mortar: "rgba(40,36,32,0.35)", outline: "rgba(40,38,35,0.65)", banner: "#1565c0", square: false },
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
    rect(c, x0, y0, w, h, g, S.outline, 0.8);
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

  shadow(c, x, y + 6, 58, 11);
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
    rect(c, tx - 12, y - 64, 24, 68, g, S.outline, 0.8);
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

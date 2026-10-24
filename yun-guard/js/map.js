import { W, H, ROWS, COLS, CELL, ROAD_WIDTH, ROAD_EDGE, SPOT_RADIUS } from "./config.js";
import { rng, dist, closestPointOnPath, clamp, arcLengthAt, pointAtArc, pointsAlongPath } from "./util.js";

// The generated world. Filled in by generateMap() before anything else runs.
export const map = {
  seed: 0,
  path: [],        // the main road's corner points, from off-screen at its entry edge to off-screen at its exit edge
  paths: [],       // every route monsters can take (1 or 2); the main road is paths[0]
  routes: [],      // each route as grid cells plus its entry/exit edge
  entries: [],     // where each route enters the map (one signpost each)
  spots: [],       // where towers can be built
  rivers: [],      // each: { points, width } - winding streams across the grass
  ponds: [],       // small still pools on the grass: { x, y, rx, ry, wobble[] }
  bridges: [],     // where the road crosses a river: { x, y, angle, span }
  deco: [],        // trees, rocks, bushes, flowers
  critters: [],    // animal home spots
  entry: null,     // where the signpost goes
  castle: null,    // the main road's castle (castles[0])
  exits: [],       // gates where the roads leave the map: { x, y, out }
  castles: [],     // one castle per exit: { x, y, scale, style } - style 0 is grey stone, 1 is a sandstone palace
  exit: null,      // last point of the road
};

// Roads keep to the middle rows, leaving the same two-cell margin at the top and the bottom. The margins are
// drawn exactly like the rest of the map (grass, rivers, ponds, scenery, weather) and give tall towers room.
const ROAD_MIN_ROW = 2, ROAD_MAX_ROW = ROWS - 3;
// The same margin on the left and right: roads only bend in the middle columns, and cross the margins as
// straight entries and exits that run to the edge of the map.
const ROAD_MIN_COL = 2, ROAD_MAX_COL = COLS - 3;

export function generateMap(seed, opts = {}) {
  const rand = rng(seed);
  map.seed = seed;
  map.opts = { spots: 20, secondRoute: 0.85, ...opts };            // how much world this level gets (see levels.js)

  // Lay out the roads: a main route, then the extra routes this level asks for. An extra route can fork off a
  // road and rejoin it, come in from its own entrance and merge, fork off to its own exit, or run separately.
  // Some main roads leave no room for branches, so when the level insists on a minimum number of roads the
  // whole layout is tried again (keeping the best so far).
  const chance = (ps) => ps.reduce((n, q) => n + (rand() < q ? 1 : 0), 1);             // 1, plus one for every chance that comes up
  const minIn = chance(map.opts.entryChances || []), minOut = chance(map.opts.exitChances || []);
  const wanted0 = (map.opts.extraRoutes || [map.opts.secondRoute || 0, map.opts.thirdRoute || 0]).reduce((n, p) => n + (rand() < p ? 1 : 0), 0);   // roads beyond the main one
  const wanted = Math.max(wanted0, minIn - 1, minOut - 1);
  const need = Math.min(1 + wanted, Math.max(map.opts.minRoutes || 1, minIn, minOut));
  let keepMain = null;
  const layout = (reuse) => {
    const main = reuse && keepMain ? keepMain : (keepMain = generateMainRoute(rand));       // retries first try other branches off the same main road (far cheaper than a new one)
    const routes = [main], paths = [cellsToWaypoints(main.cells, rand)];
    map.routes = routes; map.paths = paths;                                       // the kinds below read map.paths / map.routes
    let allCells = main.cells;
    for (let n = 0; n < wanted; n++) {
      const ends = routes.flatMap((r) => [r.entry, r.exit]).filter(Boolean);
      let added = null;
      for (let round = 0; round < (map.opts.rounds || 3) && !added; round++) {   // several tries, each with the kinds in a fresh order
        const count = (k) => new Set(routes.map((r) => r[k].edge + ":" + r[k].pos)).size;
        const needIn = count("entry") < (minIn), needOut = count("exit") < (minOut);
        const kinds = round >= 2 || !(needIn || needOut) ? [forkAndRejoin, separateEntry, forkToExit, separateRoute]   // levels that want several entrances / exits ask for them first
          : needIn && needOut ? [separateRoute] : needIn ? [separateEntry, separateRoute] : [forkToExit, separateRoute];
        shuffle(kinds, rand);
        for (const make of kinds) {
          const from = routes[Math.floor(rand() * routes.length)];                // branch off any road so far
          added = make(from, rand, allCells, ends);
          if (added) break;
        }
      }
      if (!added) continue;                                                       // no room for this one; still try for the next
      routes.push(added); paths.push(cellsToWaypoints(added.cells, rand)); allCells = [...allCells, ...added.cells];
    }
    return { routes, paths, allCells };
  };
  const distinct = (l, k) => new Set(l.routes.map((r) => r[k].edge + ":" + r[k].pos)).size;
  const layoutScore = (l) => l.routes.length + 2 * Math.min(minIn, distinct(l, "entry")) + 2 * Math.min(minOut, distinct(l, "exit"));
  const enough = (l) => l.routes.length >= need && layoutScore(l) >= need + 2 * (minIn) + 2 * (minOut);
  let best = layout();
  for (let attempt = 1; attempt < 5 && !enough(best); attempt++) { const l = layout(false); if (layoutScore(l) > layoutScore(best)) best = l; }
  map.routes = best.routes; map.paths = best.paths;
  const main = best.routes[0], allCells = best.allCells;
  map.path = map.paths[0];
  map.exit = map.path[map.path.length - 1];

  // One signpost per distinct entrance, standing beside the road where it enters the map
  map.entries = [];
  for (const r of map.routes) {
    if (!r.entry || map.entries.some((e) => e.edge === r.entry.edge && e.pos === r.entry.pos)) continue;
    const c0 = center(r.cells[0]), inn = INWARD[r.entry.edge];
    const road = { rx: c0.x + inn.dc * 44, ry: c0.y + inn.dr * 44, inn: { x: inn.dc, y: inn.dr } };            // where the road crosses the edge (for the lair decoration)
    const off = ROAD_EDGE + 12;                                                                                           // clear of the bank
    map.entries.push(inn.dr === 0
      ? { x: c0.x + inn.dc * 46, y: c0.y + off, face: inn, edge: r.entry.edge, pos: r.entry.pos, ...road }                // side entry: sign below the road
      : { x: c0.x + (c0.x < W / 2 ? off : -off), y: c0.y + inn.dr * 50 + 10, face: inn, edge: r.entry.edge, pos: r.entry.pos, ...road });   // top/bottom entry: sign beside it
  }
  map.entry = map.entries[0];

  // A castle guards every exit, standing in the margin beside the road where it leaves the map
  const exits = [];
  for (const r of map.routes) if (r.exit && !exits.some((e) => e.edge === r.exit.edge && e.pos === r.exit.pos)) exits.push(r.exit);
  // Gates mark the exits: where the road leaves the map, facing outward
  map.exits = exits.map((ex) => {
    const c = center(edgeCell(ex.edge, ex.pos)), inn = INWARD[ex.edge], px = -inn.dr, py = inn.dc;
    let g = null;
    for (const d of [108, 94, 80, 66]) {                                   // where the margin begins, or a little further out if a bend is in the way
      const gx = c.x + inn.dc * d, gy = c.y + inn.dr * d;
      const span = ROAD_EDGE + 8;
      const posts = [{ x: gx + px * span, y: gy + py * span }, { x: gx - px * span, y: gy - py * span }];
      g = { edge: ex.edge, pos: ex.pos, x: gx, y: gy, out: { x: -inn.dc, y: -inn.dr }, style: 0 };   // 0 stone gate, 1 Chinese paifang (set from the castle below)
      if (posts.every((p) => roadDistance(p) > ROAD_EDGE + 4)) break;
    }
    return g;
  });
  const two = exits.length > 1, fullScale = two ? 0.95 : 1.05;
  // How much grass is around a castle of size sc at (x, y)? The least distance from its walls to any road.
  const roomAround = (x, y, sc) => {
    const hw = 52 * sc, top = y - 96 * sc, bot = y + 12 * sc;
    let best = Infinity;
    for (let i = 0; i <= 6; i++) for (const [px, py] of [[x - hw + (2 * hw * i) / 6, top], [x - hw + (2 * hw * i) / 6, bot], [x - hw, top + ((bot - top) * i) / 6], [x + hw, top + ((bot - top) * i) / 6]]) best = Math.min(best, roadDistance({ x: px, y: py }));
    return best;
  };
  const gatePillarPoints = (g) => { const px = -g.out.y, py = g.out.x, span = ROAD_EDGE + 8; return [{ x: g.x + px * span, y: g.y + py * span }, { x: g.x - px * span, y: g.y - py * span }]; };
  const gateClear = (x, y, sc) => map.exits.every((g) => gatePillarPoints(g).every((pp) => Math.abs(pp.x - x) > 52 * sc + 14 || pp.y < y - 96 * sc - 10 || pp.y > y + 12 * sc + 60));
  // Enough room around it first (a road's width of grass), then as close to its own road as possible, full size preferred
  const placed = [];                                                                                      // homes already placed: never two on the same ground
  const overlaps = (o) => placed.some((k) => Math.hypot(k.x - o.x, k.y - o.y) < 60 * (k.scale + o.sc) + 24);
  const score = (o) => (gateClear(o.x, o.y, o.sc) ? 0 : -1000) + (overlaps(o) ? -2000 : 0) + Math.min(roomAround(o.x, o.y, o.sc), 70) + (o.pref ? 10 : 0) - o.d * 0.06 + o.sc * 110;   // a big home matters more than a short walk from the gate
  // Each castle picks, from spots along its edge on both sides of the road (and a smaller size if it must),
  // the one with the most open grass, leaning away from a sister castle on the same edge when both are fine
  map.castles = exits.map((ex, i) => {
    const c = center(edgeCell(ex.edge, ex.pos));
    const other = exits.find((o) => o !== ex && o.edge === ex.edge);
    const options = [];
    for (const sc of [fullScale, fullScale * 0.92, fullScale * 0.85]) {      // never shrink a home below ~85% of full size
      const yLo = 146 * sc + 10, yHi = H - 26 * sc - 12, xLo = 56 * sc + 12, xHi = W - 56 * sc - 12;   // tallest design (the temple's banner) and widest terrace stay off the edges
      if (ex.edge === "right" || ex.edge === "left") {
        const x = ex.edge === "right" ? xHi : xLo;
        const oy = other ? center(edgeCell(other.edge, other.pos)).y : null;
        for (const d of [66, 126, 186, 246, 306, 366, 426]) {
          options.push({ x, y: clamp(c.y - d, yLo, yHi), pref: oy === null || c.y < oy, d, sc });
          options.push({ x, y: clamp(c.y + d + 80, yLo, yHi), pref: oy === null || c.y > oy, d, sc });
        }
      } else {
        const y = ex.edge === "top" ? yLo : yHi;
        const ox = other ? center(edgeCell(other.edge, other.pos)).x : null;
        for (const d of [124, 184, 244, 304, 364, 424, 484]) {
          options.push({ x: clamp(c.x - d, xLo, xHi), y, pref: ox === null || c.x < ox, d, sc });
          options.push({ x: clamp(c.x + d, xLo, xHi), y, pref: ox === null || c.x > ox, d, sc });
        }
      }
    }
    const best = options.sort((p, q) => score(q) - score(p))[0];
    const k = { x: best.x, y: best.y, scale: best.sc, style: 0 };
    placed.push(k);
    return k;
  });
  // Every exit on a map gets a different design, drawn from a shuffled deck of the three
  const deck = [0, 1, 2]; shuffle(deck, rand);
  map.castles.forEach((k, i) => { k.style = deck[i % 3]; });
  map.exits.forEach((g, i) => { const cs = map.castles[i] ? map.castles[i].style : 0; g.style = cs === 2 ? 1 : cs === 1 ? 2 : 0; });   // the gate matches its home: stone, Moorish arch, or paifang
  map.castle = map.castles[0];

  makeRivers(rand);
  makePonds(rand);
  map.spots = pickSpots(allCells, rand);
  map.deco = scatterDeco(rand);
  map.critters = placeCritters(rand);
  return map;
}

// ---------- Rivers ----------
// Zero, one or two streams wander across the map. Where the road crosses one, a bridge is built.
function makeRivers(rand) {
  map.rivers = [];
  map.bridges = [];
  const roll = rand();
  const count = roll < 0.1 ? 0 : roll < 0.5 ? 1 : 2;                         // a big world usually has a river or two, never more
  for (let n = 0; n < count; n++) {
    let river = null;
    for (let attempt = 0; attempt < 240 && !river; attempt++) {
      const vertical = rand() < 0.5;
      const pts = [];
      // Meandering course: a slow S-curve plus random wander, sampled closely so bends are smooth
      const meanderAmp = 40 + rand() * 50, meanderFreq = 0.08 + rand() * 0.1, meanderPhase = rand() * 6;
      if (vertical) {
        let x = 120 + rand() * (W - 240);
        for (let y = -30; y <= H + 30; y += 30) { x = Math.max(60, Math.min(W - 60, x + (rand() - 0.5) * 36)); pts.push({ x: x + Math.sin(y * meanderFreq + meanderPhase) * meanderAmp * 0.3, y }); }
      } else {
        let y = 80 + rand() * (H - 160);
        for (let x = -30; x <= W + 30; x += 30) { y = Math.max(60, Math.min(H - 60, y + (rand() - 0.5) * 36)); pts.push({ x, y: y + Math.sin(x * meanderFreq + meanderPhase) * meanderAmp * 0.3 }); }
      }
      smoothPoints(pts, 3);
      river = finishRiver(pts, rand, { base: 38 + rand() * 18 });
    }
    if (!river) continue;
    // Maybe a tributary: a narrower stream from a map edge that winds in and joins this river
    if (rand() < 0.65) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const main = river.points;
        const j = Math.floor(main.length * (0.25 + rand() * 0.5)), join = main[j];
        const a = main[j - 1], b = main[j + 1], tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
        const side = rand() < 0.5 ? 1 : -1, bnx = (-ty / tl) * side, bny = (tx / tl) * side;   // which bank it comes in from
        // It meets the river at a slant, 15° to 70° off the river's own direction, like a real confluence
        const theta = (15 + rand() * 55) * Math.PI / 180, along = rand() < 0.5 ? 1 : -1;
        const nx = bnx * Math.sin(theta) + (tx / tl) * along * Math.cos(theta), ny = bny * Math.sin(theta) + (ty / tl) * along * Math.cos(theta);
        // Start on whichever map edge lies in that direction
        const tEdge = Math.min(nx > 0 ? (W + 30 - join.x) / nx : nx < 0 ? (-30 - join.x) / nx : Infinity, ny > 0 ? (H + 30 - join.y) / ny : ny < 0 ? (-30 - join.y) / ny : Infinity);
        if (!isFinite(tEdge) || tEdge < 220) continue;                     // too short to look like a stream
        const start = { x: join.x + nx * tEdge, y: join.y + ny * tEdge };
        const steps = Math.max(8, Math.round(tEdge / 30)), amp = 30 + rand() * 40, freq = 0.5 + rand() * 0.5, ph = rand() * 6;
        const pts = [];
        for (let k = 0; k <= steps; k++) {
          const t = k / steps, wob = Math.sin(k * freq + ph) * amp * Math.sin(t * Math.PI) + (rand() - 0.5) * 20 * Math.sin(t * Math.PI);
          pts.push({ x: start.x + (join.x - start.x) * t - ny * wob, y: start.y + (join.y - start.y) * t + nx * wob });
        }
        // The stream reaches the river's centre line at `join`; it carries on a little past it (never doubling back,
        // which folded its outline and tore a gap at the mouth). The river's water covers the overlap.
        pts.push({ x: join.x - bnx * join.w * 0.15, y: join.y - bny * join.w * 0.15 });
        smoothPoints(pts, 2);
        const trib = finishRiver(pts, rand, { base: river.base * (0.7 + rand() * 0.15), taper: true, parent: river, joinAt: join });
        if (trib) { river.tributary = trib; break; }
      }
    }
  }
}

function smoothPoints(pts, passes) {
  for (let pass = 0; pass < passes; pass++)
    for (let i = 1; i < pts.length - 1; i++) pts[i] = { x: (pts[i - 1].x + pts[i].x + pts[i + 1].x) / 3, y: (pts[i - 1].y + pts[i].y + pts[i + 1].y) / 3 };
}

// Give a course its widths, check it fits the map (clear of castles, lairs and other water; crossing roads
// only squarely, with a bridge) and register it. Returns the river, or null if it doesn't fit.
function finishRiver(pts, rand, { base, taper = false, parent = null, joinAt = null }) {
  const tooClose = pts.some((p) => map.castles.some((k) => dist(p, k) < 95) || map.entries.some((e) => dist(p, e) < 60))
    || map.rivers.some((r) => r !== parent && pts.some((p) => closestPointOnPath(r.points, p).d < 80))
    || (parent && pts.some((p) => dist(p, joinAt) > 150 && closestPointOnPath(parent.points, p).d < 70));   // a tributary keeps its distance until it joins
  if (tooClose) return null;
  // Width changes a lot along the course: narrow rapids, broad slow stretches, and one or two pond-like pools
  const p1 = rand() * 6, p2 = rand() * 6, f1 = 0.35 + rand() * 0.3, f2 = 0.9 + rand() * 0.6;
  pts.forEach((p, i) => {
    const wave = 0.5 + 0.5 * Math.sin(i * f1 + p1);
    const ripple = 0.5 + 0.5 * Math.sin(i * f2 + p2);
    p.w = base * (0.84 + wave * 0.22 + ripple * 0.08);                          // gentle variation along the course, no per-point noise
    if (taper) p.w *= 0.85 + 0.25 * (i / (pts.length - 1));                  // a stream grows a little as it nears the river
  });
  if (!taper) {
    const pools = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < pools; k++) {                            // a pool: the river balloons out over a few points
      const at = 4 + Math.floor(rand() * (pts.length - 8)), bulge = 8 + rand() * 12;
      for (let i = -5; i <= 5; i++) if (pts[at + i]) pts[at + i].w += bulge * Math.exp(-i * i / 5);   // a long, soft swell
    }
  }
  for (let pass = 0; pass < 5; pass++) for (let i = 1; i < pts.length - 1; i++) pts[i].w = (pts[i - 1].w + pts[i].w + pts[i + 1].w) / 3;   // well smoothed
  pts.forEach((p) => { p.w = Math.max(taper ? 28 : 34, Math.min(80, p.w)); });
  if (taper) { const n = pts.length; pts[n - 1].w *= 1.3; pts[n - 2].w *= 1.15; }   // the mouth widens a little where it meets the river
  const river = { points: pts, width: Math.max(...pts.map((p) => p.w)), base, parent };   // width = the widest point (used for clearances)
  // Wherever the water so much as touches the road there must be a bridge. Walk along the river,
  // note every stretch that comes within reach of the road, and reject rivers that run alongside
  // the road at a shallow angle (they would need an endless bridge).
  const bridges = [], nearMisses = [];
  let shallow = false;
  for (let i = 0; i < pts.length - 1 && !shallow; i++) {
    const a = pts[i], b = pts[i + 1], len = dist(a, b);
    const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
    for (let d = 0; d < len; d += 6) {
      const p = { x: a.x + tx * d, y: a.y + ty * d }, w = a.w + (b.w - a.w) * (d / len);
      const q = nearestRoadPoint(p);
      if (q.d > ROAD_WIDTH / 2 + w / 2 + 6) {
        if (q.d < ROAD_WIDTH / 2 + w / 2 + 36) nearMisses.push(q);   // brushing past the road without crossing it
        continue;
      }
      const cross = Math.abs(tx * q.ny - ty * q.nx);              // sin of the angle between river and road
      if (cross < 0.5) { shallow = true; break; }
      // The bridge sits where the river's centre actually meets the road's centre (the closest approach),
      // pointing along the road there, and is long enough to clear the water at that crossing angle
      const span = w / cross + 28;
      const near = bridges.find((bg) => dist(bg, q) < 70);
      if (near) { near.n++; if (q.d < near.d) { near.x = q.x; near.y = q.y; near.d = q.d; near.angle = Math.atan2(q.ny, q.nx); } near.span = Math.max(near.span, span); }
      else bridges.push({ x: q.x, y: q.y, d: q.d, angle: Math.atan2(q.ny, q.nx), span, n: 1 });
    }
  }
  if (shallow) return null;
  // Two crossings close together would mean two decks overlapping: this river is not wanted
  for (let i = 0; i < bridges.length; i++) {
    for (let j = i + 1; j < bridges.length; j++) if (dist(bridges[i], bridges[j]) < 220) return null;
    if (map.bridges.some((bg) => dist(bg, bridges[i]) < 220)) return null;    // nor next to another river's bridge
  }
  // A river may hug the road only right where it crosses (the bridge approaches); anywhere else it must keep its distance
  if (nearMisses.some((q) => !bridges.some((bg) => dist(bg, q) < 80))) return null;
  // A deck follows its road: it is the stretch of the route (by arc length) from where the ground is dry on
  // one side of the water to where it is dry again on the other, judged across the whole width of the road
  const inWater = (p) => { let best = Infinity; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = dist(a, b) || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (L * L))); const d = dist(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) - (a.w + (b.w - a.w) * t) / 2; best = Math.min(best, d); } return best < 7; };    // 7: the river's drawn bank
  for (const b of bridges) {
    const path = map.paths.map((pth) => ({ pth, d: closestPointOnPath(pth, b).d })).sort((u, v) => u.d - v.d)[0].pth;
    const s0 = arcLengthAt(path, b), hw = ROAD_EDGE + 8;
    // Each side of the deck gets its own reach, so on a slanted crossing the ends are cut at an angle
    // (like a real skew bridge) instead of one corner stretching far over dry land
    const wet = (sAt, side) => { const q = pointAtArc(path, sAt); return [side * hw, side * hw * 0.5, 0].some((o) => inWater({ x: q.x + q.nx * o, y: q.y + q.ny * o })); };
    const reach = (side) => { let s1 = s0, s2 = s0; while (s0 - s1 < 260 && wet(s1, side)) s1 -= 3; while (s2 - s0 < 260 && wet(s2, side)) s2 += 3; return [s1 - 5, s2 + 5]; };
    const [s1L, s2L] = reach(1), [s1R, s2R] = reach(-1);
    b.path = path; b.s1L = s1L; b.s2L = s2L; b.s1R = s1R; b.s2R = s2R;
    b.s1 = Math.min(s1L, s1R); b.s2 = Math.max(s2L, s2R);
    const mid = pointAtArc(path, (b.s1 + b.s2) / 2);
    b.x = mid.x; b.y = mid.y; b.angle = Math.atan2(mid.ty, mid.tx); b.span = b.s2 - b.s1;
  }
  map.rivers.push(river);
  map.bridges.push(...bridges);
  return river;
}

// Closest point on any road to p, plus the direction (nx, ny) of the road there
function nearestRoadPoint(p) {
  let best = null;
  for (const path of map.paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      const q = { x: a.x + dx * u, y: a.y + dy * u };
      const d = dist(p, q);
      if (!best || d < best.d) { const l = Math.sqrt(l2); best = { ...q, d, nx: dx / l, ny: dy / l }; }
    }
  }
  return best;
}

const nearRiver = (p, extra) => map.rivers.some((r) => closestPointOnPath(r.points, p).d < r.width / 2 + extra);
// Inside (or within `extra` of) a pond: measured as a stretched distance from its centre
const inPond = (p, pond, extra) => Math.hypot((p.x - pond.x), (p.y - pond.y) * (pond.rx / pond.ry)) < pond.rx * (pond.kmax || 1) + extra;
const nearWater = (p, extra) => nearRiver(p, extra) || map.ponds.some((q) => inPond(p, q, extra));

// ---------- Ponds ----------
// Up to four small ponds on open grass, well away from roads, rivers, castles and signposts.
function makePonds(rand) {
  map.ponds = [];
  const want = rand() < 0.15 ? 0 : 1 + Math.floor(rand() * 4);
  for (let attempt = 0; attempt < 160 && map.ponds.length < want; attempt++) {
    const p = { x: 60 + rand() * (W - 120), y: 60 + rand() * (H - 120), seed: Math.floor(rand() * 1e6) };
    // The pond grows to fit the open ground around it: a small pool squeezed between roads, a lake in a wide meadow
    const riverRoom = map.rivers.length ? Math.min(...map.rivers.map((r) => closestPointOnPath(r.points, p).d - r.width / 2)) : Infinity;
    const room = Math.min(roadDistance(p), riverRoom, ...map.castles.map((k) => dist(p, k) - 60 * k.scale), ...map.entries.map((e) => dist(p, e) - 40), ...map.ponds.map((q) => dist(p, q) - q.rx * (q.kmax || 1) - 30));
    const rx = Math.min(170, (room - 72) * 1.0);                            // keeps a clear bank of grass between the water and the road
    if (rx < 40) continue;                                                   // no puddles: too cramped here, try elsewhere
    p.rx = rx * (0.85 + rand() * 0.15); p.ry = p.rx * (0.6 + rand() * 0.25);
    // The outline is a smooth, low-frequency wobble around the ellipse: some ponds stretch long, some bend
    // into a kidney, most are gently uneven. Radius factors for 24 directions, never below 0.72 so the
    // ducks and fish near the middle always stay in the water.
    const style = rand(), ph = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
    const A = style < 0.35 ? [0.04, 0.2 + rand() * 0.08, 0.03]                  // long: a strong two-lobe stretch
      : style < 0.6 ? [0.12, 0.05, 0.1]                                          // kidney: one side bulges, a notch opposite
      : [0.03, 0.06 + rand() * 0.06, 0.04 + rand() * 0.04];                      // gently uneven
    if (style < 0.35) p.ry *= 0.8;                                                 // long ponds start from a slimmer ellipse too
    p.wobble = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return Math.max(0.72, 1 + A[0] * Math.cos(a + ph[0]) + A[1] * Math.cos(2 * a + ph[1]) + A[2] * Math.cos(3 * a + ph[2])); });
    p.kmax = Math.max(...p.wobble);
    // Big ponds attract ducks, drifting slowly around
    if (p.rx >= 70) {
      const n = 1 + Math.floor(rand() * 3);
      p.birds = Array.from({ length: n }, (_, k) => ({ kind: "duck", a0: rand() * Math.PI * 2 + k * 1.3, r: 0.25 + rand() * 0.4, speed: (0.05 + rand() * 0.06) * (rand() < 0.5 ? 1 : -1) }));
    }
    map.ponds.push(p);
  }
}

// ---------- Roads ----------
// Roads enter and leave through any of the four edges. Each route is a chain of grid cells: two straight
// margin cells at the entry, a winding walk through the middle, and two straight margin cells at the exit.
const center = (cell) => ({ x: cell.c * CELL + CELL / 2, y: cell.r * CELL + CELL / 2 });
const key = (c, r) => c * 100 + r;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const STEPS = [...NEIGHBOURS, [1, 1], [1, -1], [-1, 1], [-1, -1]];       // roads may also run diagonally
const RING2 = [];                                                         // every offset within two cells (except 0,0)
for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) if (dc || dr) RING2.push([dc, dr]);
const EDGES = ["left", "right", "top", "bottom"];
const INWARD = { left: { dc: 1, dr: 0 }, right: { dc: -1, dr: 0 }, top: { dc: 0, dr: 1 }, bottom: { dc: 0, dr: -1 } };
// A position along an edge runs over the interior rows (side edges) or interior columns (top and bottom)
const edgePositions = (edge) => (edge === "left" || edge === "right" ? [ROAD_MIN_ROW, ROAD_MAX_ROW] : [ROAD_MIN_COL, ROAD_MAX_COL]);
const edgeCell = (edge, pos) => edge === "left" ? { c: 0, r: pos } : edge === "right" ? { c: COLS - 1, r: pos } : edge === "top" ? { c: pos, r: 0 } : { c: pos, r: ROWS - 1 };
const stepCell = (cell, d, n = 1) => ({ c: cell.c + d.dc * n, r: cell.r + d.dr * n });
// The straight run through the margin: edge cell and the one after it; the walk starts two cells in
const marginCells = (edge, pos) => { const e = edgeCell(edge, pos), inn = INWARD[edge]; return [e, stepCell(e, inn)]; };
const interiorCell = (edge, pos) => stepCell(edgeCell(edge, pos), INWARD[edge], 2);
const inInterior = (c, r) => c >= ROAD_MIN_COL && c <= ROAD_MAX_COL && r >= ROAD_MIN_ROW && r <= ROAD_MAX_ROW;
const isStraight = (cells, i) => {                                                  // the road runs on (nearly) straight here, so a branch can leave or join cleanly
  if (i <= 0 || i >= cells.length - 1) return false;
  const ax = cells[i].c - cells[i - 1].c, ay = cells[i].r - cells[i - 1].r, bx = cells[i + 1].c - cells[i].c, by = cells[i + 1].r - cells[i].r;
  return (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1) >= 0.7;
};
const randomEdgePos = (rand, edge) => { const [lo, hi] = edgePositions(edge); return lo + Math.floor(rand() * (hi - lo + 1)); };
const touches = (cell, set) => NEIGHBOURS.some(([dc, dr]) => set.has(key(cell.c + dc, cell.r + dr)));

// A random walk through the interior from `start` toward `goal` that never touches itself, other roads
// (except where allowed) or reserved cells. Weak bias wanders; strong bias heads straight there.
//   avoid: cells of other roads   allowedNear: cells it may touch   reserved: cells it must stay clear of
//   includeGoal: finish on the goal cell itself (otherwise next to it)
function walk(rand, start, goal, { avoid = [], allowedNear = [], reserved = [], includeGoal = false, bias = 3, minLen = 3, attempts = 300 }) {
  const avoidSet = new Set(avoid.map((c) => key(c.c, c.r)));
  const allowed = new Set(allowedNear.map((c) => key(c.c, c.r)));
  const reservedSet = new Set(reserved.map((c) => key(c.c, c.r)));
  const goalKey = key(goal.c, goal.r), startKey = key(start.c, start.r), reservedKeys = reserved.map((c) => key(c.c, c.r));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const used = new Set([startKey, ...reservedKeys]);
    const walked = [];
    let cur = start, lastMove = null, straight = 0, lastTurn = 0, turnRun = 0;
    for (let step = 0; step < 90; step++) {
      const nextToGoal = NEIGHBOURS.some(([dc, dr]) => cur.c + dc === goal.c && cur.r + dr === goal.r);
      if (nextToGoal) {                                                        // arrived (too early counts as a failed attempt)
        if (walked.length < minLen) break;
        if (includeGoal) walked.push(goal);
        return walked;
      }
      const trail = []; if (walked.length < 3) trail.push(startKey); for (let t = Math.max(0, walked.length - 3); t < walked.length; t++) trail.push(key(walked[t].c, walked[t].r));   // our own last three cells (a bend brings them within two); anything older counts as another stretch of road
      const moves = STEPS.filter(([dc, dr]) => {
        const c = cur.c + dc, r = cur.r + dr, k = key(c, r);
        if (!inInterior(c, r) || used.has(k) || avoidSet.has(k)) return false;
        if (lastMove) {                                                        // bend gently: at most 45° per step, like a real road
          const cosA = (dc * lastMove[0] + dr * lastMove[1]) / (Math.hypot(dc, dr) * Math.hypot(lastMove[0], lastMove[1]));
          if (cosA < 0.6) return false;
          const turn = Math.sign(lastMove[0] * dr - lastMove[1] * dc);
          if (turn && turn === lastTurn && turnRun >= 2) return false;        // never three 45° turns the same way in a row (a hairpin)
        }
        if (k === goalKey) return false;                                       // only finish via the check above
        const nearGoal = Math.max(Math.abs(c - goal.c), Math.abs(r - goal.r)) <= 2;
        for (const [ac, ar] of RING2) {                                        // keep a whole empty cell between this road and any other stretch of road
          const nc = c + ac, nr = r + ar, nk = key(nc, nr);
          if (nk === goalKey || trail.includes(nk)) continue;
          const adjacent = Math.abs(ac) <= 1 && Math.abs(ar) <= 1;
          if (reservedSet.has(nk)) { if (adjacent) return false; continue; }
          if (used.has(nk)) { if (adjacent || !nearGoal) return false; continue; }
          if (avoidSet.has(nk)) {
            const fromStart = Math.max(Math.abs(nc - start.c), Math.abs(nr - start.r)), toGoal = Math.max(Math.abs(nc - goal.c), Math.abs(nr - goal.r));
            if (allowed.has(nk) && walked.length <= 1) continue;               // leaving the fork cell
            if (walked.length === 0 && fromStart <= 1) continue;               // the road either side of the fork cell, on the first step
            if (walked.length <= 2 && !adjacent && fromStart <= 2) continue;   // the road we set out from
            if (nearGoal && !adjacent) continue;                               // closing in on the road we join
            if (Math.max(Math.abs(c - goal.c), Math.abs(r - goal.r)) <= 1 && toGoal <= 1) continue;   // the last step beside the road we join
            return false;
          }
        }
        return true;
      }).map(([dc, dr]) => {
        const c = cur.c + dc, r = cur.r + dr;
        const closer = Math.abs(goal.c - c) + Math.abs(goal.r - r) < Math.abs(goal.c - cur.c) + Math.abs(goal.r - cur.r);
        let w = closer ? bias : 1;
        if (dc && dr) w *= 0.8;                                                                   // diagonals a little less often than straights
        if (lastMove && (dc !== lastMove[0] || dr !== lastMove[1]) && lastTurn && Math.sign(lastMove[0] * dr - lastMove[1] * dc) === lastTurn) w *= 0.25;   // a second turn the same way: wide, lazy curves rather than tight ones
        if (lastMove && dc === lastMove[0] && dr === lastMove[1] && straight >= 2) w *= 0.3;   // long straights are boring
        return [dc, dr, w];
      });
      if (!moves.length) break;
      const total = moves.reduce((s, m) => s + m[2], 0);
      let pick = rand() * total, move = moves[0];
      for (const m of moves) { pick -= m[2]; if (pick <= 0) { move = m; break; } }
      straight = lastMove && move[0] === lastMove[0] && move[1] === lastMove[1] ? straight + 1 : 1;
      const turn = lastMove ? Math.sign(lastMove[0] * move[1] - lastMove[1] * move[0]) : 0;
      turnRun = turn && turn === lastTurn ? turnRun + 1 : (turn ? 1 : 0);
      if (turn) lastTurn = turn; else if (straight >= 2) lastTurn = 0;
      lastMove = move;
      cur = { c: cur.c + move[0], r: cur.r + move[1] };
      used.add(key(cur.c, cur.r));
      walked.push(cur);
    }
  }
  return null;
}

// Entrances and exits must be far apart (in pixels, edge point to edge point), so no route is a short dash
const FAR_ENDS = 760, FAR_ENDS_SIDE = 640;
const farApart = (a, b, min) => dist(center(edgeCell(a.edge, a.pos)), center(edgeCell(b.edge, b.pos))) >= min;

// The main road: in through one edge, a long wander, out through a different edge. To spread the road over
// the whole map it first heads for a detour point well away from the straight line between entry and exit,
// and a map is only accepted when the road visits every quarter of the middle block.
function generateMainRoute(rand) {
  const midC = (ROAD_MIN_COL + ROAD_MAX_COL) / 2, midR = (ROAD_MIN_ROW + ROAD_MAX_ROW) / 2;
  for (let attempt = 0; attempt < 900; attempt++) {
    const entryEdge = EDGES[Math.floor(rand() * 4)];
    const others = EDGES.filter((e) => e !== entryEdge);
    const exitEdge = others[Math.floor(rand() * others.length)];
    const entry = { edge: entryEdge, pos: randomEdgePos(rand, entryEdge) }, exit = { edge: exitEdge, pos: randomEdgePos(rand, exitEdge) };
    const start = interiorCell(entry.edge, entry.pos), goal = interiorCell(exit.edge, exit.pos);
    if (start.c === goal.c && start.r === goal.r) continue;
    if (!farApart(entry, exit, FAR_ENDS)) continue;                                   // the way in and the way out are far apart
    // A detour point on the far side of the map from the start-to-goal line
    const dx = goal.c - start.c, dy = goal.r - start.r, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const side = (midC - start.c) * nx + (midR - start.r) * ny >= 0 ? 1 : -1;      // toward the centre
    const detour = {
      c: Math.round(Math.min(ROAD_MAX_COL - 1, Math.max(ROAD_MIN_COL + 1, (start.c + goal.c) / 2 + nx * side * 4 + (rand() - 0.5) * 4))),
      r: Math.round(Math.min(ROAD_MAX_ROW - 1, Math.max(ROAD_MIN_ROW + 1, (start.r + goal.r) / 2 + ny * side * 3 + (rand() - 0.5) * 2))),
    };
    const reserved = [...marginCells(entry.edge, entry.pos), ...marginCells(exit.edge, exit.pos)];
    const bias = map.opts.bias || 1.3;
    const first = walk(rand, start, detour, { reserved, includeGoal: true, bias, minLen: 8, attempts: 40 });
    if (!first) continue;
    const sofar = [start, ...first];
    const second = walk(rand, detour, goal, { avoid: sofar.slice(0, -1), reserved, includeGoal: true, bias, minLen: 8, attempts: 40 });
    if (!second) continue;
    const cells = [...marginCells(entry.edge, entry.pos), ...sofar, ...second, ...marginCells(exit.edge, exit.pos).reverse()];
    if (cells.length < (map.opts.minCells || 36)) continue;                         // a long, meandering road (36 cells is about 2.6 screens of travel; more on high levels)
    // The road must visit every one of six blocks (3 across, 2 down) of the middle, so no big area is left empty
    const bw = (ROAD_MAX_COL - ROAD_MIN_COL + 1) / 3, bh = (ROAD_MAX_ROW - ROAD_MIN_ROW + 1) / 2;
    const blocks = new Set(cells.filter((c) => inInterior(c.c, c.r)).map((c) => Math.floor((c.c - ROAD_MIN_COL) / bw) + 3 * Math.floor((c.r - ROAD_MIN_ROW) / bh)));
    if (blocks.size < 6) continue;
    return { cells, entry, exit };
  }
  // Fallback: a plain left-to-right zigzag (practically never needed)
  const cells = [...Array(COLS)].map((_, c) => ({ c, r: 4 + (c >= 2 && c <= 13 && c % 4 < 2 ? 0 : 1) }));
  return { cells, entry: { edge: "left", pos: cells[0].r }, exit: { edge: "right", pos: cells[COLS - 1].r } };
}

// A fresh entrance or exit for a second route: a different spot on any edge, clear of the main road
function freeEdgeSpot(rand, allCells, avoid) {
  const mainSet = new Set(allCells.map((c) => key(c.c, c.r)));
  for (let attempt = 0; attempt < 30; attempt++) {
    const edge = EDGES[Math.floor(rand() * 4)], pos = randomEdgePos(rand, edge);
    if (avoid.some((a) => a.edge === edge && Math.abs(a.pos - pos) < 3)) continue;
    const cells = [...marginCells(edge, pos), interiorCell(edge, pos)];
    if (cells.some((c) => mainSet.has(key(c.c, c.r)) || touches(c, mainSet))) continue;
    return { edge, pos };
  }
  return null;
}
// Interior indices of the main road (skipping the margin cells at both ends)
const interiorRange = (cells) => [2, cells.length - 3];

// Second route A: leaves the main road at a straight stretch and rejoins it further on
function forkAndRejoin(main, rand, allCells = main.cells) {
  const { cells } = main, [lo, hi] = interiorRange(cells);
  for (let attempt = 0; attempt < 80; attempt++) {
    const i = lo + Math.floor(rand() * Math.floor((hi - lo) * 0.5));
    const j = i + 6 + Math.floor(rand() * Math.max(1, hi - i - 6));
    if (j > hi || !isStraight(cells, i) || !isStraight(cells, j)) continue;
    const walked = walk(rand, cells[i], cells[j], { avoid: allCells, allowedNear: [cells[i], cells[j]], minLen: 6, attempts: 40 });
    if (!walked) continue;
    return { cells: [...cells.slice(0, i + 1), ...walked, ...cells.slice(j)], entry: main.entry, exit: main.exit };
  }
  return null;
}

// Second route B: comes in through its own entrance and merges into the main road
function separateEntry(main, rand, allCells = main.cells, ends = [main.entry, main.exit]) {
  const { cells } = main, [lo, hi] = interiorRange(cells);
  for (let attempt = 0; attempt < 40; attempt++) {
    const entry = freeEdgeSpot(rand, allCells, ends);
    if (!entry || !farApart(entry, main.exit, FAR_ENDS_SIDE)) continue;
    const start = interiorCell(entry.edge, entry.pos);
    const near = []; for (let k = lo + 2; k < hi - 1; k++) if (isStraight(cells, k)) near.push({ k, d: Math.hypot(cells[k].c - start.c, cells[k].r - start.r) * (0.7 + rand() * 0.6) });   // merge somewhere reasonably close to the entrance
    if (!near.length) continue;
    const j = near.reduce((a, b) => (b.d < a.d ? b : a)).k;
    const walked = walk(rand, start, cells[j], { avoid: allCells, allowedNear: [cells[j]], reserved: marginCells(entry.edge, entry.pos), bias: 2, minLen: 8, attempts: 40 });
    if (!walked) continue;
    return { cells: [...marginCells(entry.edge, entry.pos), start, ...walked, ...cells.slice(j)], entry, exit: main.exit };
  }
  return null;
}

// Second route C: leaves the main road and heads for its own exit
function forkToExit(main, rand, allCells = main.cells, ends = [main.entry, main.exit]) {
  const { cells } = main, [lo, hi] = interiorRange(cells);
  for (let attempt = 0; attempt < 40; attempt++) {
    const exit = freeEdgeSpot(rand, allCells, ends);
    if (!exit || !farApart(main.entry, exit, FAR_ENDS_SIDE)) continue;
    const i = lo + Math.floor(rand() * Math.floor((hi - lo) * 0.7));
    if (!isStraight(cells, i)) continue;
    const goal = interiorCell(exit.edge, exit.pos);
    const walked = walk(rand, cells[i], goal, { avoid: allCells, allowedNear: [cells[i]], reserved: marginCells(exit.edge, exit.pos), includeGoal: true, bias: 2, minLen: 8, attempts: 40 });
    if (!walked) continue;
    return { cells: [...cells.slice(0, i + 1), ...walked, ...marginCells(exit.edge, exit.pos).reverse()], entry: main.entry, exit };
  }
  return null;
}

// Second route D: a completely separate road with its own entrance and exit
function separateRoute(main, rand, allCells = main.cells, ends = [main.entry, main.exit]) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const entry = freeEdgeSpot(rand, allCells, ends);
    const exit = entry && freeEdgeSpot(rand, allCells, [...ends, entry]);
    if (!entry || !exit) continue;
    const start = interiorCell(entry.edge, entry.pos), goal = interiorCell(exit.edge, exit.pos);
    if (!farApart(entry, exit, FAR_ENDS_SIDE)) continue;                                 // ends too close together
    const walked = walk(rand, start, goal, { avoid: allCells, reserved: [...marginCells(entry.edge, entry.pos), ...marginCells(exit.edge, exit.pos)], includeGoal: true, bias: 2, minLen: 16, attempts: 40 });
    if (!walked) continue;
    return { cells: [...marginCells(entry.edge, entry.pos), start, ...walked, ...marginCells(exit.edge, exit.pos).reverse()], entry, exit };
  }
  return null;
}

// Distance from p to the nearest road, counting every route
export function roadDistance(p) {
  return Math.min(...map.paths.map((path) => closestPointOnPath(path, p).d));
}

// The road's centre line: a smooth curve through the cell centres (Catmull-Rom), each interior point nudged
// a little off its centre so no two stretches line up exactly. The straight runs through the margins at both
// ends are kept exact so gates and signposts sit square on the road.
function cellsToWaypoints(cells, rand) {
  const pts = cells.map(center);
  for (let i = 3; i < pts.length - 3; i++) { pts[i] = { x: pts[i].x + (rand() - 0.5) * 14, y: pts[i].y + (rand() - 0.5) * 14 }; }
  for (let pass = 0; pass < 4; pass++) {                                         // relax: each point eases toward its neighbours, rounding every bend
    const prev = pts.map((p) => ({ ...p }));
    for (let i = 3; i < pts.length - 3; i++) pts[i] = { x: 0.5 * prev[i].x + 0.25 * (prev[i - 1].x + prev[i + 1].x), y: 0.5 * prev[i].y + 0.25 * (prev[i - 1].y + prev[i + 1].y) };
  }
  const first = pts[0], second = pts[1], last = pts[pts.length - 1], before = pts[pts.length - 2];
  const startOff = { x: first.x + Math.sign(first.x - second.x) * 70, y: first.y + Math.sign(first.y - second.y) * 70 };
  const endOff = { x: last.x + Math.sign(last.x - before.x) * 70, y: last.y + Math.sign(last.y - before.y) * 70 };
  const ctrl = [startOff, startOff, ...pts, endOff, endOff];
  const out = [startOff];
  const SUB = 8;
  for (let i = 1; i < ctrl.length - 2; i++) {
    const p0 = ctrl[i - 1], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i + 2];
    for (let k = 1; k <= SUB; k++) {
      const t = k / SUB, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  // Thin out points that add nothing (nearly collinear), keeping the curve within a pixel
  const thin = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a = thin[thin.length - 1], b = out[i], c = out[i + 1];
    const cross = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / (Math.hypot(c.x - a.x, c.y - a.y) || 1);
    if (cross > 0.8 || Math.hypot(b.x - a.x, b.y - a.y) > 40) thin.push(b);
  }
  thin.push(out[out.length - 1]);
  return thin;
}

// ---------- Build spots ----------
// Grass cells right next to the road, spread out so towers don't crowd.
// Pads sit just off the road's verge, and by preference in the elbows of bends and where routes join
// (that is where a tower sees the most road). Candidates are taken along every route, on both sides.
function pickSpots(cells, rand) {
  const want = ROAD_EDGE + SPOT_RADIUS + 6;                               // pad edge a clear 6px off the bank
  // Junctions: where a branch leaves or joins another route
  const junctions = [];
  for (let k = 1; k < map.paths.length; k++) {
    const br = map.paths[k], others = map.paths.filter((_, j) => j !== k);
    const onOther = (q) => others.some((o) => closestPointOnPath(o, q).d < ROAD_WIDTH * 0.35);
    for (const seq of [br, br.slice().reverse()]) { let i = 0; while (i < seq.length && onOther(seq[i])) i++; if (i > 0 && i < seq.length) junctions.push(seq[i - 1]); }
  }
  const candidates = [];
  for (const path of map.paths) {
    const pts = pointsAlongPath(path, 10);
    for (let i = 4; i < pts.length - 4; i++) {
      const p = pts[i], back = pts[i - 4], fwd = pts[i + 4];
      // How much the road turns here, and which way (the inside of the bend is the better side)
      const a1 = Math.atan2(p.y - back.y, p.x - back.x), a2 = Math.atan2(fwd.y - p.y, fwd.x - p.x);
      let turn = a2 - a1; while (turn > Math.PI) turn -= 2 * Math.PI; while (turn < -Math.PI) turn += 2 * Math.PI;
      const dJ = junctions.length ? Math.min(...junctions.map((j) => dist(j, p))) : Infinity;
      for (const side of [1, -1]) {
        const q = { x: p.x + p.nx * side * want, y: p.y + p.ny * side * want };
        const inside = Math.sign(turn) === side;                                    // this side is the inner side of the bend
        const score = 1 + 3 * Math.abs(turn) * (inside ? 1.3 : 0.6) + 2.2 * Math.exp(-dJ / 110) + rand() * 0.5;
        candidates.push({ x: q.x, y: q.y, score });
      }
    }
  }
  const ok = (p) => {
    if (p.x < 40 || p.x > W - 40 || p.y < 40 || p.y > H - 40) return false;
    if (!inInterior(Math.floor(p.x / CELL), Math.floor(p.y / CELL))) return false;   // no building in any margin
    if (roadDistance(p) < want - 2) return false;                                      // squeezed against another road
    if (map.castles.some((k) => { const cdx = p.x - k.x, cdy = p.y - k.y; return Math.abs(cdx) < 92 * k.scale && cdy > -135 * k.scale && cdy < 42 * k.scale; })) return false;
    if (map.entries.some((e) => dist(p, e) < 55 || dist(p, { x: e.rx, y: e.ry }) < 78)) return false;   // not on the signpost or the lair stakes
    if (map.exits.some((g) => dist(p, g) < 78)) return false;                                        // not on the exit gate
    if (nearWater(p, 28)) return false;
    return true;
  };
  candidates.sort((u, v) => v.score - u.score);
  const spots = [];
  for (const p of candidates) {
    if (spots.length >= map.opts.spots) break;
    if (ok(p) && spots.every((sp) => dist(sp, p) >= 100)) spots.push({ x: p.x, y: p.y });
  }
  return spots;
}

// ---------- Scenery and animals ----------
function clear(p, { road = ROAD_EDGE + 26, spots = 48, castle = 85, entry = 50, deco = 0, critters = 0, river = 14 }) {   // scenery keeps a clear margin from the road's bank
  return roadDistance(p) > road
    && !nearWater(p, river)
    && map.spots.every((s) => dist(s, p) > spots)
    && map.castles.every((k) => dist(p, k) > castle * k.scale) && map.entries.every((e) => dist(p, e) > entry && dist(p, { x: e.rx, y: e.ry }) > entry + 50)
    && map.deco.every((d) => dist(d, p) > deco)
    && map.critters.every((c) => dist(c, p) > critters)
    && !(map.calm || []).some((z) => ((p.x - z.x) / z.rx) ** 2 + ((p.y - z.y) / z.ry) ** 2 < 1);   // empty ground: breathing room (留白)
}

// Occasionally a stretch of open grass is left deliberately empty, so the map has somewhere for the eye to rest
function pickCalmZones(rand) {
  const roll = rand(), want = roll < 0.3 ? 0 : roll < 0.75 ? 1 : 2, zones = [];
  map.calm = [];
  for (let n = 0; n < want; n++) {
    let best = null;
    for (let i = 0; i < 260; i++) {
      const p = { x: 110 + rand() * (W - 220), y: 110 + rand() * (H - 220) }, room = roadDistance(p);
      if (room < ROAD_EDGE + 80 || nearWater(p, 70) || map.spots.some((sp) => dist(sp, p) < 70) || map.castles.some((k) => dist(p, k) < 130) || map.entries.some((e) => dist(p, e) < 120 || dist(p, { x: e.rx, y: e.ry }) < 150) || zones.some((z) => dist(z, p) < 300)) continue;
      const score = Math.min(room, 190) + rand() * 30;
      if (!best || score > best.score) best = { ...p, score, room };
    }
    if (!best) break;
    const rx = Math.max(80, Math.min(150, best.room - ROAD_EDGE - 20));
    const z = { x: best.x, y: best.y, rx, ry: rx * 0.7 };
    zones.push(z); map.calm.push(z);
  }
}

function scatterDeco(rand) {
  pickCalmZones(rand);
  const out = [];
  map.deco = out;
  let placed = 0;                                                        // scenery pieces placed on their own (woods add extra trees)
  // Kinds of tree: broadleaf, pine, birch, cherry, autumn, bare. Cherry trees are a treat, so only a few per map
  let cherries = 0;
  const treeVariant = () => {
    const roll = rand();
    let v = roll < 0.26 ? 0 : roll < 0.46 ? 1 : roll < 0.56 ? 2 : roll < 0.66 ? 3 : roll < 0.9 ? 4 : roll < 0.95 ? 5 : 6;   // 5 and 6: two kinds of leafless tree
    if (v === 3 && ++cherries > 3) v = rand() < 0.5 ? 0 : 4;
    return v;
  };
  for (let i = 0; i < 700 && placed < 48; i++) {
    const p = { x: 20 + rand() * (W - 40), y: 20 + rand() * (H - 40) };
    if (!clear(p, { deco: 40 })) continue;
    placed++;
    const roll = rand();
    const type = roll < 0.3 ? "tree" : roll < 0.46 ? "bush" : roll < 0.56 ? "rock" : roll < 0.66 ? "pebbles" : roll < 0.85 ? "flower" : roll < 0.93 ? "mushroom" : "stump";
    // Every piece of scenery gets its own look: a variant, a size and a seed for its small random details
    const size = type === "flower" ? 0.5 + rand() * 0.25 : type === "pebbles" ? 0.7 + rand() * 0.5 : type === "mushroom" ? 0.42 + rand() * 0.2 : type === "stump" ? 0.6 + rand() * 0.2 : type === "tree" ? 1.0 + rand() * 0.4 : 0.8 + rand() * 0.5;   // small things stay small, trees stand tall
    const item = { type, x: p.x, y: p.y, s: size, variant: type === "tree" ? treeVariant() : Math.floor(rand() * 3), seed: Math.floor(rand() * 1e6) };
    out.push(item);
    if (type === "tree" && item.variant >= 4 && rand() < 0.7) {           // a drift of fallen leaves beside a turned or bare tree
      const a = rand() * Math.PI * 2, d = 18 + rand() * 16;
      out.push({ type: "leaves", x: p.x + Math.cos(a) * d, y: p.y + 6 + Math.abs(Math.sin(a)) * d * 0.5, s: 0.8 + rand() * 0.5, variant: Math.floor(rand() * 3), seed: Math.floor(rand() * 1e6) });
    }
    // Company: trees often come as a small wood of 2 to 4, flowers as a patch of 3 to 7
    // Now and then a much bigger gathering: a real wood, a whole meadow, a thicket
    const big = rand() < 0.13;
    const group = type === "tree" && (big || rand() < 0.55) ? (big ? { n: 7 + Math.floor(rand() * 7), near: 30, far: 125, gap: 24, s: () => 0.95 + rand() * 0.4 } : { n: 2 + Math.floor(rand() * 3), near: 30, far: 66, gap: 24, s: () => 0.95 + rand() * 0.4 })
      : type === "flower" && (big || rand() < 0.75) ? (big ? { n: 14 + Math.floor(rand() * 12), near: 10, far: 80, gap: 8, s: () => 0.45 + rand() * 0.3 } : { n: 3 + Math.floor(rand() * 5), near: 10, far: 34, gap: 8, s: () => 0.45 + rand() * 0.3 })
      : type === "bush" && (big ? true : rand() < 0.3) ? (big ? { n: 4 + Math.floor(rand() * 4), near: 10, far: 52, gap: 21, s: () => 0.75 + rand() * 0.4 } : { n: 2 + Math.floor(rand() * 3), near: 10, far: 32, gap: 19, s: () => 0.7 + rand() * 0.4 }) : null;
    if (group) {
      for (let k = 0, tries = 0; k < group.n && tries < 24 + group.n * 5; tries++) {
        const a = rand() * Math.PI * 2, d = group.near + (group.far - group.near) * (type === "bush" ? Math.sqrt(rand()) : rand());   // bushes fill their patch evenly out to a definite edge
        const q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.7 };
        if (q.x < 20 || q.x > W - 20 || q.y < 20 || q.y > H - 20 || !clear(q, { deco: group.gap })) continue;
        // Trees in a wood mostly match their neighbours (a birch grove, a pine stand); the odd different one slips in
        const variant = type === "tree" ? (rand() < 0.72 ? item.variant : treeVariant()) : type === "bush" && rand() < 0.8 ? item.variant : Math.floor(rand() * 3);
        out.push({ type, x: q.x, y: q.y, s: group.s(), variant, seed: Math.floor(rand() * 1e6) });
        k++;
      }
    }
  }
  // Tufts and weeds scattered over the grass: some standing alone, some in loose patches
  for (let i = 0, count = 0; i < 1400 && count < 190; i++) {
    const p = { x: 14 + rand() * (W - 28), y: 14 + rand() * (H - 28) };
    if (!clear(p, { deco: 12 })) continue;
    const type = rand() < 0.62 ? "tuft" : "weed", kinds = 4, v = Math.floor(rand() * kinds), alone = rand() < 0.45, bigPatch = rand() < 0.1;
    const mk = (x, y) => ({ type, x, y, s: 0.8 + rand() * 0.55, variant: v, seed: Math.floor(rand() * 1e6) });
    out.push(mk(p.x, p.y)); count++;
    if (!alone) for (let k = 0, tries = 0, n = bigPatch ? 12 + Math.floor(rand() * 14) : 2 + Math.floor(rand() * 5); k < n && tries < 20 + n * 5; tries++) {   // a patch (now and then a big one): neighbours mostly the same kind
      const a = rand() * Math.PI * 2, d = 7 + rand() * (bigPatch ? 70 : 24), q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.65 };
      if (q.x < 14 || q.x > W - 14 || q.y < 14 || q.y > H - 14 || !clear(q, { deco: 7 })) continue;
      const m = mk(q.x, q.y); if (rand() < 0.3) m.variant = Math.floor(rand() * kinds); out.push(m); count++; k++;
    }
  }
  // A little landscaping in front of each home: a few flowers, pebbles and a bush close to its walls
  for (const k of map.castles) {
    for (let n = 0, tries = 0; n < 4 && tries < 30; tries++) {
      const a = rand() * Math.PI, d = (42 + rand() * 40) * k.scale;
      const q = { x: k.x + Math.cos(a) * d, y: k.y + 16 * k.scale + Math.sin(a) * d * 0.45 };
      if (q.x < 20 || q.x > W - 20 || q.y < 20 || q.y > H - 20 || !clear(q, { road: ROAD_EDGE + 10, spots: 30, castle: 0, entry: 40, deco: 16 })) continue;
      const roll = rand();
      const type = roll < 0.45 ? "flower" : roll < 0.7 ? "pebbles" : roll < 0.9 ? "bush" : "mushroom";
      const size = type === "flower" ? 0.5 + rand() * 0.2 : type === "pebbles" ? 0.6 + rand() * 0.3 : type === "bush" ? 0.7 + rand() * 0.3 : 0.4 + rand() * 0.15;
      out.push({ type, x: q.x, y: q.y, s: size, variant: Math.floor(rand() * 3), seed: Math.floor(rand() * 1e6) });
      n++;
    }
  }
  return out;
}

// A random handful of animals: how many and which kinds changes every map.
const ANIMAL_ODDS = [["bunny", 0.22], ["sheep", 0.18], ["chicken", 0.15], ["deer", 0.13], ["fox", 0.12], ["cow", 0.1], ["duck", 0.1]];

function placeCritters(rand) {
  const out = [];
  map.critters = out;
  const count = 5 + Math.floor(rand() * 6);                        // 5 to 10 animals
  for (let i = 0; i < 400 && out.length < count; i++) {
    const p = { x: 40 + rand() * (W - 80), y: 40 + rand() * (H - 80) };
    if (!clear(p, { road: ROAD_EDGE + 16, spots: 55, deco: 32, critters: 60, river: 50 })) continue;
    let roll = rand(), type = ANIMAL_ODDS[0][0];
    for (const [name, odds] of ANIMAL_ODDS) { roll -= odds; if (roll <= 0) { type = name; break; } }
    if (type === "cow" && out.some((a) => a.type === "cow")) type = "sheep";   // one cow is plenty
    out.push({ type, x: p.x, y: p.y });
  }
  return out;
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

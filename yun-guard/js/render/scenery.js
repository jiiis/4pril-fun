import { H } from "../config.js";
import { map } from "../map.js";
import { createCanvas } from "./gfx.js";
import { drawDecoItem, drawCastleAt } from "./background.js";

// Nearer scenery and creatures share the same scale in the worker and the live renderer.
export const depthScale = (y) => 0.82 + 0.36 * Math.min(1, Math.max(0, y / H));
const ATLAS_WIDTH = 2048, MAX_PIXELS = 8 * 1024 * 1024;

function pack(items) {
  let x = 0, y = 0, rowHeight = 0;
  const entries = [...items].sort((a, b) => b.h - a.h).map(item => {
    if (item.w > ATLAS_WIDTH) throw new Error("Scenery sprite exceeds atlas width");
    if (x + item.w > ATLAS_WIDTH) { x = 0; y += rowHeight + 2; rowHeight = 0; }
    const entry = { ...item, sx: x, sy: y };
    x += item.w + 2; rowHeight = Math.max(rowHeight, item.h);
    return entry;
  });
  return { entries, height: Math.max(1, y + rowHeight) };
}

// Keep one depth-sorted slot per object. Only unchanged artwork goes into the atlas.
export function buildScenery(res) {
  const objects = map.deco.map((d, index) => {
    const scale = depthScale(d.y), size = (d.s || 1) * scale;
    const bounds = d.type === "tree" ? [-48, -90, 80, 48]
      : d.type === "bush" || d.type === "rock" ? [-36, -42, 65, 36] : [-28, -38, 44, 22];
    return { kind: "deco", index, bounds: bounds.map((v, i) => (i % 2 ? d.y : d.x) + v * size), paint(c) {
      c.translate(d.x, d.y); c.scale(scale, scale); c.translate(-d.x, -d.y);
      drawDecoItem(c, d);
    } };
  });
  map.castles.forEach((k, index) => objects.push({ kind: "castle", index,
    bounds: [k.x - 180 * k.scale, k.y - 200 * k.scale, k.x + 220 * k.scale, k.y + 90 * k.scale],
    paint: c => drawCastleAt(c, k, false),
  }));
  for (let attempt = 0; attempt < 4; attempt++) {
    const layout = pack(objects.map(object => {
      const [left, top, right, bottom] = object.bounds.map((v, i) => i < 2 ? Math.floor(v * res) : Math.ceil(v * res));
      return { object, left, top, w: right - left, h: bottom - top };
    }));
    // Allow larger temporary bounds, but keep the retained atlas within 32 MiB.
    if (ATLAS_WIDTH * layout.height > MAX_PIXELS * 2) throw new Error("Scenery scratch atlas exceeds its memory budget");
    const scratch = createCanvas(ATLAS_WIDTH, layout.height);
    let atlas;
    try {
      const c = scratch.getContext("2d");
      for (const e of layout.entries) {
        c.save(); c.beginPath(); c.rect(e.sx, e.sy, e.w, e.h); c.clip();
        c.setTransform(res, 0, 0, res, e.sx - e.left, e.sy - e.top);
        c.lineCap = c.lineJoin = "round";
        e.object.paint(c); c.restore();
      }
      // One GPU readback for the entire atlas, rather than one for every plant.
      const { data } = c.getImageData(0, 0, scratch.width, scratch.height);
      let clipped = false;
      const cropped = layout.entries.map(e => {
        let x0 = e.w, y0 = e.h, x1 = -1, y1 = -1;
        for (let y = 0; y < e.h; y++) for (let x = 0; x < e.w; x++) {
          if (!data[((e.sy + y) * ATLAS_WIDTH + e.sx + x) * 4 + 3]) continue;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        if (x1 >= 0 && (x0 === 0 || y0 === 0 || x1 === e.w - 1 || y1 === e.h - 1)) {
          clipped = true;
          e.object.bounds = e.object.bounds.map((v, i) => v + (i < 2 ? -64 : 64));
        }
        if (x1 < 0) { x0 = y0 = x1 = y1 = 0; }
        x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
        x1 = Math.min(e.w - 1, x1 + 2); y1 = Math.min(e.h - 1, y1 + 2);
        return { kind: e.object.kind, index: e.object.index, sourceX: e.sx + x0, sourceY: e.sy + y0,
          x: (e.left + x0) / res, y: (e.top + y0) / res, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      });
      if (clipped) continue;                          // grow bounds instead of losing a branch or shadow
      const packed = pack(cropped);
      if (ATLAS_WIDTH * packed.height > MAX_PIXELS) throw new Error("Scenery cache exceeds its memory budget");
      atlas = createCanvas(ATLAS_WIDTH, packed.height);
      const ac = atlas.getContext("2d");
      const entries = packed.entries.map(({ sourceX, sourceY, ...e }) => {
        ac.drawImage(scratch, sourceX, sourceY, e.w, e.h, e.sx, e.sy, e.w, e.h);
        return e;
      });
      return { image: atlas.transferToImageBitmap(), entries, res, bytes: ATLAS_WIDTH * packed.height * 4 };
    } finally {
      scratch.width = scratch.height = 0;
      if (atlas) atlas.width = atlas.height = 0;
    }
  }
  throw new Error("Scenery extends beyond its cache bounds");
}

import { map, generateMap } from "./map.js";
import { buildBackground } from "./render/background.js";

let canRender = typeof OffscreenCanvas !== "undefined";
function renderBackground(res) {
  if (!canRender) return null;
  try { return buildBackground(res).transferToImageBitmap(); }
  catch (error) {
    canRender = false;
    console.warn("Worker background rendering unavailable; using the page renderer", error);
    return null;
  }
}

self.onmessage = ({ data: { id, type, seed, opts, res, map: suppliedMap } }) => {
  try {
    if (type === "map") generateMap(seed, opts);
    else Object.assign(map, suppliedMap);
    const background = renderBackground(res);
    self.postMessage({ id, map: type === "map" ? map : undefined, background, res }, background ? [background] : []);
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};

import { map, generateMap } from "./map.js";
import { buildBackground } from "./render/background.js";
import { buildScenery } from "./render/scenery.js";

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
  let background = null, scenery = null;
  try {
    if (type === "map") generateMap(seed, opts);
    else Object.assign(map, suppliedMap);
    background = renderBackground(res);
    if (background) {
      try { scenery = buildScenery(res); }
      catch (error) { console.warn("Scenery cache unavailable; drawing scenery directly", error); }
    }
    self.postMessage({ id, map: type === "map" ? map : undefined, background, scenery, res }, [background, scenery?.image].filter(Boolean));
  } catch (error) {
    background?.close(); scenery?.image.close();
    self.postMessage({ id, error: error.message });
  }
};

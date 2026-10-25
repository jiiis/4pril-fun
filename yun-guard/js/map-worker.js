import { map, generateMap } from "./map.js";

self.onmessage = ({ data: { id, seed, opts } }) => {
  try {
    generateMap(seed, opts);
    self.postMessage({ id, map });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};

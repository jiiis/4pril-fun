// Keep generation off the UI thread; map.js itself is also used by the worker.
let worker = null, nextId = 0;
const pending = new Map();

export function requestMap(seed, opts) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      worker = new Worker(new URL("./map-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => {
        const request = pending.get(data.id);
        if (!request) return;
        pending.delete(data.id);
        if (data.error) request.reject(new Error(data.error));
        else request.resolve(data.map);
      };
      worker.onmessageerror = worker.onerror = () => {
        worker.terminate(); worker = null;
        for (const request of pending.values()) request.reject(new Error("Map worker failed to load or run"));
        pending.clear();
      };
    }
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try { worker.postMessage({ id, seed, opts }); }
    catch (error) { pending.delete(id); reject(error); }
  });
}

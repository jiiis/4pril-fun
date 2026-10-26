// Generation and static background rendering share a worker.
let worker = null, nextId = 0;
const pending = new Map();

export const requestMap = (seed, opts, res) => request({ type: "map", seed, opts, res });
export const requestBackground = (map, res) => request({ type: "background", map, res });

function request(message) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      worker = new Worker(new URL("./map-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => {
        const request = pending.get(data.id);
        if (!request) { data.background?.close(); data.scenery?.image.close(); return; }
        pending.delete(data.id);
        if (data.error) request.reject(new Error(data.error));
        else request.resolve(data);
      };
      worker.onmessageerror = worker.onerror = () => {
        worker.terminate(); worker = null;
        for (const request of pending.values()) request.reject(new Error("Map worker failed to load or run"));
        pending.clear();
      };
    }
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    try { worker.postMessage({ id, ...message }); }
    catch (error) { pending.delete(id); reject(error); }
  });
}

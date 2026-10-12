// Light sources, gathered while the scene is drawn and used when night falls.
// Anything that really glows (a flame, a lantern, a lit window, a mage's orb, a gold finial) registers itself
// in its own drawing code with addLight(), using its local coordinates; the current canvas transform turns
// those into screen pixels so the night layer can leave a pool of light exactly there.
export const lights = [];
export const beginLights = () => { lights.length = 0; };
// kind: flame | lantern | gold | magic | arc | green. r is the reach of the light, in world pixels.
export function addLight(c, x, y, r, kind = "flame") {
  const m = c.getTransform();
  const s = Math.hypot(m.a, m.b);
  lights.push({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, r: r * s, kind });
}
export const LIGHT_TINT = {
  flame: [255, 160, 60], lantern: [255, 120, 70], gold: [255, 220, 120], magic: [205, 150, 255], arc: [120, 200, 255], green: [120, 255, 60],
};

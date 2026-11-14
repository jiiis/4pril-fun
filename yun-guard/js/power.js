// Battery saver: a saved preference to draw at about 30 FPS, for less heat and battery use.
const BATTERY_SAVER_KEY = "yunguard.batterySaver";
let batterySaver = false;
try { batterySaver = localStorage.getItem(BATTERY_SAVER_KEY) === "1"; } catch { /* unavailable storage: keep the default */ }

export const isBatterySaver = () => batterySaver;
export function setBatterySaver(enabled) {
  batterySaver = enabled;
  try { localStorage.setItem(BATTERY_SAVER_KEY, enabled ? "1" : "0"); } catch { /* keep the choice for this session */ }
}

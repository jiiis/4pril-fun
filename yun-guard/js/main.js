import { canvas } from "./render/gfx.js";
import { state } from "./state.js";
import { W, H, SPOT_RADIUS, TOWERS, HERO_KINDS } from "./config.js";
import { dist } from "./util.js";
import { map, generateMap } from "./map.js";
import { update } from "./update.js";
import { draw, SPOT_SQUASH, depthScale, invalidateBackground } from "./render/draw.js";
import { initUi, openMenu, closeMenu, resetUiForLevel, centerOn } from "./ui.js";
import { startWave, spawnEnemy } from "./waves.js";
import { createTower, setRally, archerHeight, mageHeight, teslaHeight, visLevel } from "./towers.js";
import { initCritters } from "./critters.js";
import { initHero, sendHero, selectedHero, selectHero, deselectHeroes, heroAt } from "./hero.js";
import { initTouch } from "./touch.js";
import { icon } from "./icons.js";
import { unlockAudio, toggleMute, isMuted, sfx } from "./audio.js";
import { initWeather } from "./weather.js";
import { MAX_LEVEL, clampLevel, savedLevel, saveLevel, levelConfig, levelSeed, carryFor, clearProgress, mapOptionsFor } from "./levels.js";

// Which level? ?level=N in the URL, else the last one played on this device. Each level has its own map
// (add ?seed=1234 to force a particular map instead).
const params = new URLSearchParams(location.search);
let level = clampLevel(params.get("level") || savedLevel());
saveLevel(level);
const diff = levelConfig(level);
state.level = level; state.diff = diff; state.totalWaves = diff.waves; state.gold = diff.gold + carryFor(level); state.lives = diff.lives;
const seedParam = Number(params.get("seed")) || Number(location.hash.replace(/^#/, ""));   // ?seed=123456 or #123456
generateMap(seedParam > 0 ? seedParam : levelSeed(level), mapOptionsFor(level));
// The address bar always shows the level and map being played, so a browser refresh or bookmark brings back exactly this game
function showInUrl(heroKind) {
  const q = new URLSearchParams({ level, seed: map.seed });
  if (heroKind) q.set("hero", heroKind);
  history.replaceState(null, "", `${location.pathname}?${q}`);
}
showInUrl(params.get("hero"));

// Start a level in this same page (no reload, so full screen and the audio stay as they are):
// rebuild the world, reset everything that changes while playing, then choose a legend or jump straight in.
function startLevel({ level: L, seed, hero }) {
  level = clampLevel(L); saveLevel(level);
  const d = levelConfig(level);
  state.level = level; state.diff = d; state.totalWaves = d.waves; state.gold = d.gold + carryFor(level); state.lives = d.lives;
  state.wave = 0; state.over = false; state.paused = false; state.countdown = null; state.spawnTimer = 0;
  for (const k of ["enemies", "towers", "shots", "floaters", "bursts", "bolts", "fires", "smoke", "scorches", "blood", "corpses", "spawnQueue", "fish", "poops", "heroes"]) state[k] = [];
  state.hero = null; state.dog = null; state.eagle = null;
  state.selected = null; state.hover = null; state.rallyFor = null; state.hoverCritter = null; state.preview = null;
  generateMap(seed > 0 ? seed : levelSeed(level), mapOptionsFor(level));
  invalidateBackground();
  initCritters(); initWeather();
  resetUiForLevel();
  pauseBtn.innerHTML = icon("pause"); pauseBtn.title = "Pause (P)";
  lvInput.value = level; document.getElementById("lvPrev").disabled = level <= 1; document.getElementById("lvNext").disabled = level >= MAX_LEVEL;
  if (hero === "pick" || !hero) {                                     // the legend screen again (no entrance animation this time)
    heroPick.classList.add("again");
    heroPick.style.display = "flex";
    showLegendBadge(null);
    document.getElementById("next").disabled = true; document.getElementById("pause").disabled = true;
    showInUrl(null);
  } else if (hero === "none") { startSolo(); showInUrl("none"); }
  else { chooseHero(hero); showInUrl(hero); }
}
window.addEventListener("startLevel", (ev) => startLevel(ev.detail));
// Editing the #seed in the address bar doesn't reload the page by itself; do it when it means a different map
window.addEventListener("hashchange", () => {
  const want = Number(location.hash.replace(/^#/, "")) || levelSeed(level);
  if (want !== map.seed) location.reload();
});

initUi();
initTouch();
initCritters();
initWeather();

// Pick a hero before the round starts (or pass ?hero=april / ?hero=avril in the URL)
const heroPick = document.getElementById("heroPick");
const preset = new URLSearchParams(location.search).get("hero");
const LEGEND_ICON = { april: "sword", avril: "bow", adrien: "shieldCheck", ember: "flame", willow: "leaf", meilin: "snowflake" };
const LEGEND_TINT = { april: "#7986cb", avril: "#f06292", adrien: "#ffd54f", ember: "#ff7043", willow: "#8bc34a", meilin: "#80deea" };
const legendBadge = document.getElementById("legendBadge");
function showLegendBadge(kind) {
  if (!kind || !LEGEND_ICON[kind]) { legendBadge.classList.remove("on"); return; }
  legendBadge.innerHTML = icon(LEGEND_ICON[kind]); legendBadge.style.setProperty("--tint", LEGEND_TINT[kind]);
  legendBadge.title = `Find ${HERO_KINDS[kind].name} (click to centre on her and select her)`;
  legendBadge.classList.add("on");
}
// Clicking the badge finds the legend: the view centres on her and she is selected, ready for an order
legendBadge.addEventListener("click", () => {
  const h = state.hero;
  if (!h || heroPick.style.display !== "none") return;
  const at = h.hp > 0 ? h : h.spawn;
  centerOn(at.x, at.y);
  if (h.hp > 0 && !h.selected) selectHero(h);
  closeMenu();
  canvas.style.cursor = selectedHero() ? "crosshair" : "default";
  sfx("select");
});
function chooseHero(kind) {
  initHero(kind);
  showLegendBadge(kind);
  heroPick.style.display = "none";
  document.getElementById("next").disabled = false;   // hero chosen: the wave and pause buttons come alive
  document.getElementById("pause").disabled = false;
  sfx("select");
}
// Or go it alone: towers only, no legend on the field
function startSolo() {
  state.heroes = []; state.hero = null; state.dog = null; state.eagle = null;
  showLegendBadge(null);
  heroPick.style.display = "none";
  document.getElementById("next").disabled = false;
  document.getElementById("pause").disabled = false;
  sfx("select");
}
document.getElementById("noLegend").addEventListener("click", startSolo);
// Reset: wipe the saved level and carried gold and start from level 1 (two taps, so a slip doesn't do it)
const resetBtn = document.getElementById("resetProgress");
let resetArmed = null;
const resetLbl = resetBtn.querySelector(".lbl");
const disarmReset = () => { clearTimeout(resetArmed); resetArmed = null; resetBtn.classList.remove("armed"); resetLbl.textContent = "Reset progress"; };
resetBtn.addEventListener("click", () => {
  if (!resetArmed) { resetArmed = setTimeout(disarmReset, 3500); resetBtn.classList.add("armed"); resetLbl.textContent = "Tap again to erase progress"; return; }
  disarmReset();
  clearProgress();
  startLevel({ level: 1, hero: "pick" });
});
// Level picker on the legend screen: arrows or type a number, and the chosen level loads
const lvInput = document.getElementById("lvInput");
lvInput.value = level; lvInput.max = MAX_LEVEL;
const goLevel = (n) => { n = clampLevel(n); if (n !== level) startLevel({ level: n, hero: "pick" }); else lvInput.value = n; };
document.getElementById("lvPrev").addEventListener("click", () => goLevel(level - 1));
document.getElementById("lvNext").addEventListener("click", () => goLevel(level + 1));
lvInput.addEventListener("change", () => goLevel(lvInput.value));
lvInput.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") goLevel(lvInput.value); });
document.getElementById("lvPrev").disabled = level <= 1; document.getElementById("lvNext").disabled = level >= MAX_LEVEL;
window.addEventListener("keydown", (ev) => {
  const n = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].indexOf(ev.code);
  if (n >= 0 && !ev.metaKey && !ev.ctrlKey && heroPick.style.display !== "none") chooseHero(["april", "avril", "adrien", "ember", "willow", "meilin"][n]);
});
window.addEventListener("keydown", (ev) => { if (ev.code === "KeyW" && !ev.metaKey && !ev.ctrlKey && heroPick.style.display !== "none") startSolo(); });
document.getElementById("next").disabled = true;          // until a legend is chosen
document.getElementById("pause").disabled = true;
if (preset === "none") startSolo();
for (const card of heroPick.querySelectorAll(".card")) card.addEventListener("click", () => chooseHero(card.dataset.hero));
if (["april", "avril", "ember", "willow", "meilin", "adrien"].includes(preset)) chooseHero(preset);

// Which build spot is under the point? An empty pad is its foreshortened disc; a tower counts over its
// whole body, from the pad up to the roof. Where towers overlap, the one in front (lower on screen) wins.
function spotAt(p) {
  let best = -1, bestY = -Infinity;
  map.spots.forEach((s, i) => {
    const ds = depthScale(s.y), t = state.towers.find((t) => t.spot === i);
    let hit;
    if (!t) hit = Math.hypot(p.x - s.x, (p.y - s.y) / SPOT_SQUASH) <= SPOT_RADIUS * ds + 5;
    else {
      const lv = visLevel(t);
      const h = t.def === TOWERS.archer ? archerHeight(lv) + 30 : t.def === TOWERS.mage ? mageHeight(lv) + 44 : t.def === TOWERS.tesla ? teslaHeight(lv) + 26 : 42;
      hit = Math.abs(p.x - s.x) <= 24 * ds && p.y <= s.y + 14 * ds && p.y >= s.y - h * ds;
    }
    if (hit && s.y > bestY) { best = i; bestY = s.y; }
  });
  return best;
}

// Click the hero to select her, then click anywhere to send her there.
// Click a build spot to open its menu; click empty ground to close it.
canvas.addEventListener("click", (ev) => {
  const r = canvas.getBoundingClientRect();
  const p = { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
  const clicked = heroAt(p), active = selectedHero();
  if (state.rallyFor) {                                   // placing a barracks rally flag
    if (state.towers.includes(state.rallyFor)) setRally(state.rallyFor, p);
    state.rallyFor = null;
    sfx("order");
  } else if (clicked) {                                   // click a hero to select (or deselect) them
    selectHero(clicked);
    sfx(clicked.selected ? "select" : "click");
    closeMenu();
  } else if (active) {
    sendHero(p, active);                                   // one order per selection: deselected after the click
    deselectHeroes();
    sfx("order");
  } else {
    const i = spotAt(p);
    if (i >= 0) { openMenu(i); sfx("click"); } else closeMenu();
  }
  canvas.style.cursor = selectedHero() || state.rallyFor ? "crosshair" : state.hover !== null ? "pointer" : "default";
});

// Highlight the build spot under the mouse
canvas.addEventListener("mousemove", (ev) => {
  const r = canvas.getBoundingClientRect();
  const p = { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
  const i = spotAt(p);
  state.hover = i >= 0 ? i : null;
  // With a hero selected, an animal under the mouse is marked as the would-be target
  state.hoverCritter = selectedHero() ? state.critters.find((c) => dist(c, { x: p.x, y: p.y + 6 }) <= 16) || null : null;
  if (!selectedHero() && !state.rallyFor) canvas.style.cursor = state.hover !== null ? "pointer" : "default";
});
canvas.addEventListener("mouseleave", () => { state.hover = null; state.hoverCritter = null; });

// Sound: browsers need a click or key press before audio may start
for (const evt of ["pointerdown", "keydown"]) window.addEventListener(evt, unlockAudio);
const muteBtn = document.getElementById("mute");
muteBtn.innerHTML = icon(isMuted() ? "volumeOff" : "volume");
const flipMute = () => { muteBtn.innerHTML = icon(toggleMute() ? "volumeOff" : "volume"); };
muteBtn.addEventListener("click", flipMute);
window.addEventListener("keydown", (ev) => { if (ev.code === "KeyM" && !ev.metaKey && !ev.ctrlKey) flipMute(); });
// Keyboard: 1 selects the hero (press again to deselect), Escape deselects everything
window.addEventListener("keydown", (ev) => {
  const hero = state.heroes[0];
  if (ev.key === "1" && hero && hero.hp > 0) {
    selectHero(hero);
    sfx(hero.selected ? "select" : "click");
    closeMenu();
  } else if (ev.key === "Escape") {
    deselectHeroes();
    state.rallyFor = null;
    closeMenu();
  }
  canvas.style.cursor = selectedHero() || state.rallyFor ? "crosshair" : state.hover !== null ? "pointer" : "default";
});

document.getElementById("next").addEventListener("click", startWave);
window.addEventListener("keydown", (ev) => { if (ev.code === "KeyN" && !ev.metaKey && !ev.ctrlKey && heroPick.style.display === "none" && !document.getElementById("next").disabled && !state.paused) startWave(); });   // N: next wave

// Restart: play this same map again from the start, with the same legend (R)
// Start over: a freshly generated map and the legend choice again
// Restart: a small in-game dialog asks for the same map (default) or a freshly generated one
const confirmBox = document.getElementById("confirm");
const pausedView = document.getElementById("paused");
function restartLevel() {
  if (state.over || confirmBox.style.display === "flex") return;
  document.getElementById("confirmLevel").textContent = level;
  confirmBox.style.display = "flex";
  pausedView.style.display = "none";                                  // the restart prompt takes the pause screen's place
  pauseBtn.disabled = true;                                           // and pausing waits until it's answered
}
const closeConfirm = () => {
  confirmBox.style.display = "none";
  if (state.paused) pausedView.style.display = "flex";
  pauseBtn.disabled = state.over || heroPick.style.display !== "none";
};
// Either way the legend screen comes back first
document.getElementById("confirmSame").addEventListener("click", () => { closeConfirm(); startLevel({ level, seed: map.seed, hero: "pick" }); });
document.getElementById("confirmNew").addEventListener("click", () => { closeConfirm(); startLevel({ level, seed: 1 + Math.floor(Math.random() * 999999), hero: "pick" }); });
confirmBox.addEventListener("click", (ev) => { if (ev.target === confirmBox) closeConfirm(); });
window.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && confirmBox.style.display === "flex") closeConfirm(); });
document.getElementById("restart-level").addEventListener("click", restartLevel);
window.addEventListener("keydown", (ev) => { if (ev.code === "KeyR" && !ev.metaKey && !ev.ctrlKey) restartLevel(); });   // R: a fresh map, any time

// Full screen: the round button, or F (hidden where the browser doesn't allow it, e.g. iPhone)
const fsBtn = document.getElementById("fullscreen");
const fsOn = () => !!document.fullscreenElement;
async function toggleFullscreen() {
  // On phones that allow it (Android), full screen also locks the view sideways
  const lockLandscape = () => screen.orientation?.lock?.("landscape").catch(() => {});
  try { if (fsOn()) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); lockLandscape(); } catch (e) { /* not allowed here */ }
}
if (!document.documentElement.requestFullscreen) fsBtn.style.display = "none";
// Touch devices that support it (iPad, Android) go full screen on the first tap, so no button is needed.
// Browsers only allow this from a real user gesture, which is why it can't happen on load.
const touchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
if (touchDevice && document.documentElement.requestFullscreen) {
  fsBtn.style.display = "none";
  const enter = () => { if (!fsOn()) toggleFullscreen(); window.removeEventListener("touchend", enter); window.removeEventListener("pointerup", enter); };
  window.addEventListener("touchend", enter); window.addEventListener("pointerup", enter);
}
fsBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => { fsBtn.innerHTML = icon(fsOn() ? "shrink" : "expand"); fsBtn.title = fsOn() ? "Exit full screen (F)" : "Full screen (F)"; });
window.addEventListener("keydown", (ev) => { if (ev.code === "KeyF" && !ev.metaKey && !ev.ctrlKey) toggleFullscreen(); });

// Pause: the round button, or P / Space
const pauseBtn = document.getElementById("pause");
function setPaused(on) {
  state.paused = on;
  pauseBtn.innerHTML = icon(on ? "play" : "pause");
  pauseBtn.title = on ? "Resume (P)" : "Pause (P)";
  document.getElementById("paused").style.display = on ? "flex" : "none";
  const next = document.getElementById("next");
  if (on) { next.dataset.wasDisabled = next.disabled ? "1" : ""; next.disabled = true; }     // no calling waves while paused
  else next.disabled = next.dataset.wasDisabled === "1";
  sfx("click");
}
pauseBtn.addEventListener("click", () => setPaused(!state.paused));
document.querySelector("#paused span").addEventListener("click", () => setPaused(false));   // the big play button resumes
window.addEventListener("keydown", (ev) => { if ((ev.code === "KeyP" || ev.code === "Space") && heroPick.style.display === "none" && !state.over && !pauseBtn.disabled) { ev.preventDefault(); setPaused(!state.paused); } });

// Main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the game from the browser console.
window.game = { state, map, update, draw, spawnEnemy, startWave, createTower, sendHero };

// Phones held upright: a gentle nudge to turn sideways, where the map fits far better
const rotateHint = document.getElementById("rotate");
function checkOrientation() {
  if (!rotateHint) return;
  const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
  rotateHint.style.display = coarse && window.innerHeight > window.innerWidth ? "flex" : "none";
}
window.addEventListener("resize", checkOrientation);
checkOrientation();

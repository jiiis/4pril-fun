import { canvas } from "./render/gfx.js";
import { state } from "./state.js";
import { W, H, SPOT_RADIUS } from "./config.js";
import { dist } from "./util.js";
import { map, generateMap } from "./map.js";
import { update } from "./update.js";
import { draw, SPOT_SQUASH, depthScale } from "./render/draw.js";
import { initUi, openMenu, closeMenu } from "./ui.js";
import { startWave, spawnEnemy } from "./waves.js";
import { createTower, setRally } from "./towers.js";
import { initCritters } from "./critters.js";
import { initHero, sendHero, selectedHero, selectHero, deselectHeroes, heroAt } from "./hero.js";
import { initTouch } from "./touch.js";
import { icon } from "./icons.js";
import { unlockAudio, toggleMute, isMuted, sfx } from "./audio.js";
import { initWeather } from "./weather.js";

// A new random world every time. Add ?seed=1234 to the URL to replay a map you liked.
const seedParam = Number(new URLSearchParams(location.search).get("seed"));
generateMap(seedParam > 0 ? seedParam : Math.floor(Math.random() * 1e6));

initUi();
initTouch();
initCritters();
initWeather();

// Pick a hero before the round starts (or pass ?hero=april / ?hero=avril in the URL)
const heroPick = document.getElementById("heroPick");
const preset = new URLSearchParams(location.search).get("hero");
function chooseHero(kind) {
  initHero(kind);
  heroPick.style.display = "none";
  document.getElementById("next").disabled = false;   // hero chosen: the wave and pause buttons come alive
  document.getElementById("pause").disabled = false;
  sfx("select");
}
// Or go it alone: towers only, no legend on the field
function startSolo() {
  state.heroes = []; state.hero = null; state.dog = null; state.eagle = null;
  heroPick.style.display = "none";
  document.getElementById("next").disabled = false;
  document.getElementById("pause").disabled = false;
  sfx("select");
}
document.getElementById("noLegend").addEventListener("click", startSolo);
window.addEventListener("keydown", (ev) => {
  const n = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].indexOf(ev.code);
  if (n >= 0 && !ev.metaKey && !ev.ctrlKey && heroPick.style.display !== "none") chooseHero(["april", "avril", "ember", "willow", "meilin"][n]);
});
window.addEventListener("keydown", (ev) => { if (ev.code === "KeyN" && !ev.metaKey && !ev.ctrlKey && heroPick.style.display !== "none") startSolo(); });
if (preset === "none") startSolo();
document.getElementById("next").disabled = true;          // until a legend is chosen
document.getElementById("pause").disabled = true;
for (const card of heroPick.querySelectorAll(".card")) card.addEventListener("click", () => chooseHero(card.dataset.hero));
if (["april", "avril", "ember", "willow", "meilin"].includes(preset)) chooseHero(preset);

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
    const i = map.spots.findIndex((s) => Math.hypot(p.x - s.x, (p.y - s.y) / SPOT_SQUASH) <= SPOT_RADIUS * depthScale(s.y) + 5);
    if (i >= 0) { openMenu(i); sfx("click"); } else closeMenu();
  }
  canvas.style.cursor = selectedHero() || state.rallyFor ? "crosshair" : state.hover !== null ? "pointer" : "default";
});

// Highlight the build spot under the mouse
canvas.addEventListener("mousemove", (ev) => {
  const r = canvas.getBoundingClientRect();
  const p = { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
  const i = map.spots.findIndex((s) => Math.hypot(p.x - s.x, (p.y - s.y) / SPOT_SQUASH) <= SPOT_RADIUS * depthScale(s.y) + 5);
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
muteBtn.addEventListener("click", () => { muteBtn.innerHTML = icon(toggleMute() ? "volumeOff" : "volume"); });
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

// Restart: play this same map again from the start, with the same legend (R)
// Start over: a freshly generated map and the legend choice again
function restartLevel() { location.href = location.pathname; }
document.getElementById("restart-level").addEventListener("click", restartLevel);
window.addEventListener("keydown", (ev) => { if (ev.code === "KeyR" && !ev.metaKey && !ev.ctrlKey && heroPick.style.display === "none") restartLevel(); });

// Full screen: the round button, or F (hidden where the browser doesn't allow it, e.g. iPhone)
const fsBtn = document.getElementById("fullscreen");
const fsOn = () => !!document.fullscreenElement;
async function toggleFullscreen() {
  // On phones that allow it (Android), full screen also locks the view sideways
  const lockLandscape = () => screen.orientation?.lock?.("landscape").catch(() => {});
  try { if (fsOn()) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); lockLandscape(); } catch (e) { /* not allowed here */ }
}
if (!document.documentElement.requestFullscreen) fsBtn.style.display = "none";
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
window.addEventListener("keydown", (ev) => { if ((ev.code === "KeyP" || ev.code === "Space") && heroPick.style.display === "none" && !state.over) { ev.preventDefault(); setPaused(!state.paused); } });

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
  const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
  rotateHint.style.display = coarse && window.innerHeight > window.innerWidth ? "flex" : "none";
}
window.addEventListener("resize", checkOrientation);
checkOrientation();

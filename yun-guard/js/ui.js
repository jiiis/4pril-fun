import { state } from "./state.js";
import { TOWERS, W, H } from "./config.js";
import { MAX_LEVEL, saveLevel, saveCarry } from "./levels.js";
import { map } from "./map.js";
import { towerRange, towerDamage, upgradeCost, sellValue, canUpgrade, canSpecialise, abilityCost, abilityDef, soldierCount, soldierHp, soldierDamage, createTower } from "./towers.js";
import { ABILITIES } from "./config.js";
import { icon, applyIcons } from "./icons.js";
import { clamp } from "./util.js";
import { sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);

export function refreshHud() {
  $("gold").textContent = state.gold;
  $("lives").textContent = state.lives;
  $("wave").textContent = state.wave;
  refreshMenu();
}

// Keep an open menu in sync with the gold you have: options unlock as soon as you can afford them.
function refreshMenu() {
  if (state.selected === null) return;
  for (const b of $("menu").querySelectorAll("button[data-cost]")) b.disabled = state.gold < Number(b.dataset.cost);
}

// The big round button: ▶ before the first wave, ⏩ with a countdown badge between waves (press early for
// bonus gold), crossed swords while a wave is on, an hourglass when the game is over.
export function setWaveButton(mode, seconds) {
  const b = $("next"), face = b.querySelector(".face"), badge = $("nextBadge");
  b.classList.toggle("ready", mode === "ready" || mode === "start");
  b.disabled = mode === "busy" || mode === "over" || state.paused;
  b.title = mode === "start" ? "Start the first wave (N)" : mode === "ready" ? "Call the next wave now for bonus gold (N)" : mode === "busy" ? "Wave in progress" : "Game over";
  face.innerHTML = icon(mode === "start" ? "swords" : mode === "ready" ? "forward" : mode === "busy" ? "hourglass" : "x");
  badge.classList.toggle("on", mode === "ready");
  if (mode === "ready") badge.textContent = Math.ceil(Math.max(seconds, 0));
}

export function endGame(won) {
  state.over = true;
  state.paused = false;
  $("paused").style.display = "none";
  $("pause").disabled = true;
  setWaveButton("over");
  const L = state.level, last = L >= MAX_LEVEL;
  const carried = won && !last ? saveCarry(L + 1, state.gold) : 0;          // 75% of the gold left travels to the next level
  $("overlayTitle").textContent = won ? (last ? "Kingdom saved!" : `Level ${L} complete!`) : "Game Over";
  $("overlayText").textContent = won
    ? (last ? `You held every one of the ${MAX_LEVEL} levels. Legendary!` : `All ${state.totalWaves} waves beaten. ${carried} gold (75% of what's left) goes with you to level ${L + 1}.`)
    : `The monsters broke through on wave ${state.wave} of level ${L}. Try a different tower mix!`;
  $("overlay").style.display = "flex";
  sfx(won ? "victory" : "gameOver");
  // Won: the next level is unlocked and starts by itself in a few seconds (or at a click). Lost: try this level again.
  const btn = $("restart"), alt = $("changeLegend");
  if (won && !last) {
    saveLevel(L + 1);
    const hero = state.hero ? state.hero.kind : "none";
    let left = 8;
    const go = () => startLevel({ level: L + 1, hero });               // straight in, same legend
    const tick = () => { btn.textContent = `Next level  ·  ${left}s`; if (left-- <= 0) go(); else endTimer = setTimeout(tick, 1000); };
    tick();
    btn.onclick = go;
    alt.style.display = "";
    alt.onclick = () => { clearTimeout(endTimer); startLevel({ level: L + 1, hero: "pick" }); };   // pick a legend first
  } else {
    alt.style.display = "none";
    btn.textContent = won ? "Play again from level 1" : "Try again";
    btn.onclick = () => startLevel(won ? { level: 1, hero: "pick" } : { level: L, seed: map.seed, hero: state.hero ? state.hero.kind : "none" });
  }
}
let endTimer = null;

// ---------- Build / upgrade menu ----------
export function openMenu(spotIndex) {
  state.selected = spotIndex;
  const s = map.spots[spotIndex];
  const tower = state.towers.find((t) => t.spot === spotIndex);
  let html = "";
  if (tower) {
    const ab = abilityDef(tower);
    html += `<div class="head"><span class="title">${icon(tower.def.icon)} ${ab ? ab.name : tower.def.name}</span><span class="lv">${ab ? icon(ab.icon) + " " : ""}Lv ${tower.level}</span></div>`;
    const stat = (label, value) => `<span class="stat"><small>${label}</small><b>${value}</b></span>`;
    html += `<div class="stats">` + (tower.def.soldiers
      ? stat("Damage", soldierDamage(tower)) + stat("Health", soldierHp(tower)) + stat("Soldiers", soldierCount(tower))
      : stat("Damage", towerDamage(tower)) + stat("Range", towerRange(tower)) + (tower.def.chain ? stat("Hops", tower.def.chain + tower.level - 1) : tower.def.splash ? stat("Splash", tower.def.splash) : stat("Rate", `${tower.def.rate}/s`)))
      + `</div>`;
    html += `<div class="row">`;
    if (canUpgrade(tower)) {
      const c = upgradeCost(tower);
      html += `<button class="pill primary" data-action="upgrade" data-cost="${c}" ${state.gold < c ? "disabled" : ""}>Upgrade <b>${c}</b></button>`;
    } else if (canSpecialise(tower)) {
      const c = abilityCost(tower);
      html += `</div><div class="hint">Choose a level 4 ability</div><div class="grid two">`;
      for (const key in ABILITIES[tower.type]) {
        const a = ABILITIES[tower.type][key];
        html += `<button class="tile" data-action="ability" data-ability="${key}" data-cost="${c}" data-desc="${a.desc}" ${state.gold < c ? "disabled" : ""}>
          <span class="big">${icon(a.icon)}</span><span class="nm">${a.name}</span><span class="cost">${c}</span></button>`;
      }
      html += `</div><div class="hint">Hover an ability to see what it does</div><div class="row">`;
    } else html += `<button class="pill" disabled>Max level</button>`;
    if (tower.def.soldiers) html += `<button class="pill" data-action="rally" title="Move rally point">${icon("flag")}</button>`;
    html += `<button class="pill sell" data-action="sell">Sell <b>+${sellValue(tower)}</b></button>`;
    html += `</div>`;
  } else {
    html += `<div class="head"><span class="title">Build</span><span class="lv">${icon("coins")} ${state.gold}</span></div><div class="grid">`;
    for (const key in TOWERS) {
      const d = TOWERS[key];
      html += `<button class="tile" data-action="build" data-type="${key}" data-cost="${d.cost}" data-desc="${d.desc}" ${state.gold < d.cost ? "disabled" : ""}>
        <span class="big">${icon(d.icon)}</span><span class="nm">${d.short || d.name}</span><span class="cost">${d.cost}</span></button>`;
    }
    html += `</div><div class="hint">Pick a tower</div>`;
  }

  const menu = $("menu");
  menu.innerHTML = html;
  menu.style.display = "block";
  state.preview = null;
  placeMenu();
}
// The menu floats over the page in screen pixels (so it never scales with the board), next to its spot
export function placeMenu() {
  const menu = $("menu");
  if (state.selected === null || menu.style.display === "none") return;
  const s = map.spots[state.selected], r = $("c").getBoundingClientRect(), k = r.width / W;
  const sx = r.left + s.x * k, sy = r.top + s.y * k, mw = menu.offsetWidth, mh = menu.offsetHeight;
  const vw = pageW(), vh = pageH();
  // Prefer below the spot; flip above if that runs off the screen; always stay on screen
  let top = sy + 30 * k;
  if (top + mh > vh - 6) top = sy - mh - 34 * k;
  menu.style.left = `${clamp(sx - mw / 2, 6, vw - mw - 6)}px`;
  menu.style.top = `${clamp(top, 6, vh - mh - 6)}px`;
}

export function closeMenu() {
  state.selected = null;
  state.preview = null;
  $("menu").style.display = "none";
}

function handleMenuClick(ev) {
  const btn = ev.target.closest("button");
  if (!btn) return;
  const spot = state.selected;
  const tower = state.towers.find((t) => t.spot === spot);
  const action = btn.dataset.action;

  if (action === "build") {
    const def = TOWERS[btn.dataset.type];
    if (view.mobile && state.preview !== btn.dataset.type) {        // phones have no hover: the first tap shows the ghost, the second builds
      state.preview = btn.dataset.type;
      for (const t of $("menu").querySelectorAll(".tile")) t.classList.toggle("armed", t === btn);
      $("menu").querySelector(".hint").textContent = "Tap again to build";
      return;
    }
    if (state.gold >= def.cost) {
      state.gold -= def.cost;
      state.towers.push(createTower(spot, btn.dataset.type));
      sfx("build");
    }
    closeMenu();
  } else if (action === "upgrade" && tower) {
    const c = upgradeCost(tower);
    if (state.gold >= c) { state.gold -= c; tower.spent += c; tower.level++; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "ability" && tower) {
    const c = abilityCost(tower);
    if (state.gold >= c) { state.gold -= c; tower.spent += c; tower.level++; tower.ability = btn.dataset.ability; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "rally" && tower) {
    state.rallyFor = tower;                       // the next click on the map places the flag
    document.getElementById("c").style.cursor = "crosshair";
    sfx("click");
    closeMenu();
  } else if (action === "sell" && tower) {
    state.gold += sellValue(tower);
    state.towers = state.towers.filter((t) => t !== tower);
    sfx("sell");
    closeMenu();
  } else {
    sfx("click");
    closeMenu();
  }
  refreshHud();
}

// Scale the whole board to fill the browser window.
// The board always fills the screen: shown at its natural size, or scaled up (never down) when the window is
// larger than it. Whatever sticks out past the screen is reached by dragging (see touch.js).
export const view = { k: 1, fit: 1, panX: 0, panY: 0, mobile: false };
const MAX_ZOOM = 2, MIN_ZOOM = 0.6;                              // small screens may shrink the board to see more of it; pads stay tappable
const hudH = () => 0;                                           // the HUD floats over the board, so the whole window is for the map
// The page (html/body) is sized to the dynamic viewport; measure it rather than window.innerHeight, which
// phones report late and inconsistently while their toolbars slide
export const pageW = () => document.body.clientWidth || window.innerWidth;
export const pageH = () => document.body.clientHeight || window.innerHeight;
export function fitToWindow() {
  view.mobile = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
  document.documentElement.style.setProperty("--hud", `${hudH()}px`);
  // The board is scaled to the window's height (never below natural size, never more than 2×); the width
  // follows proportionally, so a wide screen gets quiet borders at the sides and a narrow one pans sideways.
  view.k = view.fit = clamp((pageH() - hudH()) / H, MIN_ZOOM, MAX_ZOOM);
  applyView();
}
// Zoom so the board point under the screen position (sx, sy) stays put: pinch on a phone, ctrl+wheel on a trackpad
export function zoomTo(k, sx, sy) {
  if (document.fullscreenElement) return;                        // full screen is the fixed, fitted view: no zooming
  k = clamp(k, Math.max(MIN_ZOOM, view.fit * 0.8), Math.min(MAX_ZOOM, view.fit * 1.8));   // only a little out, a fair bit in, from the natural fit
  const cx = pageW() / 2, cy = (pageH() - hudH()) / 2;
  const ux = (sx - cx - view.panX) / view.k, uy = (sy - cy - view.panY) / view.k;   // board offset (from its centre) under the finger
  view.panX = sx - cx - ux * k; view.panY = sy - cy - uy * k; view.k = k;
  applyView();
}
export const canPan = () => W * view.k > pageW() + 1 || H * view.k > pageH() - hudH() + 1;
export function panBy(dx, dy) { view.panX += dx; view.panY += dy; applyView(); }
// Bring a board point to the middle of the screen (as far as the board's edges allow)
export function centerOn(x, y) { view.panX = -(x - W / 2) * view.k; view.panY = -(y - H / 2) * view.k; applyView(); }
function applyView() {
  const maxX = Math.max(0, (W * view.k - pageW()) / 2), maxY = Math.max(0, (H * view.k - (pageH() - hudH())) / 2);   // never pan past the board's edge
  view.panX = clamp(view.panX, -maxX, maxX); view.panY = clamp(view.panY, -maxY, maxY);
  $("wrap").style.transform = `translate(calc(-50% + ${view.panX}px), calc(-50% + ${view.panY}px)) scale(${view.k})`;
  placeMenu();                                                  // the open menu follows its spot as the view moves
}

// A fresh level in the same page (no reload, so full screen survives): clear the end screen, reset the HUD
export function resetUiForLevel() {
  clearTimeout(endTimer);
  $("overlay").style.display = "none";
  $("paused").style.display = "none";
  closeMenu();
  setWaveButton("start");
  $("totalWaves").textContent = state.totalWaves;
  $("lvl").textContent = state.level;
  $("seed").textContent = map.seed;
  $("seedLink").href = `#${map.seed}`;
  refreshHud();
}
const startLevel = (detail) => window.dispatchEvent(new CustomEvent("startLevel", { detail }));   // handled in main.js

export function initUi() {
  $("totalWaves").textContent = state.totalWaves;
  $("lvl").textContent = state.level;
  applyIcons();
  setWaveButton("start");
  $("menu").addEventListener("click", handleMenuClick);
  // Hovering a tower option shows a ghost of it on the spot, with its range
  $("menu").addEventListener("mouseover", (ev) => { const b = ev.target.closest(".tile[data-action=build]"); if (b) state.preview = b.dataset.type; });
  $("menu").addEventListener("mouseleave", () => { if (!view.mobile) state.preview = null; });
  $("menu").addEventListener("mouseover", (ev) => {                 // hovering a tile shows what that tower does
    const tile = ev.target.closest(".tile"), hint = $("menu").querySelector(".hint");
    if (tile && hint) hint.textContent = tile.dataset.desc;
  });
  $("seed").textContent = map.seed;
  // Clicking the map number puts #seed in the address bar and copies the link, so the map can be shared
  $("seedLink").href = `#${map.seed}`;
  $("seedLink").addEventListener("click", () => {
    const url = `${location.origin}${location.pathname}#${map.seed}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  });
  window.addEventListener("resize", fitToWindow);
  // Phones report their final viewport late and sometimes without a resize event (iOS toolbars settling after load,
  // rotation, returning from the background): re-fit on every signal we can get, and once more shortly after load
  let lastW = pageW(), lastH = pageH();
  const refit = () => { if (pageW() !== lastW || pageH() !== lastH) { lastW = pageW(); lastH = pageH(); fitToWindow(); } };   // only when the size really changed, so a player's zoom isn't reset for nothing
  if (window.ResizeObserver) new ResizeObserver(refit).observe(document.body);   // the body follows the dynamic viewport; the board follows the body
  window.visualViewport?.addEventListener("resize", refit);
  window.addEventListener("orientationchange", () => { refit(); setTimeout(refit, 300); });
  window.addEventListener("pageshow", refit);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refit(); });
  for (const t of [100, 400, 1000, 2000]) setTimeout(refit, t);
  fitToWindow();
  refreshHud();
}

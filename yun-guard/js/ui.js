import { state } from "./state.js";
import { TOWERS, W, H } from "./config.js";
import { MAX_LEVEL, saveLevel, saveCarry } from "./levels.js";
import { map } from "./map.js";
import { upgradeCost, sellValue, canUpgrade, canSpecialise, abilityCost, createTower, skillCost, specialize, trainSkill } from "./towers.js";
import { towerInspector, buildInspector, enemyInspector } from "./inspector.js";
import { radialMenu, placeRadial } from "./radial.js";
import { SPECIALIZATIONS } from "./specializations.js";
import { ABILITIES } from "./config.js";
import { icon, applyIcons } from "./icons.js";
import { clamp } from "./util.js";
import { sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);
const MENU_STYLE_KEY = "yunguard.menuStyle";
let menuStyle = "inspector";
let radialPage = "main", radialPreview = null;

function initMenuStyle() {
  try {
    const saved = localStorage.getItem(MENU_STYLE_KEY);
    if (["inspector", "floating", "radial"].includes(saved)) menuStyle = saved;
  } catch (e) { /* private mode: use the default */ }
  const buttons = document.querySelectorAll("button[data-menu-style]");
  const apply = () => {
    $("menu").classList.toggle("floating", menuStyle === "floating");
    $("menu").classList.remove("radial");
    for (const button of buttons) button.setAttribute("aria-pressed", button.dataset.menuStyle === menuStyle);
    radialPage = "main"; radialPreview = null;
    if (state.selected !== null) openMenu(state.selected);
    else placeMenu();
  };
  for (const button of buttons) button.addEventListener("click", () => {
    menuStyle = button.dataset.menuStyle;
    try { localStorage.setItem(MENU_STYLE_KEY, menuStyle); } catch (e) { /* keep the choice for this session */ }
    apply();
  });
  apply();
}

export function refreshHud() {
  $("gold").textContent = state.gold;
  $("lives").textContent = state.lives;
  $("wave").textContent = state.wave;
  refreshMenu();
}

// Keep an open menu in sync with the gold you have: options unlock as soon as you can afford them.
function refreshMenu() {
  if (state.selected === null) return;
  for (const b of $("menu").querySelectorAll("button[data-cost]")) {
    const unaffordable = state.gold < Number(b.dataset.cost);
    if (b.dataset.preview) b.classList.toggle("unaffordable", unaffordable);
    else b.disabled = unaffordable;
  }
}

// The big round button: ▶ before the first wave, ⏩ with a countdown badge between waves (press early for
// bonus gold), crossed swords while a wave is on, an hourglass when the game is over.
let waveBtnKey = "";
export function setWaveButton(mode, seconds) {
  const key = `${mode}|${seconds === undefined ? "" : Math.ceil(Math.max(seconds, 0))}|${state.paused}`;
  if (key === waveBtnKey) return;                               // called every frame: only touch the DOM on a change
  waveBtnKey = key;
  const b = $("next"), face = b.querySelector(".face"), badge = $("nextBadge");
  b.classList.toggle("ready", mode === "ready" || mode === "start");
  b.disabled = mode === "busy" || mode === "over" || state.paused;
  b.title = mode === "start" ? "Start the first wave (N)" : mode === "ready" ? "Call the next wave now for bonus gold (N)" : mode === "busy" ? "Wave in progress" : "Game over";
  face.innerHTML = icon(mode === "start" ? "swords" : mode === "ready" ? "forward" : mode === "busy" ? "hourglass" : "x");
  const showCount = mode === "ready" && seconds !== undefined && seconds <= 10;              // the number only appears for the last 10 seconds
  badge.classList.toggle("on", showCount);
  if (showCount) badge.textContent = Math.ceil(Math.max(seconds, 0));
}

export function endGame(won) {
  state.over = true;
  state.paused = false;
  $("paused").style.display = "none";
  $("pause").disabled = true;
  setWaveButton("over");
  const L = state.level, last = L >= MAX_LEVEL;
  const carry = won && !last ? saveCarry(L + 1, state.gold, state.lives) : null;   // 75% of the gold left + 10 per villager, capped, travels on
  $("overlayTitle").textContent = won ? (last ? "Kingdom saved!" : `Level ${L} complete!`) : "Game Over";
  $("overlayText").textContent = won
    ? (last ? `You held every one of the ${MAX_LEVEL} levels. Legendary!` : `All ${state.totalWaves} waves beaten. ${carry.gold} gold goes with you to level ${L + 1}: ${carry.fromGold} from your purse and ${carry.fromLives} for the ${state.lives} villagers you kept safe${carry.capped ? " (capped at 600)" : ""}.`)
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

// ---------- Tower / monster inspector ----------
function showInspector(html, label, preserveScroll = false) {
  const menu = $("menu"), scroll = preserveScroll ? menu.querySelector(".inspector-content")?.scrollTop || 0 : 0;
  const outerScroll = preserveScroll ? menu.scrollTop : 0;
  menu.innerHTML = html;
  menu.classList.remove("radial");
  menu.setAttribute("role", "region");
  menu.setAttribute("aria-label", label);
  menu.style.display = "flex";
  menu.querySelector(".inspector-content").scrollTop = scroll;
  menu.scrollTop = outerScroll;
  placeMenu();
}

export function openMenu(spotIndex) {
  const sameSpot = state.selected === spotIndex && !state.inspectedEnemy;
  if (!sameSpot) { radialPage = "main"; radialPreview = null; }
  state.inspectedEnemy = null;
  state.selected = spotIndex;
  const tower = state.towers.find((t) => t.spot === spotIndex);
  const tab = tower && sameSpot ? $("menu").dataset.tab || undefined : undefined;
  if (menuStyle === "radial") {
    const menu = $("menu");
    menu.innerHTML = radialMenu(tower, radialPage, radialPreview);
    menu.classList.remove("floating");
    menu.classList.add("radial");
    menu.setAttribute("role", "region");
    menu.setAttribute("aria-label", tower ? `${tower.def.name} actions` : "Build actions");
    menu.style.display = "block";
    menu.scrollTop = 0;
    placeMenu();
  } else showInspector(tower ? towerInspector(tower, tab) : buildInspector(), tower ? "Tower inspector" : "Build a tower", sameSpot);
  $("menu").dataset.tab = $("menu").querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab || "";
  state.preview = null;
}

// Monster defenses remain a snapshot; the inspector does not update the DOM every frame.
export function openEnemyInfo(enemy) {
  closeMenu();
  state.inspectedEnemy = { x: enemy.x, y: enemy.y, def: enemy.def };
  showInspector(enemyInspector(enemy), "Monster inspector");
}

// Dock beside the battlefield, or below it on a portrait phone. Leave the HUD controls accessible.
export function placeMenu() {
  const menu = $("menu");
  if (menu.style.display === "none") return;
  const origin = document.body.getBoundingClientRect(), vh = pageH();
  const top = Math.ceil($("hud").querySelector(".hud-left").getBoundingClientRect().bottom - origin.top) + 12;
  const bottom = Math.ceil(vh - ($("hud").querySelector(".hud-right").getBoundingClientRect().top - origin.top)) + 12;
  menu.style.setProperty("--inspector-top", `${Math.max(12, top)}px`);
  menu.style.setProperty("--inspector-bottom", `${Math.max(12, bottom)}px`);
  if (menu.classList.contains("radial")) {
    const point = map.spots[state.selected];
    if (!point) return;
    placeRadial(menu, { point, board: $("c").getBoundingClientRect(), origin, width: pageW(), height: vh, top, bottom });
    return;
  }
  if (menuStyle === "floating") {
    const point = state.inspectedEnemy || map.spots[state.selected];
    if (!point) return;
    const r = $("c").getBoundingClientRect(), k = r.width / W;
    const sx = r.left - origin.left + point.x * k, sy = r.top - origin.top + point.y * k;
    const minTop = Math.max(12, top), maxBottom = vh - Math.max(12, bottom);
    menu.style.setProperty("--floating-height", `${Math.max(72, Math.min(540, maxBottom - minTop))}px`);
    const width = menu.offsetWidth, height = menu.offsetHeight;
    let y = sy + 30 * k;
    if (y + height > maxBottom) y = sy - height - 34 * k;
    menu.style.setProperty("--floating-left", `${clamp(sx - width / 2, 12, pageW() - width - 12)}px`);
    menu.style.setProperty("--floating-top", `${clamp(y, minTop, Math.max(minTop, maxBottom - height))}px`);
  }
}

export function closeMenu() {
  radialPage = "main"; radialPreview = null;
  state.selected = null;
  state.inspectedEnemy = null;
  state.preview = null;
  state.previewUpgrade = false;
  $("menu").style.display = "none";
}

function handleMenuClick(ev) {
  const btn = ev.target.closest("button");
  if (!btn || btn.disabled) return;
  const spot = state.selected;
  const tower = state.towers.find((t) => t.spot === spot);
  const action = btn.dataset.action;

  if (action === "close") { closeMenu(); return; }
  if (action === "details") { radialPreview = radialPreview === "tower" ? null : "tower"; openMenu(spot); return; }
  if (action === "radial-page") { radialPage = btn.dataset.page; radialPreview = null; openMenu(spot); return; }
  if (action === "radial-preview") { radialPreview = btn.dataset.preview; openMenu(spot); return; }
  if (action === "radial-dismiss") { radialPreview = null; openMenu(spot); return; }
  if (action === "radial-back") { radialPage = "main"; radialPreview = null; openMenu(spot); return; }
  if (action === "tab") {
    const tab = btn.dataset.tab, menu = $("menu");
    menu.dataset.tab = tab;
    for (const b of menu.querySelectorAll('[role="tab"]')) b.setAttribute("aria-selected", b.dataset.tab === tab);
    for (const panel of menu.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== tab;
    menu.querySelector(".inspector-content").scrollTop = 0;
    menu.scrollTop = 0;
    return;
  }
  if (action === "build") {
    const def = TOWERS[btn.dataset.type];
    if (view.mobile && state.preview !== btn.dataset.type) {        // phones have no hover: the first tap shows the ghost, the second builds
      state.preview = btn.dataset.type;
      for (const t of $("menu").querySelectorAll(".tile")) t.classList.toggle("armed", t === btn);
      $("menu").querySelector(".hint").textContent = $("menu").classList.contains("radial") ? "Tap again" : "Tap again to build";
      return;
    }
    if (state.gold >= def.cost) {
      state.gold -= def.cost;
      state.towers.push(createTower(spot, btn.dataset.type));
      sfx("build");
      openMenu(spot);
    }
  } else if (action === "upgrade" && tower && canUpgrade(tower)) {
    const c = upgradeCost(tower);
    if (state.gold >= c) { state.gold -= c; tower.spent += c; tower.level++; if (canSpecialise(tower)) $("menu").dataset.tab = "upgrades"; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "specialize" && tower && canSpecialise(tower)) {
    const key = btn.dataset.specialization, spec = SPECIALIZATIONS[tower.type]?.[key];
    if (spec && state.gold >= spec.cost && specialize(tower, key)) { state.gold -= spec.cost; $("menu").dataset.tab = "upgrades"; radialPage = "skills"; radialPreview = null; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "skill" && tower) {
    const cost = skillCost(tower, btn.dataset.skill);
    if (cost !== null && state.gold >= cost && trainSkill(tower, btn.dataset.skill)) { state.gold -= cost; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "ability" && tower && canSpecialise(tower) && ABILITIES[tower.type]?.[btn.dataset.ability]) {
    const c = abilityCost(tower);
    if (state.gold >= c) { state.gold -= c; tower.spent += c; tower.level++; tower.ability = btn.dataset.ability; radialPage = "main"; radialPreview = "tower"; sfx("upgrade"); }
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
export const viewport = { left: 0, top: 0, right: W, bottom: H };
const MAX_ZOOM = 2, MIN_ZOOM = 0.6;                              // small screens may shrink the board to see more of it; pads stay tappable
const hudH = () => 0;                                           // the HUD floats over the board, so the whole window is for the map
// The page (html/body) is sized to the dynamic viewport; measure it rather than window.innerHeight, which
// phones report late and inconsistently while their toolbars slide
export const pageW = () => document.body.clientWidth || window.innerWidth;
export const pageH = () => document.body.clientHeight || window.innerHeight;
export const hasPageOverflow = () => pageW() > document.documentElement.clientWidth;
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
  const origin = document.body.getBoundingClientRect();
  sx -= origin.left; sy -= origin.top;                          // pointer coordinates stay correct when the wider page is scrolled
  k = clamp(k, Math.max(MIN_ZOOM, view.fit * 0.8), Math.min(MAX_ZOOM, view.fit * 1.8));   // only a little out, a fair bit in, from the natural fit
  const cx = pageW() / 2, cy = (pageH() - hudH()) / 2;
  const ux = (sx - cx - view.panX) / view.k, uy = (sy - cy - view.panY) / view.k;   // board offset (from its centre) under the finger
  view.panX = sx - cx - ux * k; view.panY = sy - cy - uy * k; view.k = k;
  applyView();
}
export const canPan = () => W * view.k > pageW() + 1 || H * view.k > pageH() - hudH() + 1;
export function panBy(dx, dy) { view.panX += dx; view.panY += dy; applyView(); }
export function centerOn(point) {
  view.panX = (W / 2 - point.x) * view.k;
  view.panY = (H / 2 - point.y) * view.k;
  applyView();
}
function applyView() {
  const width = pageW(), height = pageH() - hudH();
  const maxX = Math.max(0, (W * view.k - width) / 2), maxY = Math.max(0, (H * view.k - height) / 2);   // never pan past the board's edge
  view.panX = clamp(view.panX, -maxX, maxX); view.panY = clamp(view.panY, -maxY, maxY);
  viewport.left = W / 2 - (width / 2 + view.panX) / view.k;
  viewport.top = H / 2 - (height / 2 + view.panY) / view.k;
  viewport.right = viewport.left + width / view.k;
  viewport.bottom = viewport.top + height / view.k;
  $("wrap").style.transform = `translate(calc(-50% + ${view.panX}px), calc(-50% + ${view.panY}px)) scale(${view.k})`;
  placeMenu();                                                  // keep the dock clear of the HUD as the viewport changes
}

// A fresh level in the same page (no reload, so full screen survives): clear the end screen, reset the HUD
export function resetUiForLevel() {
  clearTimeout(endTimer);
  waveBtnKey = "";
  $("overlay").style.display = "none";
  $("paused").style.display = "none";
  closeMenu();
  applyView();
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
  initMenuStyle();
  setWaveButton("start");
  $("menu").addEventListener("click", handleMenuClick);
  $("menu").addEventListener("keydown", (ev) => {
    if (ev.target.getAttribute("role") !== "tab") return;
    const tabs = [...$("menu").querySelectorAll('[role="tab"]')], i = tabs.indexOf(ev.target);
    const next = ev.key === "ArrowRight" ? (i + 1) % tabs.length : ev.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : ev.key === "Home" ? 0 : ev.key === "End" ? tabs.length - 1 : null;
    if (next !== null) { ev.preventDefault(); tabs[next].focus(); tabs[next].click(); }
  });
  // Hovering a tower option shows a ghost of it on the spot, with its range
  $("menu").addEventListener("mouseover", (ev) => { const b = ev.target.closest(".tile[data-action=build]"); if (b) state.preview = b.dataset.type; });
  $("menu").addEventListener("mouseleave", () => { if (!view.mobile) state.preview = null; state.previewUpgrade = false; });
  // Hovering Upgrade (or a level-4 ability) shows the range the tower would have afterwards
  $("menu").addEventListener("mouseover", (ev) => { state.previewUpgrade = !!ev.target.closest("[data-action=upgrade], .tile[data-action=ability]"); });
  $("menu").addEventListener("mouseover", (ev) => {                 // hovering a tile shows what that tower does
    const tile = ev.target.closest(".tile"), hint = $("menu").querySelector(".hint");
    if (tile && hint && !$("menu").classList.contains("radial")) hint.textContent = tile.dataset.desc;
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

import { state } from "./state.js";
import { TOWERS, ARMOR_CLASSES, DAMAGE_TYPES, W, H } from "./config.js";
import { MAX_LEVEL, saveLevel, saveCarry } from "./levels.js";
import { map } from "./map.js";
import { towerRange, towerDamage, towerRate, upgradeCost, sellValue, canUpgrade, canSpecialise, abilityCost, abilityDef, soldierCount, soldierHp, soldierDamage, createTower, specializationDef, skillRank, skillCost, specialize, trainSkill } from "./towers.js";
import { SPECIALIZATIONS } from "./specializations.js";
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

// ---------- Build / upgrade menu ----------
export function openMenu(spotIndex) {
  state.inspectedEnemy = null;
  state.selected = spotIndex;
  const s = map.spots[spotIndex];
  const tower = state.towers.find((t) => t.spot === spotIndex);
  let html = "";
  if (tower) {
    const spec = specializationDef(tower), ab = spec || abilityDef(tower);
    html += `<div class="head"><span class="title">${icon(tower.def.icon)} ${ab ? ab.name : tower.def.name}</span><span class="lv">${ab ? icon(ab.icon) + " " : ""}Lv ${tower.level}</span></div>`;
    const stat = (label, value) => `<span class="stat"><small>${label}</small><b>${value}</b></span>`;
    html += `<div class="stats">` + (tower.def.soldiers
      ? stat("Damage", soldierDamage(tower)) + stat("Health", soldierHp(tower)) + stat(spec ? tower.specialization === "brood" ? "Adults" : "Units" : "Soldiers", soldierCount(tower))
      : stat("Damage", towerDamage(tower)) + stat("Range", towerRange(tower)) + (tower.def.chain ? stat("Hops", tower.def.chain + tower.level - 1) : tower.def.splash ? stat("Splash", tower.def.splash) : stat("Rate", `${towerRate(tower).toFixed(1)}/s`)))
      + `</div><div class="damage-profile">${DAMAGE_TYPES[spec?.type || tower.def.type].name} damage · ${spec?.desc || tower.def.desc}</div>`;
    html += `<div class="row">`;
    if (canUpgrade(tower)) {
      const c = upgradeCost(tower);
      html += `<button class="pill primary" data-action="upgrade" data-cost="${c}" ${state.gold < c ? "disabled" : ""}>Upgrade <b>${c}</b></button>`;
    } else if (canSpecialise(tower) && SPECIALIZATIONS[tower.type]) {
      html += `</div><div class="hint">Choose one specialization. Skills are purchased separately.</div><div class="specializations">`;
      for (const [key, a] of Object.entries(SPECIALIZATIONS[tower.type])) {
        html += `<button class="specialization" data-action="specialize" data-specialization="${key}" data-cost="${a.cost}" ${state.gold < a.cost ? "disabled" : ""}>
          <span class="skill-heading">${icon(a.icon)} <strong>${a.name}</strong><b>${a.cost}</b></span><span class="skill-desc">${a.desc}</span></button>`;
      }
      html += `</div><div class="row">`;
    } else if (canSpecialise(tower)) {
      const c = abilityCost(tower);
      html += `</div><div class="hint">Choose a level 4 ability</div><div class="grid two">`;
      for (const key in ABILITIES[tower.type]) {
        const a = ABILITIES[tower.type][key];
        html += `<button class="tile" data-action="ability" data-ability="${key}" data-cost="${c}" data-desc="${a.desc}" ${state.gold < c ? "disabled" : ""}>
          <span class="big">${icon(a.icon)}</span><span class="nm">${a.name}</span><span class="cost">${c}</span></button>`;
      }
      html += `</div><div class="hint">Hover an ability to see what it does</div><div class="row">`;
    } else if (spec) {
      html += `</div><div class="skills">`;
      for (const [key, skill] of Object.entries(spec.skills)) {
        const rank = skillRank(tower, key), cost = skillCost(tower, key), maxed = cost === null;
        html += `<button class="skill" data-action="skill" data-skill="${key}" ${maxed ? "" : `data-cost="${cost}"`} ${maxed || state.gold < cost ? "disabled" : ""}>
          <span class="skill-heading"><strong>${skill.name}</strong><span>${rank}/${skill.costs.length}</span><b>${maxed ? "MAX" : cost}</b></span>
          <span class="skill-desc">${maxed ? skill.descriptions[rank - 1] : `Next: ${skill.descriptions[rank]}`}</span></button>`;
      }
      html += `</div><div class="row">`;
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

// Tap a monster to learn its defenses. Use a snapshot so this panel needs no per-frame DOM updates.
export function openEnemyInfo(enemy) {
  closeMenu();
  state.inspectedEnemy = { x: enemy.x, y: enemy.y, def: enemy.def };
  const def = enemy.def, armorClass = ARMOR_CLASSES[def.armorClass] || ARMOR_CLASSES.light;
  const name = enemy.type[0].toUpperCase() + enemy.type.slice(1);
  const menu = $("menu");
  menu.innerHTML = `<div class="head"><span class="title">${name}</span><span class="lv">${armorClass.name} · ${def.flying ? "Air" : "Ground"}</span></div>
    <div class="stats"><span class="stat"><small>Base HP</small><b>${def.hp}</b></span><span class="stat"><small>Armor amount</small><b>${Math.round(def.armor * 100)}%</b></span><span class="stat"><small>Speed</small><b>${def.speed}</b></span></div>
    <div class="hint">${armorClass.desc}</div>`;
  menu.style.display = "block";
  placeMenu();
}
// The menu floats over the page in screen pixels (so it never scales with the board), next to its spot
export function placeMenu() {
  const menu = $("menu");
  const s = state.inspectedEnemy || map.spots[state.selected];
  if (!s || menu.style.display === "none") return;
  const r = $("c").getBoundingClientRect(), origin = document.body.getBoundingClientRect(), k = r.width / W;
  const vw = pageW(), vh = pageH();
  const topGutter = Math.max(6, Math.ceil($("hud").querySelector(".hud-left").getBoundingClientRect().bottom - origin.top) + 6);
  const bottomGutter = Math.max(6, Math.ceil(vh - ($("hud").querySelector(".hud-right").getBoundingClientRect().top - origin.top)) + 6);
  menu.style.maxHeight = `${Math.max(72, vh - topGutter - bottomGutter)}px`;
  const sx = r.left - origin.left + s.x * k, sy = r.top - origin.top + s.y * k, mw = menu.offsetWidth, mh = menu.offsetHeight;
  // Prefer below the spot; flip above if that runs off the screen; always stay on screen
  let top = sy + 30 * k;
  if (top + mh > vh - 6) top = sy - mh - 34 * k;
  menu.style.left = `${clamp(sx - mw / 2, 6, vw - mw - 6)}px`;
  menu.style.top = `${clamp(top, topGutter, Math.max(topGutter, vh - mh - bottomGutter))}px`;
}

export function closeMenu() {
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
  } else if (action === "upgrade" && tower && canUpgrade(tower)) {
    const c = upgradeCost(tower);
    if (state.gold >= c) { state.gold -= c; tower.spent += c; tower.level++; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "specialize" && tower && canSpecialise(tower)) {
    const key = btn.dataset.specialization, spec = SPECIALIZATIONS[tower.type]?.[key];
    if (spec && state.gold >= spec.cost && specialize(tower, key)) { state.gold -= spec.cost; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "skill" && tower) {
    const cost = skillCost(tower, btn.dataset.skill);
    if (cost !== null && state.gold >= cost && trainSkill(tower, btn.dataset.skill)) { state.gold -= cost; sfx("upgrade"); }
    openMenu(spot);
  } else if (action === "ability" && tower && canSpecialise(tower) && ABILITIES[tower.type]?.[btn.dataset.ability]) {
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
function applyView() {
  const width = pageW(), height = pageH() - hudH();
  const maxX = Math.max(0, (W * view.k - width) / 2), maxY = Math.max(0, (H * view.k - height) / 2);   // never pan past the board's edge
  view.panX = clamp(view.panX, -maxX, maxX); view.panY = clamp(view.panY, -maxY, maxY);
  viewport.left = W / 2 - (width / 2 + view.panX) / view.k;
  viewport.top = H / 2 - (height / 2 + view.panY) / view.k;
  viewport.right = viewport.left + width / view.k;
  viewport.bottom = viewport.top + height / view.k;
  $("wrap").style.transform = `translate(calc(-50% + ${view.panX}px), calc(-50% + ${view.panY}px)) scale(${view.k})`;
  placeMenu();                                                  // the open menu follows its spot as the view moves
}

// A fresh level in the same page (no reload, so full screen survives): clear the end screen, reset the HUD
export function resetUiForLevel() {
  clearTimeout(endTimer);
  waveBtnKey = "";
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
  $("menu").addEventListener("mouseleave", () => { if (!view.mobile) state.preview = null; state.previewUpgrade = false; });
  // Hovering Upgrade (or a level-4 ability) shows the range the tower would have afterwards
  $("menu").addEventListener("mouseover", (ev) => { state.previewUpgrade = !!ev.target.closest("[data-action=upgrade], .tile[data-action=ability]"); });
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

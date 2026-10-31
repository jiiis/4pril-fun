# Yun Guard 🐉

A Kingdom Rush style tower defense game in plain HTML, CSS and JavaScript. No game framework; Vite handles development and production builds.

See [BALANCE.md](BALANCE.md) for current stats, armor matchups, upgrade rules, balance changes, and the proposed specialization roadmap. Update it whenever gameplay balance changes.

## How to run

From the repository root:

```bash
npm ci
npm run dev
```

Then open http://127.0.0.1:5173/yun-guard/ (or `/` for the same game). See the [site README](../README.md) for production builds, preview, deployment, and changing ports. JavaScript modules need HTTP serving; opening the HTML directly is unsupported.

## Languages

Use **EN / 中** on the home page to switch between English (US) and Simplified Chinese. The choice is saved on this device; switching does not reload the page or regenerate the map. Without a saved choice, Chinese browser languages default to Simplified Chinese and other browser languages default to English.

Player-facing text lives in the shared translation catalog at `js/locales/zh-CN.js`: keys are the English (US) text and values are Simplified Chinese. Add both languages for every new label, description, tooltip, accessibility label and combat message. See `AGENTS.md` and `js/i18n.js` for interpolation and rendering conventions. Gameplay identifiers and stats do not depend on language.

## How to play

- The map fits the window's height within the zoom limits: drag with the mouse or a finger to look around. The HUD stays put. Pinch zoom-out stops at the fitted view; zooming in and panning still work.
- Keyboard badges and shortcut hints hide on touch-capable devices, independently of screen size. Keyboard shortcuts still work with an attached keyboard.
- The UI has a minimum layout width of 360px. Narrower windows scroll horizontally instead of squeezing the controls and legend cards; swipe sideways or use the mouse wheel/trackpad. Rotate a phone for more room. The legend picker can still scroll vertically when needed.
- The top-right corner shows the language switch on the home page and the map hash during gameplay. Below 420px, the top stats become compact. The game-view logo hides below 440px; the full home-page logo remains visible.
- Every game starts on a brand new random map. Roads can enter and leave from any edge of the map, not just left to right. Most maps have two routes: a side road that forks off and rejoins, a second entrance that merges in, a fork that leads to its own exit, or a completely separate road with its own entrance and exit. Monsters pick a route when they appear, so cover both. When the routes leave by different exits, each exit has its own castle to defend (a grey stone keep and a sandstone palace). The map number is shown in the top bar; add `?seed=NUMBER` to the URL (for example `http://localhost:8123/?seed=234833`) to play that same map again.
- Click a stone build spot to place a tower. Click a tower to upgrade or sell it. Towers go up to level 3 normally, then choose a **level 4 ability**. Archer and Barracks instead each have three specializations with independently upgradeable skills (see the tables).
- Selecting a foundation, tower or monster opens an inspector: a side panel on desktop/landscape and a bottom sheet on portrait phones. **Overview** shows stats and an expandable primary-attack matchup guide; **Upgrades** shows specialization choices and skill ranks. Barracks units show numeric armor; monsters show armor class and armor amount. Rally/sell actions stay at the bottom, and the battlefield keeps running. Close with ×, Esc, or empty ground. Building keeps the new tower's inspector open.
- Open **Settings** beside the home-page language switch to choose between **Inspector** (docked panel/bottom sheet), **Floating** (beside the selection), and **Radial** (charms around a foundation or tower). Radial offers direct building, upgrading, rally and selling. Purple silk charms choose towers; green charms provide tower actions, showing icons and prices with names available on hover or to screen readers. **Paths** and **Skills** open nested rings; selecting a branch shows a nearby preview with its effects, ranks and purchase button. A **Back** charm returns to tower actions. The **Details** charm toggles tower information beside it; narrow screens stack the preview. The ring stays centered on the selected tower during panning, even off-screen. Development actions stay left or upper-left, Details sits to their right, and Sell stays below or lower-right. Radial has no close button; select empty ground or press Esc to dismiss it. Monster information always uses a detailed panel. All styles share the same costs and mechanics. The choice is saved on this device when browser storage is available.
- Each round starts by choosing one of six heroes (or add `?hero=april`, `?hero=avril`, `?hero=ember`, `?hero=willow`, `?hero=meilin` or `?hero=adrien` to the URL). Press `1` (or click the hero) to select them, then click anywhere to send them there. They are deselected after the order; clicking again or pressing `Esc` also deselects. Click the legend badge beside the bottom-right controls to select your hero; double-click or double-tap it to move the camera toward them (or their respawn point while defeated), centering where possible without panning beyond the map edges.
  - **April** is a knight: sword and shield, tough, and her dog Max follows her and bites anything that gets close.
  - **Avril** is an archer: she shoots frost arrows that slow monsters from a distance, fights only weakly up close, and slowly heals friends standing near her. Her eagle Sky circles above her and dives on nearby monsters, including flying ones.
  - **Candice** is a young fire mage: fragile, but her fireballs splash and set everything they catch ablaze. Her baby dragon Cinder hovers above her and spits little fireballs of his own.
  - **Willow** is a forest druid: every few seconds her vines burst from the ground and root every monster near her. Her bear Bramble is big and tough and holds monsters in place.
  - **寒 Hán** is a cool, elegant warrior in frost-white hanfu: every sword strike also cleaves into the monsters beside her target. Her loong Yun 云, a serpentine Chinese dragon, coils in the sky and every few seconds sweeps down the road, striking everything in its path.
  - **Adrien** is a paladin who charges through enemies with his lance. His lion Leon fights beside him.
  - Kills earn a hero experience: each level makes her stronger and tougher (and Avril's frost colder). Click an animal while a hero is selected and she will hunt it down for a couple of gold: April runs it down with her sword, Avril picks it off with her bow.
- Click a Barracks and choose **Move rally point**, then click the map to choose where its soldiers stand (within the barracks' range).
- Monsters walk the road from the signpost to the castle. Each one that gets through costs lives.
- Killing monsters earns gold. The next wave counts down as soon as the current one has finished appearing, and calling it early earns bonus gold.
- Tap/click a monster to inspect its armor class and counters. Light favors piercing attacks; Plated is weak to Arcane; Fortified is weak to Siege; Warded resists Arcane but is weak to physical attacks. Armor amount and class are separate. Hero movement and rally orders take precedence over inspection.
- Survive all 15 waves to win.

| Tower | Good for |
|---|---|
| Archer | Fast piercing arrows; strong against Light and Warded enemies, weak against plating. |
| Mage | Arcane bolts counter Plated enemies; Warded and Fortified enemies resist. |
| Cannon | Siege blasts counter Fortified groups; cannot hit flyers. |
| Barracks | Soldiers stand on the road and hold monsters in place. |
| Lightning Spire | Arcane lightning chains through nearby enemies and reaches flyers; Warded and Fortified enemies resist. |
| Ballista | Heavy piercing bolts hit a line and ignore half of armor amount; slow and dependent on alignment. Reaches flyers. |

| Tower | Level 4 ability A | Level 4 ability B |
|---|---|---|
| Mage | **Arcane Storm**: bolts burst and hit the whole crowd. | **Curse**: cursed monsters take 40% more damage from everything. |
| Cannon | **Cluster Bombs**: three bomblets scatter from every shell. | **Napalm**: shells leave burning ground. |
| Lightning Spire | **Overcharge**: three more hops, longer leaps. | **Static Field**: everything in range is slowed and zapped. |
| Ballista | **Executioner**: double damage below 25% target health. | **Harpoons**: pierced enemies are slowed, with a stronger pin on the first. |

Archer and Barracks instead choose one of three specializations at level 3. Each has **2–3 independent skills with three purchasable ranks**; prices differ, and skills are not included in the specialization price. Sell returns 70% of all gold invested, including skills.

| Archer specialization | Role | Skills |
|---|---|---|
| **Falcon Roost** | Returning falcons hunt ground and air targets. Travel costs damage uptime; poor against swarms. | **Quarry:** prioritize and punish healers/necromancers. **Talon Rend:** temporarily weaken armor amount for allied physical attacks. **Hunting Pair:** add and improve a second falcon. |
| **Thornweavers** | Persistent brambles pulse at ground enemies and briefly root them. No anti-air; fixed coverage and plating are weaknesses. | **Deep Roots:** longer roots, with a shared cooldown and heavy-enemy resistance. **Barbed Growth:** extra damage only against moving enemies. **Seed Drift:** a second patch and wider coverage. |
| **Moonbow** | Silver arrows ricochet among the tower's own marked enemies, at least 24 and at most 110 apart. Weak against isolated/tightly packed enemies and armor. | **Lunar Marks:** more marked targets. **Silver Thread:** retain more damage per ricochet. |

Archer specializations replace the original fire-arrow attack. All three deal Piercing damage; Talon Rend reduces armor amount, not class resistance. Summons, patches, control and projectile counts have explicit limits. Exact costs and limits are in [BALANCE.md](BALANCE.md).

| Barracks specialization | Role | Skills |
|---|---|---|
| **Cloud Monastery** | Two fragile spear spirits intercept ground and air, then retreat to recover. Never blocks; Piercing attacks struggle with plating. | **Cloudstep:** faster interception and recovery. **Sky Spears:** extra damage to flyers. |
| **Brood Nursery** | Two armored beetles block ground enemies and hatch temporary helpers, with a strict population cap. Cannot hit flyers. | **Chitin:** adult durability. **Hatchery:** faster hatching and a larger cap. **Last Brood:** hatchlings released when adults fall. |
| **Jade Colossus** | One slow guardian crushes groups with Siege damage, countering Fortified enemies. Cannot cover scattered runners or flyers. | **Stoneheart:** health, rest healing and respawn. **Earthbreaker:** wider, harder, slower crushing attacks. |

Barracks specializations replace the original squad; rally orders still work. Skills can be purchased in any order. Exact costs, ranks and initial balance values are in [BALANCE.md](BALANCE.md).

| Monster | What makes it different |
|---|---|
| Goblin | Weak and plentiful. |
| Wolf | Very fast. |
| Bat | Light flyer; passes over ground blockers. Archers, mages, spires, ballistas, Cloud Monastery spirits and aerial companions can hit it. |
| Orc | Armoured: arrows and cannonballs do less. |
| Skeleton | Heavily armoured but crumbles to magic. Can't be chilled. |
| Shaman | Warded healer; physical attacks counter it. |
| Golem | Slow, Fortified, immune to frost. Siege works best; Arcane is resisted. |
| Troll | The boss: huge health, crushing attacks. |
| Slime | Bursts into two bouncy slimelings when killed. |
| Thief | Very fast. Costs no lives, but runs off with 25 gold if it reaches the castle. Drops good loot when caught. |
| Necromancer | Warded; raises a skeleton from a nearby fallen monster every few seconds. Physical attacks counter it. |
| Wyvern | A big Plated flying dragon; ranged towers, Cloud Monastery spirits and aerial companions can hit it. Arcane counters its plating; Cloud spears remain resisted. |

## Project layout

```
index.html            page skeleton
css/style.css         HUD, menu and overlay styling
js/config.js          ALL the game settings: towers, monsters, waves, grid size
js/map.js             random map generator: roads, rivers, ponds, build spots, scenery, animal homes
js/state.js           everything that changes while playing
js/update.js          one step of the game (spawning, walking, shooting)
js/waves.js           wave building and spawning
js/soldiers.js        barracks soldiers: moving, blocking, fighting
js/combat.js          damage, gold, little effects
js/damage.js          armor class, armor amount, and attack penetration rules
js/towers.js          tower stats and creation
js/ui.js              HUD, build menu, game over screen, window scaling
js/util.js            maths helpers
js/render/            all the drawing: background, towers, creatures, soldiers
js/main.js            wires it together and runs the loop
```

## Ideas to try next

- Change numbers in `js/config.js`: tower costs, monster speed, how many waves.
- Change how maps are generated in `js/map.js`: longer roads, more build spots, more trees.
- Add a new monster: stats in `config.js`, a drawing in `js/render/creatures.js`, and add it to `makeWave`.
- Add a hero unit, boss waves, sound effects, or a high score saved in localStorage.

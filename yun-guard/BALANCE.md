# Yun Guard balance and design

## Goal and maintenance

Professional, balanced, and fun for hours. Preserve clear feedback, gradual difficulty, fair random maps, meaningful spending decisions throughout a level, and multiple viable strategies. Every tower and monster should have recognizable strengths, weaknesses, and counters.

Update this file whenever balance changes. Record the actual values and rationale in the same change as the code. Separate implemented mechanics from proposals; design approval does not mean a mechanic is playable. Configuration is in `js/config.js`, upgrade formulas in `js/towers.js`, level progression in `js/levels.js`, and enemy damage resolution in `js/damage.js` and `js/combat.js`.

## Implemented: armor framework

Initial values for iteration, not a claim that the game is fully balanced. All current enemies have one of four armor classes. Armor class and armor amount are separate. Flying, frost immunity, blocking, healing, and other traits remain separate from armor.

| Armor class | Strong counters | Resists |
|---|---|---|
| Light | Piercing attacks | No class resistance |
| Plated | Arcane attacks | Arrows and blades |
| Fortified | Siege attacks | Projectiles, blades, and arcane attacks |
| Warded | Steel and piercing attacks | Arcane attacks |

### Class multipliers

These percentages apply before armor amount and Curse. Heavy piercing shares the piercing class matchup, but penetrates more armor amount.

| Armor class | Steel | Piercing | Heavy piercing | Siege | Arcane |
|---|---:|---:|---:|---:|---:|
| Light | 100% | 120% | 120% | 100% | 100% |
| Plated | 85% | 80% | 80% | 100% | 140% |
| Fortified | 80% | 65% | 65% | 150% | 65% |
| Warded | 120% | 120% | 120% | 110% | 60% |

### Armor amount and attack penetration

`final damage = raw damage × class multiplier × (1 − armor amount × armor factor) × active Curse multiplier`

Armor amount is clamped to 0–100%. Penetration does not remove class resistance. Arcane bypasses armor amount but is still resisted by Warded and Fortified classes. Curse multiplies the resulting damage by 1.4 while active. There are no new damage immunities.

| Attack profile | Internal type | Armor factor | Current sources |
|---|---|---:|---|
| Steel | `physical` | 1 | Barracks, hero melee/cleaves/charges, companions' physical attacks |
| Piercing | `arrow` | 1 | Archer arrows, Avril's arrows |
| Heavy piercing | `pierce` | 0.5 | Ballista bolts, including Executioner and Harpoons |
| Siege | `siege` | 0.25 | Cannon shells and Cluster Bomb bomblets |
| Arcane | `magic` | 0 | Mage bolts, lightning, Static Field, hero fireballs, fire/burn, poison, Napalm |

Poison and burning retain their existing Arcane damage profile in this first implementation; neither bypasses class resistance. Changing that is a separate design decision. Soldier and hero defenses still use their existing numeric armor; armor-class matchups currently resolve attacks against monsters.

Examples per 100 raw damage: arrows deal 48 to an Orc (80% class × 60% after armor); Arcane deals 140. Siege deals 123.75 to a Golem (150% × 82.5%); Arcane deals 65. Against a Shaman, Steel deals 108 (120% × 90%) and Arcane deals 60.

### Current monster properties

Stats are constant across levels. Waves change counts and composition; gold rewards scale with level. Amount is not a universal damage-reduction percentage: apply the attack factor above.

| Monster | Armor class | Armor amount | HP | Speed | Base kill gold | Defining trait / counterplay |
|---|---|---:|---:|---:|---:|---|
| Goblin | Light | 0% | 362 | 30 | 10 | Basic ground enemy; piercing and group damage |
| Wolf | Light | 0% | 273 | 52 | 13 | Fast; interception, rapid fire, and control |
| Bat | Light | 0% | 254 | 42 | 13 | Flying; anti-air required, cannot be blocked |
| Orc | Plated | 40% | 1269 | 20 | 26 | Armor; Arcane counter |
| Skeleton | Plated | 60% | 815 | 24 | 23 | Heavy armor and frost immunity; Arcane counter |
| Shaman | Warded | 10% | 998 | 22 | 36 | Heals other monsters for 6 HP/s within 70; physical focus |
| Golem | Fortified | 70% | 4712 | 12 | 90 | Frost immune; Siege counter, high melee threat |
| Troll | Light | 30% | 8156 | 16 | 153 | Boss health and melee damage; sustained damage and support |
| Slime | Light | 0% | 635 | 25 | 13 | Splits into two Slimelings; keep crowd damage available |
| Slimeling | Light | 0% | 200 | 38 | 5 | Fast offspring; no corpse |
| Thief | Light | 0% | 500 | 48 | 36 | Steals 25 gold on escape instead of lives |
| Necromancer | Warded | 10% | 1450 | 18 | 62 | Raises a 70%-HP Skeleton from a nearby corpse every 5s when available; physical focus |
| Wyvern | Plated | 20% | 2538 | 27 | 82 | Armored flyer; anti-air Arcane damage |

Tap/click a monster to inspect its armor class, amount, base health, speed, and class counterplay. The information panel is a snapshot, without continuous DOM updates. Hero movement and rally orders take precedence over inspection.

## Implemented: current tower progression

The 16 specializations below are **not implemented yet**. The playable game still has the original two level-four abilities per tower and no separately ranked skill purchases.

| Tower | Attack profile / pattern | Build cost | Total cost at level 4 | Current level-4 choices | Weakness |
|---|---|---:|---:|---|---|
| Archer | Piercing, rapid single-target | 70 | 280 | Rapid Volley / Venom Arrows | Plated and Fortified enemies |
| Mage | Arcane, single-target | 100 | 400 | Arcane Storm / Curse | Warded and Fortified enemies |
| Cannon | Siege, ground-area blast | 125 | 500 | Cluster Bombs / Napalm | Cannot hit flyers; slow against dispersed enemies |
| Spire | Arcane, diminishing chain | 140 | 560 | Overcharge / Static Field | Isolated targets; Warded and Fortified enemies |
| Ballista | Heavy piercing, line | 170 | 680 | Executioner / Harpoons | Slow; needs alignment; Fortified class resistance remains |
| Barracks | Steel, blocking ground units | 90 | 360 | Paladins / Berserkers | Cannot reach flyers; vulnerable to strong melee attacks |

Upgrade prices: level 1→2 = 0.6× build cost; 2→3 = 1.2×; specialization = 1.2×. Total fully developed cost = 4× build cost. Selling returns 70% of spent gold, rounded. All prices are rounded to integer gold.

| Tower | Base damage per hit | Base attacks/s | Base range | Extra pattern values |
|---|---:|---:|---:|---|
| Archer | 10 | 1.7 | 150 | Single target |
| Mage | 26 | 0.85 | 136 | Single target |
| Cannon | 36 | 0.5 | 162 | Blast radius 48 |
| Spire | 24 | 0.6 | 143 | Up to 3 targets, jump range 70, 75% damage retained per jump |
| Ballista | 62 | 0.25 | 192 | Line half-width 9 plus target-size allowance; bolt reach adds 50 |
| Barracks | 6 per soldier | 1 per soldier | 117 rally range | 2 soldiers, 80 HP each, 8s respawn; engagement range 50 |

Per level: range adds 18; damage grows by 60% of base; attack rate grows by 8% of base. Level 4 additionally adds 20 range, multiplies damage by 1.2 and attack rate by 1.15. Damage is rounded. Barracks gain a third soldier at level 3; their range is rally range, not attack reach.

| Tower | Current skills and numbers |
|---|---|
| Archer | Level 3: burn 7 Arcane DPS for 3s. Volley: two arrows per shot, retains burn. Venom: replaces burn with 7 Arcane DPS for 4s and 15% slow; refreshes rather than stacking per arrow. |
| Mage | Storm: radius 36, secondary targets take 60% bolt damage. Curse: target takes 40% more damage for 4s. |
| Cannon | Cluster: 3 bomblets, each 45% shell damage, radius 30. Napalm: radius 40, 10 Arcane DPS for 4s. |
| Spire | Base chain hits up to 3 targets, +1 per level; range 70 between targets; each jump retains 75% damage. Overcharge: +3 targets and 40% jump range. Field: 25% slow and 4 Arcane DPS to enemies in tower range. |
| Ballista | Executioner: double damage below 25% target HP. Harpoons: 50% slow for 3s; first enemy along the bolt instead gets 85% slow for 1.6s. |
| Barracks | Paladins: +50% HP, 30% armor, 5 HP/s combat healing. Berserkers: +60% damage, +30% rate, cleave radius 26 at 60% damage. |

## Audit: progression and economy concerns

Starting gold = 360 + 7× level. Kill reward multiplier = 1 + 0.012× (level − 1), with individual rewards rounded. Winning carries 75% of remaining gold plus 10 per remaining life to the next level, capped at 600. Early wave calls also award gold. Waves rise from 9 to 15; enemy stats do not scale.

Potential starting gold plus all scheduled kill rewards, including Slimelings but excluding carryover, early calls, hunting, and resurrected monsters: level 1 ≈2,375; level 30 ≈12,485; level 100 ≈49,526. Actual earned gold depends on kills and escapes. Twenty fully upgraded towers cost 5,600–13,600. This mismatch is a major candidate explanation for reaching full development long before a level ends.

Other concerns: specialization power spikes; insufficiently distinct roles; map routes with very different lengths/exposure; concentration at shared entrances; opening overload; and long late-wave cleanup. Browser observations are a small sample, not proof of global tower or hero rankings. Economy, waves, enemy HP, costs, and skills have not been retuned in this armor pass.

## Proposed: specialization roadmap

Design direction only. Costs, ranks, durations, caps, targeting rules, attack profiles, visuals, and exact counter interactions still need definition and review before implementation. Each specialization has 2–3 independently upgradeable skills. Prices and rank counts may differ. Buying, specializing, adding a skill, and ranking up an existing skill must compete for gold throughout a level.

| Specialization | Fighting identity | Upgradeable skills | Deliberate weakness |
|---|---|---|---|
| **Falcon Roost** · Archer | Falcons pursue a marked enemy beyond normal tower range | **Quarry:** prioritize dangerous support enemies. **Talon Rend:** weaken plating. **Hunting Pair:** add a second falcon. | Travel and return time; poor against swarms |
| **Thornweavers** · Archer | Grow bramble patches along nearby roads | **Deep Roots:** longer ground restraint. **Barbed Growth:** damage moving enemies. **Seed Drift:** establish a second patch. | Cannot hit flyers; limited patch coverage |
| **Moonbow** · Archer | Deliberate arrows ricochet between moon-marked enemies | **Lunar Marks:** mark additional targets. **Silver Thread:** stronger ricochets. | Needs several separated targets; weak against plating |
| **Rift Observatory** · Mage | Periodically folds a short section of road, delaying and bunching enemies | **Foldspace:** improve displacement. **Convergence:** briefly compress a group. | Modest damage; strong enemies resist displacement |
| **Hex Atelier** · Mage | Links enemies so attacking one helps damage the others | **Soul Stitch:** add links. **Frailty:** expose linked enemies. **Unravel:** suppress healing temporarily. | Needs supporting damage; links break with distance |
| **Prism Sanctum** · Mage | A continuous beam grows stronger against one target | **Focus:** faster buildup. **Refraction:** secondary beam at reduced power. | Switching targets resets buildup; warded enemies |
| **Faultline Foundry** · Cannon | Sends directional ground fractures through fortified enemies | **Deep Fracture:** stronger siege penetration. **Aftershock:** delayed secondary impact. | Ground only; slow against scattered runners |
| **Ember Orchard** · Cannon | Plants visible explosive pods that mature before detonating | **Quickening:** shorter maturation. **Cinder Beds:** lingering fire. **Sporeburst:** scatter weaker secondary pods. | Enemies can leave before pods mature; ground only |
| **Storm Loom** · Spire | Weaves lightning between nearby ground and flying enemies | **Long Thread:** longer jumps. **Return Stroke:** revisit surviving targets at reduced damage. | Isolated targets; warded enemies |
| **Magnetar** · Spire | Places two pylons forming a damaging corridor across a road | **Wide Circuit:** longer corridor. **Induction:** repeated crossings increase damage. **Drag Field:** brief slowing inside it. | Requires good placement; no permanent trapping |
| **Thunderheart** · Spire | Stores energy between powerful radial pulses | **Capacitor:** stronger pulses. **Storm Warning:** a weaker preliminary pulse slows enemies. | Long gaps between attacks; fast enemies may escape |
| **Dragonbone Rail** · Ballista | Fires heavy bolts through enemies aligned along a corridor | **Borehead:** penetrate fortified defenses. **Follow-through:** preserve damage through additional targets. | Alignment-dependent; slow firing and overkill |
| **Skyhook** · Ballista | Anchors a priority enemy to a temporary tether point | **Barbed Anchor:** stronger restraint. **Grounding Chain:** temporarily ground eligible flyers. **Winch:** briefly pull eligible targets backward. | Limited simultaneous tethers; bosses resist displacement |
| **Cloud Monastery** · Barracks | Summons fragile spear spirits that leap between ground and aerial targets | **Cloudstep:** faster interception. **Sky Spears:** stronger anti-air attacks. | Poor blocking; vulnerable during recovery |
| **Brood Nursery** · Barracks | Armored beetles hold enemies while producing temporary hatchlings | **Chitin:** tougher adults. **Hatchery:** more hatchlings. **Last Brood:** release hatchlings when adults die. | Area attacks destroy the brood; strict population cap |
| **Jade Colossus** · Barracks | One massive guardian holds a chokepoint and crushes groups | **Stoneheart:** durability and recovery. **Earthbreaker:** wider, slower crushing attacks. | Cannot cover scattered enemies or attack flyers |

Future control mechanics require resistance, cooldowns, and stacking limits; summons require population caps. Skills must reinforce identities without removing every weakness. Candidate combinations: Colossus + Faultline; Rift + Ember Orchard; Skyhook + Prism. Eight new monster designs are a later workstream; none are added by this pass.

## Change record

### 2026-10-27 — Armor foundation

- Added Light, Plated, Fortified, and Warded classes with explicit matchups and attack penetration profiles.
- Split arrows from Steel and Cannon from ordinary physical damage. Routed hero arrows through the same rules; existing damage sources, including status damage, use shared resolution.
- Assigned current enemies to classes. Replaced Skeleton/Golem's isolated `magicWeak` multipliers with class rules; Golem now has a Siege counter, while Shaman/Necromancer resist Arcane.
- Added monster inspection and updated tower descriptions so the new counters are discoverable.
- Preserved existing HP, speed, economy, upgrade costs, waves, and playable ability system to isolate this iteration. Complete-game difficulty still needs playtesting after the armor changes.
- Recorded the agreed specialization roadmap separately from implemented behavior.

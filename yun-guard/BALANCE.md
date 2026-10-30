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

`final damage = raw damage × class multiplier × (1 − effective armor amount × armor factor) × active Curse multiplier`

Effective armor amount is the base amount minus an active Talon Rend reduction, clamped to 0–100%. Rend does not change armor class.

Armor amount is clamped to 0–100%. Penetration does not remove class resistance. Arcane bypasses armor amount but is still resisted by Warded and Fortified classes. Curse multiplies the resulting damage by 1.4 while active. There are no new damage immunities.

| Attack profile | Internal type | Armor factor | Current sources |
|---|---|---:|---|
| Steel | `physical` | 1 | Barracks, hero melee/cleaves/charges, companions' physical attacks |
| Piercing | `arrow` | 1 | Archer arrows, falcons, bramble pulses, Moonbow arrows, Avril's arrows |
| Heavy piercing | `pierce` | 0.5 | Ballista bolts, including Executioner and Harpoons |
| Siege | `siege` | 0.25 | Cannon shells and Cluster Bomb bomblets |
| Arcane | `magic` | 0 | Mage bolts, lightning, Static Field, hero fireballs, fire/burn, poison, Napalm |

Burning and the shared poison status retain their Arcane damage profile; neither bypasses class resistance. Archer no longer offers the old Venom Arrows path. Changing that is a separate design decision. Soldier and hero defenses still use their existing numeric armor; armor-class matchups currently resolve attacks against monsters.

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

Archer and Barracks each have three playable specializations with separately ranked skills. The other four tower families still use their original two level-four abilities; their 10 proposed replacements are not implemented.

| Tower | Attack profile / pattern | Build cost | Total cost at level 4 | Current level-4 choices | Weakness |
|---|---|---:|---:|---|---|
| Archer | Piercing; each specialization changes the attack loop | 70 | 376–416 before skills | Falcon Roost / Thornweavers / Moonbow | Specialization determines targeting, coverage and control; Plated/Fortified resistance remains |
| Mage | Arcane, single-target | 100 | 400 | Arcane Storm / Curse | Warded and Fortified enemies |
| Cannon | Siege, ground-area blast | 125 | 500 | Cluster Bombs / Napalm | Cannot hit flyers; slow against dispersed enemies |
| Spire | Arcane, diminishing chain | 140 | 560 | Overcharge / Static Field | Isolated targets; Warded and Fortified enemies |
| Ballista | Heavy piercing, line | 170 | 680 | Executioner / Harpoons | Slow; needs alignment; Fortified class resistance remains |
| Barracks | Steel, blocking ground units before specialization | 90 | 462–552 before skills | Cloud Monastery / Brood Nursery / Jade Colossus | Specialization determines targeting, damage profile and coverage |

Upgrade prices: level 1→2 = 0.6× build cost; 2→3 = 1.2×. Archer costs 196 and Barracks 252 total at level 3, then pays the chosen specialization's price below. The other four towers' level-four ability costs 1.2× build cost, for a fully developed total of 4× build cost. Selling returns 70% of all spent gold, including specialization and skill purchases, rounded. All prices are integer gold.

| Tower | Base damage per hit | Base attacks/s | Base range | Extra pattern values |
|---|---:|---:|---:|---|
| Archer | 10 | 1.7 | 150 | Single target |
| Mage | 26 | 0.85 | 136 | Single target |
| Cannon | 36 | 0.5 | 162 | Blast radius 48 |
| Spire | 24 | 0.6 | 143 | Up to 3 targets, jump range 70, 75% damage retained per jump |
| Ballista | 62 | 0.25 | 192 | Line half-width 9 plus target-size allowance; bolt reach adds 50 |
| Barracks | 6 per soldier | 1 per soldier | 117 rally range | 2 soldiers, 80 HP each, 8s respawn; engagement range 50 |

Per level: range adds 18; damage grows by 60% of base; attack rate grows by 8% of base. Level 4 additionally adds 20 range, multiplies damage by 1.2 and attack rate by 1.15 for the original abilities. Damage is rounded. Barracks gain a third soldier at level 3; their range is rally range, not attack reach. Specialized Archers and Barracks units instead use the explicit stats below; the ordinary level-four damage multipliers do not apply to them. All three Barracks specializations retain the level-four rally radius of 191.

| Tower | Current skills and numbers |
|---|---|
| Archer | Ordinary level 3: burn 7 Arcane DPS for 3s. Specializing replaces this attack with the Falcon, Thorn or Moon pattern documented below; no retained fire-arrow attack. |
| Mage | Storm: radius 36, secondary targets take 60% bolt damage. Curse: target takes 40% more damage for 4s. |
| Cannon | Cluster: 3 bomblets, each 45% shell damage, radius 30. Napalm: radius 40, 10 Arcane DPS for 4s. |
| Spire | Base chain hits up to 3 targets, +1 per level; range 70 between targets; each jump retains 75% damage. Overcharge: +3 targets and 40% jump range. Field: 25% slow and 4 Arcane DPS to enemies in tower range. |
| Ballista | Executioner: double damage below 25% target HP. Harpoons: 50% slow for 3s; first enemy along the bolt instead gets 85% slow for 1.6s. |
| Barracks | Replaced Paladins/Berserkers with the three specializations documented below. |

## Implemented: Barracks specializations — first playable iteration

Initial numbers for playtesting, not final balance. Level 3 offers one permanent specialization; purchasing it replaces the existing squad with the new units at the building. No mid-level respec; selling and rebuilding is available at the normal 70% refund. Each skill starts at rank zero and has three independent purchases. Buying a specialization does not include trained skills. Skill upgrades preserve wounds and do not revive fallen units. Timers and unit actions stop while gameplay is paused.

| Specialization | Purchase / total before skills | Base units and attack | Strength | Deliberate weakness |
|---|---:|---|---|---|
| Cloud Monastery | 210 / 462 | 2 spirits; 110 HP each; 34 Piercing damage; 0.9 attacks/s; speed 180; interception radius 90 around each formation position; 10s respawn | Intercepts ground and air, prefers flyers when acquiring a new target; Light and Warded counters | Never blocks; fragile; retreats toward rally for 0.9s after striking; travel costs damage uptime; Plated/Fortified resistance |
| Brood Nursery | 260 / 512 | 2 adults; 250 HP each; 25% armor; 16 Steel damage; 0.85 attacks/s; speed 75; interception radius 50; 10s respawn | Several ground blockers; physical counter to Warded support enemies | No air attacks; plating resists bites; weak individual hatchlings and a strict population cap |
| Jade Colossus | 300 / 552 | 1 guardian; 900 HP; 15% armor; 70 Siege damage; 0.45 attacks/s; speed 60; interception radius 50; 12s respawn | Counters Fortified ground groups; each strike hits its primary and up to 2 additional targets within 30 of it at full damage | Blocks only its current target; slow movement and attacks; flyers and dispersed runners pass it |

Attacks connect within 16 world units. Spirits can take retaliation while in contact, including from flyers, but never hold an enemy still. Their cooldown runs during travel/recovery; actual attack frequency cannot exceed the listed rate. Cloudstep reduces downtime, not the 0.9 attacks/s ceiling. Spear damage remains Piercing even against armored flyers; anti-air does not bypass armor.

Brood uses one shared hatch timer per tower: one hatchling every 8s while at least one adult lives, up to 2 living hatchlings initially. No adult means the timer waits. Hatchlings have 45 HP, no armor, 7 Steel damage, 1.2 attacks/s, speed 120, interception radius 50, and a 10s lifetime; they block ground targets, do not respawn, and count toward the same cap whether hatched normally or released on death. At maximum Hatchery, at most 2 adults plus 5 living hatchlings exist per tower. Expired/dead hatchlings are removed; selling removes the entire brood. Existing monsters have no area attacks against soldiers: area vulnerability remains a future monster-design consideration, not an implemented counter.

Idle healing: spirits/adults 6 HP/s; guardian 8 HP/s before Stoneheart. No innate combat healing. Existing allied healing can still help living summons. Dead adults/spirits/guardians respawn at their building after their timer; hatchlings expire permanently. Siege crushes hit only ground targets, with a hard target cap and no stun or displacement.

| Specialization / skill | Rank prices (1 / 2 / 3) | Rank 0 → 1 → 2 → 3 values |
|---|---|---|
| Cloud / Cloudstep | 120 / 180 / 240 | Speed 180 / 210 / 240 / 270; recovery 0.9 / 0.75 / 0.6 / 0.45s; interception radius 90 / 100 / 110 / 120 |
| Cloud / Sky Spears | 150 / 220 / 300 | Extra damage against flyers 0 / 12 / 26 / 42; total 34 / 46 / 60 / 76 before defenses |
| Brood / Chitin | 155 / 210 / 280 | Adult HP 250 / 320 / 400 / 490; armor 25 / 30 / 35 / 40%; hatchlings unaffected |
| Brood / Hatchery | 140 / 210 / 290 | Shared hatch interval 8 / 7 / 6 / 5s; living hatchling cap 2 / 3 / 4 / 5 |
| Brood / Last Brood | 120 / 180 / 250 | Hatchlings released per adult death 0 / 1 / 2 / 3, always within Hatchery's cap; expiry and hatchling deaths do not trigger this |
| Colossus / Stoneheart | 190 / 260 / 340 | HP 900 / 1100 / 1350 / 1650; respawn on subsequent deaths 12 / 11 / 10 / 9s; idle healing 8 / 12 / 16 / 20 HP/s |
| Colossus / Earthbreaker | 200 / 280 / 360 | Damage 70 / 90 / 115 / 145; radius 30 / 36 / 42 / 48; total targets 3 / 4 / 5 / 6; attacks/s 0.45 / 0.43 / 0.41 / 0.39 |

Total build + upgrades + specialization + all skills: Cloud **1,672**, Brood **2,347**, Colossus **2,182**. These create additional spending choices; they do not by themselves solve the high-level gold surplus. Last Brood competes with keeping adults alive, Sky Spears buys no extra ground damage, and Earthbreaker's wider/harder attacks become slower. Every skill is optional; no purchased branch grants missing anti-air to Brood/Colossus or blocking to Cloud.

## Implemented: Archer specializations — first playable iteration

Archer reaches tier 3 for **196 gold** (70 + 42 + 84), then buys one permanent path. Specializing replaces the ordinary fire-arrow attack, rather than adding another attack on top. Each skill starts untrained and has three independently purchased ranks. No respec; selling refunds 70% of the complete investment, including skills. These are initial playtest values, not final balance.

| Specialization | Purchase / total before skills | Fighting identity and base properties | Deliberate weakness |
|---|---:|---|---|
| **Falcon Roost** | 190 / 386 | One falcon; 140 Piercing damage per strike; acquisition radius 205; speed 240; returns to the roost and rests 1s after every hit. Attacks ground and air. | Travel and return time reduce actual attack rate; one target per sortie; swarms; Plated/Fortified class resistance. Quarry can distract falcons from escaping runners. |
| **Thornweavers** | 180 / 376 | One persistent radius-40 bramble patch; 16 Piercing damage every 0.5s to up to 5 ground targets total per tower; acquisition/planting radius 190; 1.5s maturation. Brief roots provide control. | Cannot hit flyers; fixed road coverage; armor resists every pulse. Barbed Growth loses its extra damage while enemies are blocked or rooted. |
| **Moonbow** | 220 / 416 | 62 Piercing damage on the first hit; at most 0.65 arrows/s; range 215; initially 2 marked targets; successive hits retain 55% damage. | Needs different targets 24–110 apart; isolated or tightly packed enemies prevent ricochets; plating resists; arrow travel can lower the attack rate. |

**Falcon targeting and limits.** Acquire the enemy furthest along the road within range. Trained Quarry prioritizes enemies with healing or resurrection abilities; a partner prefers a different enemy within the same priority. A falcon may follow its acquired target beyond attack range, but abandons the chase beyond radius 340 or after 3.5s outbound. Dead/escaped targets trigger a return, never a free hit. A failed sortie rests 0.3s after returning. Recovery runs only at the perch; the listed rate of 1/s is a per-bird ceiling, not sustained DPS. Hunting Pair is capped at two falcons, with separate travel/recovery states. Falcons carry the tower's attacks; they have no health and do not block enemies. Selling removes them.

Talon Rend applies **after** the strike, to that enemy instance only. It subtracts up to the trained number of percentage points from armor amount, clamped at zero; class multipliers remain unchanged. It benefits subsequent allied physical attacks, not Arcane damage (which already bypasses armor amount). The strongest effect wins: equal/stronger applications refresh to 4s; weaker applications cannot prolong a stronger effect. It does not stack across falcons or towers. Three gold slashes indicate the debuff; enemy inspection shows the reduced armor as a snapshot. Monster definitions are never mutated.

**Bramble placement and limits.** The first patch grows at the nearest road point in range. Seed Drift chooses a second reachable road section furthest from that first point, sampled every 24 world units and separated by more than 48. Locations remain fixed. The second patch also matures for 1.5s; buying further Seed Drift ranks enlarges it without restarting growth. A tower has at most two patches and one shared pulse timer. Both patches share the same **5-target total cap**, prioritize progress, and never double-hit one enemy in a pulse; Seed Drift buys coverage, not a higher damage ceiling. Selling removes the patches.

Untrained brambles root for 0.35s. Root procs share one **3s cooldown per enemy across all Thornweavers**, and do not stack durations. Golems and Trolls have `brambleResistance: 0.5`, halving only these bramble roots; their other properties and existing hero control remain unchanged. The inspector exposes this resistance. Even at maximum Deep Roots, brambles cannot continuously immobilize an enemy (0.8s maximum, or 0.4s for those heavy enemies). Barbed Growth's bonus applies only while the target is moving, not while blocked/rooted; it remains Piercing damage.

**Moon marks and limits.** At each launch, select the most advanced enemy in range, then mark a connected chain by repeatedly choosing the nearest unmarked enemy 24–110 from the previous target, still inside the tower's acquisition range. An arrow may hit only its own tower's marked set, once per enemy. It chooses the next eligible marked target at impact, so moving targets can break a chain. Marks last at most 4s and break beyond range + 80 (radius 295). A dead/escaped target can be skipped only when another eligible mark is close enough; otherwise the arrow ends. Marks from other Moonbows do not extend its route. Crescents show marks; a silver trail shows the ricochet.

At most **one Moonbow arrow is in flight per tower**, with a 4s lifetime; the attack interval is at least 1/0.65 ≈ 1.54s, and long flights may delay the next shot. Launch snapshots the target count and Silver Thread retention; buying skills does not rewrite an arrow already in flight. The arrow stops if its tower is sold; marks are owned by the tower. All falcon movement/recovery, patch growth/pulses, roots, armor-rend timers, marks and arrows freeze while gameplay is paused or over.

| Specialization / skill | Rank prices (1 / 2 / 3) | Rank 0 → 1 → 2 → 3 values |
|---|---|---|
| Falcon / Quarry | 120 / 180 / 260 | Support-priority off / on / on / on; bonus damage to healing/resurrection enemies 0 / 20 / 40 / 60% |
| Falcon / Talon Rend | 140 / 200 / 280 | Armor-amount reduction 0 / 10 / 18 / 25 percentage points, for 4s; no class change or stacking |
| Falcon / Hunting Pair | 220 / 260 / 320 | Falcon count 1 / 2 / 2 / 2; partner damage 0 / 55 / 75 / 100% (0 / 77 / 105 / 140 per strike before Quarry and defenses) |
| Thorn / Deep Roots | 110 / 170 / 240 | Root duration 0.35 / 0.5 / 0.65 / 0.8s; shared cooldown 3s, heavy-enemy factor 50% |
| Thorn / Barbed Growth | 130 / 190 / 270 | Moving-target bonus per pulse 0 / 8 / 16 / 26; total moving-target damage 16 / 24 / 32 / 42; stopped-target damage remains 16 |
| Thorn / Seed Drift | 180 / 230 / 300 | Patch count 1 / 2 / 2 / 2; second patch radius 0 / 24 / 32 / 40; first patch remains radius 40 |
| Moon / Lunar Marks | 130 / 190 / 270 | Total marks/hits per arrow 2 / 3 / 4 / 5, including the first target |
| Moon / Silver Thread | 140 / 210 / 300 | Per-hop damage retained 55 / 65 / 75 / 85%; applies successively, not as a flat bonus to all secondary hits |

Total build + upgrades + specialization + all skills: Falcon **2,366**, Thorn **2,196**, Moon **1,656**. More towers versus trained skills remains a choice: Quarry is specialized for support enemies, Seed Drift adds coverage without raising the pulse cap, and Lunar Marks requires enough suitably spaced targets. Talon Rend helps other Piercing/Steel/Siege attacks without replacing the Arcane counter to Plated or the Siege counter to Fortified. All three paths remain Piercing and resistances still apply. No monster health, movement speed, waves, income, other tower family, or legend stats were retuned.

## Progression contract for the remaining tower work

- Three ordinary tiers establish each family's role. Specializing changes its fighting pattern; skills deepen that pattern rather than all adding generic damage/range/rate.
- Every specialization has 2–3 independent skills, initially three ranks per skill. Rank count may change after playtesting; no equal-price requirement between skills or specializations.
- Specialization prices, baseline damage, activation intervals, targeting, caps and skill values must be specified in this document before each family ships. Remaining designs below are proposals, not promises of finalized numbers.
- Compare equal-gold builds: several modest towers versus one developed tower, and different skill orders. A branch must have a useful scenario and an explicit opportunity cost; no branch should erase all weaknesses.
- Control skills need duration/stacking caps and boss resistance; summons need population limits. Mixed builds should exploit complementary counters without creating permanent trapping.
- Barracks and Archer are playable. Continue with Mage, Cannon, Spire and Ballista. Add the eight new monster designs after tower identities settle; then tune the full matchup matrix, economy, wave pacing and map fairness together.

## Audit: progression and economy concerns

Starting gold = 360 + 7× level. Kill reward multiplier = 1 + 0.012× (level − 1), with individual rewards rounded. Winning carries 75% of remaining gold plus 10 per remaining life to the next level, capped at 600. Early wave calls also award gold. Waves rise from 9 to 15; enemy stats do not scale.

Potential starting gold plus all scheduled kill rewards, including Slimelings but excluding carryover, early calls, hunting, and resurrected monsters: level 1 ≈2,375; level 30 ≈12,485; level 100 ≈49,526. Actual earned gold depends on kills and escapes. Before specialization work, twenty fully upgraded towers cost 5,600–13,600; the other four families still have that original spending ceiling. This mismatch is a major candidate explanation for reaching full development long before a level ends.

Other concerns: specialization power spikes; insufficiently distinct roles; map routes with very different lengths/exposure; concentration at shared entrances; opening overload; and long late-wave cleanup. Browser observations are a small sample, not proof of global tower or hero rankings. Economy, waves, enemy HP, costs, and skills have not been retuned in this armor pass.

## Proposed: specialization roadmap

The three Archer and three Barracks designs are now playable as specified above. The other 10 remain design direction only: costs, durations, caps, targeting rules, attack profiles, visuals, and exact counter interactions need definition before implementation. Each specialization has 2–3 independently upgradeable skills. Prices and rank counts may differ. Buying, specializing, adding a skill, and ranking up an existing skill must compete for gold throughout a level.

| Specialization | Fighting identity | Upgradeable skills | Deliberate weakness |
|---|---|---|---|
| **Falcon Roost** · Archer · playable | Falcons pursue a marked enemy beyond normal tower range | **Quarry:** prioritize dangerous support enemies. **Talon Rend:** weaken plating. **Hunting Pair:** add a second falcon. | Travel and return time; poor against swarms |
| **Thornweavers** · Archer · playable | Grow bramble patches along nearby roads | **Deep Roots:** longer ground restraint. **Barbed Growth:** damage moving enemies. **Seed Drift:** establish a second patch. | Cannot hit flyers; limited patch coverage |
| **Moonbow** · Archer · playable | Deliberate arrows ricochet between moon-marked enemies | **Lunar Marks:** mark additional targets. **Silver Thread:** stronger ricochets. | Needs several separated targets; weak against plating |
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
| **Cloud Monastery** · Barracks · playable | Summons fragile spear spirits that leap between ground and aerial targets | **Cloudstep:** faster interception. **Sky Spears:** stronger anti-air attacks. | Never blocks; fragile; retreats to recover |
| **Brood Nursery** · Barracks · playable | Armored beetles hold enemies while producing temporary hatchlings | **Chitin:** tougher adults. **Hatchery:** more hatchlings. **Last Brood:** release hatchlings when adults die. | No air attacks; plating; strict population cap; future area attackers threaten the brood |
| **Jade Colossus** · Barracks · playable | One massive guardian holds a chokepoint and crushes groups | **Stoneheart:** durability and recovery. **Earthbreaker:** wider, slower crushing attacks. | Cannot cover scattered enemies or attack flyers |

Future control mechanics require resistance, cooldowns, and stacking limits; summons require population caps. Skills must reinforce identities without removing every weakness. Candidate combinations: Colossus + Faultline; Rift + Ember Orchard; Skyhook + Prism. Eight new monster designs are a later workstream; none are added by this pass.

## Change record

### 2026-10-31 — Archer paths

- Replaced Rapid Volley/Venom Arrows with Falcon Roost, Thornweavers and Moonbow, with eight independently purchased three-rank skills and explicit attack stats.
- Added owned, bounded falcons/patches/marks/projectiles, distinct tower artwork and attack feedback, and all English/Chinese UI text. All three menu styles use the shared specialization and skill system.
- Added instance-only, nonstacking armor-amount reduction through shared damage resolution. Added explicit 50% bramble-root resistance to Golems/Trolls, without changing other control effects, class matchups or monster stats.
- Preserved ordinary Archer tiers 1–3, other tower families, legends, wave schedules and income. Updated inspector attack stats and debuff/resistance snapshots; specialization prices and skills count toward selling refunds.
- Reason: provide three different tactical roles and extend meaningful spending choices before broader roster/economy tuning. These values require full-roster playtesting; they are not a claim of final balance.

### 2026-10-28 — First tower-family prototype

- Replaced Barracks' Paladin/Berserker choices with Cloud Monastery, Brood Nursery and Jade Colossus; added seven independently purchasable three-rank skills, detailed above.
- Added shared specialization/rank/cost helpers for subsequent families, purchase validation, skill-inclusive sale refunds and a scrollable touch-readable upgrade menu. New units/buildings have distinct artwork and attack feedback.
- Preserved existing armor matchups, monster stats, ordinary tower costs, other five families, waves and income. Ordinary Barracks health upgrades no longer revive fallen soldiers; wound differences are retained on living units.
- Reason: validate a deeper progression system with genuinely different roles before rolling out the remaining families. Broader balancing and a full-game playtest remain required; a longer spending ladder is not proof of fair difficulty.

### 2026-10-27 — Armor foundation

- Added Light, Plated, Fortified, and Warded classes with explicit matchups and attack penetration profiles.
- Split arrows from Steel and Cannon from ordinary physical damage. Routed hero arrows through the same rules; existing damage sources, including status damage, use shared resolution.
- Assigned current enemies to classes. Replaced Skeleton/Golem's isolated `magicWeak` multipliers with class rules; Golem now has a Siege counter, while Shaman/Necromancer resist Arcane.
- Added monster inspection and updated tower descriptions so the new counters are discoverable.
- Preserved existing HP, speed, economy, upgrade costs, waves, and playable ability system to isolate this iteration. Complete-game difficulty still needs playtesting after the armor changes.
- Recorded the agreed specialization roadmap separately from implemented behavior.

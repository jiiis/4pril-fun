// Playable specializations. Rank zero is the untrained skill; each price buys the next rank.
// Keep numbers, counters and changes in ../BALANCE.md alongside this configuration.
export const SPECIALIZATIONS = {
  archer: {
    falcon: {
      name: "Falcon Roost", icon: "falcon", cost: 190, type: "arrow",
      desc: "A falcon hunts ground or flying enemies, then returns to rest. Quarry hunts support enemies; Talon Rend helps physical allies. Travel time and swarms limit its damage.",
      range: 205, damage: 140, rate: 1, speed: 240, pursuit: 340, flightTime: 3.5,
      skills: {
        quarry: { name: "Quarry", icon: "range", costs: [120, 180, 260], descriptions: ["Prioritize healers and necromancers; +20% damage against them.", "Prioritize healers and necromancers; +40% damage against them.", "Prioritize healers and necromancers; +60% damage against them."], bonus: [0, 0.2, 0.4, 0.6] },
        talonrend: { name: "Talon Rend", icon: "sword", costs: [140, 200, 280], descriptions: ["After striking, reduce armor amount by 10 percentage points for 4s. Does not stack; class resistance remains.", "After striking, reduce armor amount by 18 percentage points for 4s. Does not stack; class resistance remains.", "After striking, reduce armor amount by 25 percentage points for 4s. Does not stack; class resistance remains."], amount: [0, 0.1, 0.18, 0.25], duration: 4 },
        huntingpair: { name: "Hunting Pair", icon: "people", costs: [220, 260, 320], descriptions: ["A second falcon joins, dealing 55% damage (77 per strike).", "The second falcon deals 75% damage (105 per strike).", "The second falcon deals full damage (140 per strike)."], count: [1, 2, 2, 2], damageFactor: [0, 0.55, 0.75, 1] },
      },
    },
    thorn: {
      name: "Thornweavers", icon: "thorns", cost: 180, type: "arrow",
      desc: "Grow a bramble patch on a nearby road. It strikes up to 5 ground enemies every 0.5s and briefly roots them. No anti-air; armor and limited coverage remain weaknesses.",
      range: 190, damage: 16, rate: 2, radius: 40, targets: 5, growth: 1.5, rootCooldown: 3,
      skills: {
        deeproots: { name: "Deep Roots", icon: "thorns", costs: [110, 170, 240], descriptions: ["Roots last 0.5s, at most once every 3s per enemy across all bramble patches. Heavy enemies halve the duration.", "Roots last 0.65s, at most once every 3s per enemy across all bramble patches. Heavy enemies halve the duration.", "Roots last 0.8s, at most once every 3s per enemy across all bramble patches. Heavy enemies halve the duration."], duration: [0.35, 0.5, 0.65, 0.8] },
        barbedgrowth: { name: "Barbed Growth", icon: "sword", costs: [130, 190, 270], descriptions: ["Moving enemies take +8 Piercing damage per pulse (24 total). Blocked or rooted enemies take only base damage.", "Moving enemies take +16 Piercing damage per pulse (32 total). Blocked or rooted enemies take only base damage.", "Moving enemies take +26 Piercing damage per pulse (42 total). Blocked or rooted enemies take only base damage."], damage: [0, 8, 16, 26] },
        seeddrift: { name: "Seed Drift", icon: "leaf", costs: [180, 230, 300], descriptions: ["Grow a second patch with radius 24 on another reachable road section.", "The second patch grows to radius 32.", "The second patch grows to radius 40. Overlapping patches never double-hit an enemy in one pulse."], radius: [0, 24, 32, 40] },
      },
    },
    moon: {
      name: "Moonbow", icon: "moon", cost: 220, type: "arrow",
      desc: "Mark a chain of enemies and fire a silver arrow that ricochets between them. Targets must be 24–110 apart. Strong against loose groups; weak against isolated, tightly packed, or armored enemies.",
      range: 215, damage: 62, rate: 0.65, jumpRange: 110, minJump: 24, markTime: 4, leash: 80,
      skills: {
        lunarmarks: { name: "Lunar Marks", icon: "moon", costs: [130, 190, 270], descriptions: ["Mark up to 3 enemies per arrow, including its first target.", "Mark up to 4 enemies per arrow, including its first target.", "Mark up to 5 enemies per arrow, including its first target."], targets: [2, 3, 4, 5] },
        silverthread: { name: "Silver Thread", icon: "chevrons", costs: [140, 210, 300], descriptions: ["Each ricochet retains 65% of the previous hit's damage.", "Each ricochet retains 75% of the previous hit's damage.", "Each ricochet retains 85% of the previous hit's damage."], retention: [0.55, 0.65, 0.75, 0.85] },
      },
    },
  },
  barracks: {
    cloud: {
      name: "Cloud Monastery", icon: "waves", cost: 210, type: "arrow",
      desc: "Two fragile spear spirits intercept ground and flying enemies, then retreat to recover. They never block; plating resists their piercing spears.",
      count: 2, hp: 110, damage: 34, rate: 0.9, speed: 180, engage: 90, respawn: 10, armor: 0, regen: 6,
      skills: {
        cloudstep: { name: "Cloudstep", costs: [120, 180, 240], descriptions: ["Speed 210; recovery 0.75s; interception radius 100.", "Speed 240; recovery 0.6s; interception radius 110.", "Speed 270; recovery 0.45s; interception radius 120."], speed: [180, 210, 240, 270], recovery: [0.9, 0.75, 0.6, 0.45], engage: [90, 100, 110, 120] },
        skyspears: { name: "Sky Spears", costs: [150, 220, 300], descriptions: ["+12 damage against flyers (46 total).", "+26 damage against flyers (60 total).", "+42 damage against flyers (76 total)."], airDamage: [0, 12, 26, 42] },
      },
    },
    brood: {
      name: "Brood Nursery", icon: "leaf", cost: 260, type: "physical",
      desc: "Two armored beetles block ground enemies and hatch temporary helpers while an adult lives. Plating resists their bites; no anti-air.",
      count: 2, hp: 250, damage: 16, rate: 0.85, speed: 75, engage: 50, respawn: 10, armor: 0.25, regen: 6,
      hatchling: { hp: 45, damage: 7, rate: 1.2, speed: 120, lifetime: 10 },
      skills: {
        chitin: { name: "Chitin", costs: [155, 210, 280], descriptions: ["Adults: 320 HP and 30% armor.", "Adults: 400 HP and 35% armor.", "Adults: 490 HP and 40% armor."], hp: [250, 320, 400, 490], armor: [0.25, 0.3, 0.35, 0.4] },
        hatchery: { name: "Hatchery", costs: [140, 210, 290], descriptions: ["Hatch every 7s; up to 3 living hatchlings.", "Hatch every 6s; up to 4 living hatchlings.", "Hatch every 5s; up to 5 living hatchlings."], interval: [8, 7, 6, 5], cap: [2, 3, 4, 5] },
        lastbrood: { name: "Last Brood", costs: [120, 180, 250], descriptions: ["An adult's death releases 1 hatchling, within the population cap.", "An adult's death releases 2 hatchlings, within the population cap.", "An adult's death releases 3 hatchlings, within the population cap."], count: [0, 1, 2, 3] },
      },
    },
    colossus: {
      name: "Jade Colossus", icon: "shieldCheck", cost: 300, type: "siege",
      desc: "One slow jade guardian blocks one enemy and crushes nearby ground targets. Siege counters fortifications; cannot cover scattered runners or flyers.",
      count: 1, hp: 900, damage: 70, rate: 0.45, speed: 60, engage: 50, respawn: 12, armor: 0.15, regen: 8,
      skills: {
        stoneheart: { name: "Stoneheart", costs: [190, 260, 340], descriptions: ["1100 HP; 11s respawn; 12 HP/s while resting.", "1350 HP; 10s respawn; 16 HP/s while resting.", "1650 HP; 9s respawn; 20 HP/s while resting."], hp: [900, 1100, 1350, 1650], respawn: [12, 11, 10, 9], regen: [8, 12, 16, 20] },
        earthbreaker: { name: "Earthbreaker", costs: [200, 280, 360], descriptions: ["90 damage; radius 36; up to 4 targets; 0.43 attacks/s.", "115 damage; radius 42; up to 5 targets; 0.41 attacks/s.", "145 damage; radius 48; up to 6 targets; 0.39 attacks/s."], damage: [70, 90, 115, 145], radius: [30, 36, 42, 48], targets: [3, 4, 5, 6], rate: [0.45, 0.43, 0.41, 0.39] },
      },
    },
  },
};

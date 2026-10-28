// Playable specializations. Rank zero is the untrained skill; each price buys the next rank.
// Keep numbers, counters and changes in ../BALANCE.md alongside this configuration.
export const SPECIALIZATIONS = {
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

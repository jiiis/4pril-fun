import { START_GOLD, START_LIVES } from "./config.js";

// Everything that changes while playing lives here.
export const state = {
  gold: START_GOLD,
  lives: START_LIVES,
  wave: 0,
  time: 0,
  enemies: [],
  towers: [],
  shots: [],
  floaters: [],      // little rising texts like "+4"
  bursts: [],        // expanding rings for explosions and hits
  bolts: [],         // chain-lightning flashes from the Lightning Spire
  fires: [],         // patches of burning ground left by napalm shells
  smoke: [],         // drifting smoke puffs
  scorches: [],      // dark marks left on the ground by cannonballs
  blood: [],         // small splashes where monsters fell
  critters: [],      // wandering animals (see critters.js)
  corpses: [],       // fallen monsters that fade into skeletons
  heroes: [],        // all hero units (see hero.js)
  hero: null,        // Lady April, the first hero (Max follows her)
  dog: null,         // Lady April's German Shepherd (see hero.js)
  eagle: null,       // Princess Avril's eagle (see hero.js)
  preview: null,     // tower type being considered in the build menu (hover, or first tap on a phone)
  spawnQueue: [],
  spawnTimer: 0,
  countdown: null,   // seconds until next wave auto-starts (null = waiting for player)
  selected: null,    // spot index with the menu open
  hover: null,       // spot index under the mouse
  rallyFor: null,    // barracks waiting for the player to click a new rally point
  hoverCritter: null,// animal under the mouse while a hero is selected
  weather: null,     // rain / snow (see weather.js)
  fish: [],          // fish mid-leap out of a river
  poops: [],         // little droppings animals leave behind (they fade away)
  over: false,
  paused: false,     // frozen by the pause button (P or Space)
};

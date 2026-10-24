// Sound effects made from scratch with the Web Audio API: no sound files needed.
// Every effect is a few short tones and/or a burst of filtered noise.

let ac = null, master = null;
let muted = localStorage.getItem("muted") === "1";
const lastPlayed = {};
const VOLUME = 0.5;

// Browsers only allow sound after the player has clicked or pressed a key,
// so we create the audio context on the first interaction.
export function unlockAudio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ac.destination);
  }
  if (ac.state === "suspended") ac.resume();
}

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  localStorage.setItem("muted", muted ? "1" : "0");
  if (master) master.gain.value = muted ? 0 : VOLUME;
  return muted;
}

// Play a named effect. minGap stops the same sound stacking up when many things happen at once.
export function sfx(name, minGap = 0.04) {
  if (muted || !ac || !SFX[name]) return;
  const now = ac.currentTime;
  if (lastPlayed[name] && now - lastPlayed[name] < minGap) return;
  lastPlayed[name] = now;
  SFX[name]();
}

// ---------- Building blocks ----------
function tone({ freq = 440, end = freq, type = "sine", dur = 0.2, vol = 0.3, delay = 0, attack = 0.005 }) {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.3, filter = 1000, filterEnd = 200, type = "lowpass", delay = 0 }) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime + delay;
  src.buffer = buf;
  f.type = type;
  f.frequency.setValueAtTime(filter, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 20), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const notes = (freqs, opts, gap) => freqs.forEach((f, i) => tone({ ...opts, freq: f, delay: i * gap }));

// ---------- The effects ----------
const SFX = {
  // Towers
  ballista:  () => { noise({ dur: 0.18, vol: 0.4, filter: 900, filterEnd: 200 }); tone({ freq: 220, end: 70, type: "sawtooth", dur: 0.22, vol: 0.25 }); tone({ freq: 1500, end: 500, dur: 0.12, vol: 0.1, delay: 0.02 }); },
  arrow:     () => { noise({ dur: 0.12, vol: 0.15, filter: 3000, filterEnd: 800, type: "bandpass" }); tone({ freq: 1200, end: 600, dur: 0.08, vol: 0.08 }); },
  arrowHit:  () => noise({ dur: 0.08, vol: 0.2, filter: 1500, filterEnd: 300 }),
  magic:     () => { tone({ freq: 600, end: 1400, dur: 0.25, vol: 0.15 }); tone({ freq: 900, end: 1800, type: "triangle", dur: 0.25, vol: 0.08, delay: 0.03 }); },
  magicHit:  () => { tone({ freq: 1500, end: 300, dur: 0.2, vol: 0.15 }); noise({ dur: 0.15, vol: 0.1, filter: 4000, filterEnd: 500, type: "bandpass" }); },
  cannon:    () => { noise({ dur: 0.35, vol: 0.5, filter: 600, filterEnd: 80 }); tone({ freq: 120, end: 40, dur: 0.3, vol: 0.4 }); },
  explosion: () => { noise({ dur: 0.6, vol: 0.5, filter: 900, filterEnd: 60 }); tone({ freq: 90, end: 30, type: "triangle", dur: 0.5, vol: 0.35 }); },
  clash:     () => { tone({ freq: 2400, end: 1800, type: "square", dur: 0.06, vol: 0.05 }); noise({ dur: 0.08, vol: 0.12, filter: 5000, filterEnd: 2000, type: "highpass" }); },
  // Monsters (each kind has its own death cry; see combat.js for how often they play)
  die:       () => { tone({ freq: 400, end: 120, type: "sawtooth", dur: 0.3, vol: 0.1 }); noise({ dur: 0.2, vol: 0.08, filter: 800, filterEnd: 200 }); },
  dieGoblin: () => { tone({ freq: 750, end: 260, type: "sawtooth", dur: 0.22, vol: 0.09 }); tone({ freq: 1100, end: 500, type: "square", dur: 0.12, vol: 0.04, delay: 0.03 }); },   // squeaky yelp
  dieWolf:   () => { tone({ freq: 480, end: 900, dur: 0.16, vol: 0.09 }); tone({ freq: 900, end: 380, dur: 0.3, vol: 0.09, delay: 0.16 }); },                                       // whimper
  dieOrc:    () => { tone({ freq: 190, end: 85, type: "sawtooth", dur: 0.35, vol: 0.14 }); noise({ dur: 0.25, vol: 0.1, filter: 600, filterEnd: 150 }); },                           // low grunt
  dieBat:    () => { tone({ freq: 1800, end: 900, dur: 0.12, vol: 0.06 }); tone({ freq: 2200, end: 1200, dur: 0.1, vol: 0.04, delay: 0.1 }); },      // squeak
  dieSkeleton: () => { for (let i = 0; i < 5; i++) noise({ dur: 0.05, vol: 0.12, filter: 3000, filterEnd: 1500, type: "bandpass", delay: i * 0.06 }); },   // bones rattling
  dieShaman: () => { tone({ freq: 300, end: 600, type: "triangle", dur: 0.25, vol: 0.09 }); tone({ freq: 600, end: 150, type: "triangle", dur: 0.35, vol: 0.09, delay: 0.25 }); },   // wail
  dieGolem:  () => { noise({ dur: 0.8, vol: 0.3, filter: 300, filterEnd: 40 }); for (let i = 0; i < 4; i++) noise({ dur: 0.08, vol: 0.15, filter: 1200, filterEnd: 300, delay: 0.2 + i * 0.12 }); },   // crumbling stone
  screech:   () => { tone({ freq: 1400, end: 2600, type: "sawtooth", dur: 0.12, vol: 0.05 }); tone({ freq: 2600, end: 1600, type: "sawtooth", dur: 0.18, vol: 0.05, delay: 0.12 }); },   // eagle
  dieSlime:  () => { noise({ dur: 0.18, vol: 0.18, filter: 900, filterEnd: 200 }); tone({ freq: 500, end: 180, type: "sine", dur: 0.2, vol: 0.1 }); },   // wet squelch
  dieNecro:  () => { tone({ freq: 220, end: 60, type: "sawtooth", dur: 0.6, vol: 0.1 }); tone({ freq: 440, end: 110, type: "triangle", dur: 0.5, vol: 0.06, delay: 0.1 }); },   // fading moan
  dieWyvern: () => { tone({ freq: 900, end: 1500, type: "sawtooth", dur: 0.2, vol: 0.08 }); tone({ freq: 1500, end: 300, type: "sawtooth", dur: 0.5, vol: 0.1, delay: 0.2 }); noise({ dur: 0.4, vol: 0.12, filter: 700, filterEnd: 100, delay: 0.3 }); },   // screech and crash
  zap:       () => { noise({ dur: 0.12, vol: 0.22, filter: 6000, filterEnd: 2000, type: "highpass" }); tone({ freq: 2400, end: 300, type: "square", dur: 0.1, vol: 0.06 }); },   // lightning crack
  raise:     () => { tone({ freq: 120, end: 360, type: "triangle", dur: 0.5, vol: 0.1 }); for (let i = 0; i < 3; i++) noise({ dur: 0.05, vol: 0.08, filter: 2500, filterEnd: 1200, type: "bandpass", delay: 0.2 + i * 0.08 }); },   // dark hum and bones
  steal:     () => { notes([880, 740, 620], { type: "square", dur: 0.12, vol: 0.08 }, 0.08); },   // gold slipping away
  dieTroll:  () => { noise({ dur: 0.7, vol: 0.25, filter: 500, filterEnd: 60 }); tone({ freq: 95, end: 38, type: "sawtooth", dur: 0.7, vol: 0.22 }); tone({ freq: 140, end: 60, type: "triangle", dur: 0.5, vol: 0.1, delay: 0.05 }); },   // deep roar
  coin:      () => { tone({ freq: 1200, type: "square", dur: 0.08, vol: 0.08 }); tone({ freq: 1800, type: "square", dur: 0.15, vol: 0.08, delay: 0.07 }); },
  lifeLost:  () => { tone({ freq: 200, end: 120, type: "sawtooth", dur: 0.4, vol: 0.2 }); tone({ freq: 150, end: 90, type: "square", dur: 0.4, vol: 0.1 }); },
  // Building
  build:     () => { noise({ dur: 0.1, vol: 0.3, filter: 1200, filterEnd: 300 }); tone({ freq: 300, end: 200, type: "triangle", dur: 0.12, vol: 0.2 }); noise({ dur: 0.1, vol: 0.25, filter: 1200, filterEnd: 300, delay: 0.15 }); },
  upgrade:   () => notes([523, 659, 784, 1047], { type: "triangle", dur: 0.18, vol: 0.15 }, 0.07),
  sell:      () => notes([784, 659, 523], { type: "triangle", dur: 0.15, vol: 0.12 }, 0.07),
  click:     () => tone({ freq: 500, type: "square", dur: 0.05, vol: 0.06 }),
  // Hero
  select:    () => tone({ freq: 880, end: 1320, dur: 0.12, vol: 0.12 }),
  order:     () => tone({ freq: 660, type: "triangle", dur: 0.08, vol: 0.1 }),
  heroDown:  () => notes([440, 370, 311, 262], { type: "triangle", dur: 0.3, vol: 0.15 }, 0.12),
  // Game flow
  wave:      () => { notes([262, 330, 392], { type: "sawtooth", dur: 0.6, vol: 0.1 }, 0); tone({ freq: 523, type: "sawtooth", dur: 0.8, vol: 0.12, delay: 0.3 }); },
  gameOver:  () => notes([392, 349, 311, 262], { type: "sawtooth", dur: 0.6, vol: 0.18 }, 0.3),
  victory:   () => notes([523, 659, 784, 1047, 784, 1047], { type: "square", dur: 0.3, vol: 0.15 }, 0.15),
};

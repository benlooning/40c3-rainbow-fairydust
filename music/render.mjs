import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ============================================================================
// Model Citizens 40C3 - Rainbow Rocket Banger (Pure Instrumental Master)
// ============================================================================
// Structure: 128 BPM @ 48,000 Hz
// 1 beat = 22,500 samples (exact integer)
// 32 Bars = 128 beats = 2,880,000 samples = exactly 60.000 seconds
// Seamless Loop with 4-bar pre-roll (bars 28..31)
//
// Timeline:
//  [0:00 - 0:15] Bars 0-7:   THE HOOK (Euphoric 4-on-the-floor, Royal Road Supersaws, Bouncing Bass)
//  [0:15 - 0:30] Bars 8-15:  HYPER-DRIVE (Counter-melodies, sparkling chiptune arpeggios, ride cymbal)
//  [0:30 - 0:45] Bars 16-23: THE HIGH-IMPACT BRIDGE
//                            - Massive Sub-Drop at 0:30
//                            - Heavy Half-Time Stomp Beat + Industrial Gated Snare
//                            - Aggressive, growling 16th-note distorted Reese Bass
//                            - Resonant 3-Octave climbing chiptune arpeggio
//                            - Sweeping filter build into a 1-beat tension cut
//  [0:45 - 1:00] Bars 24-31: THE MEGA DROP / CLIMAX
//                            - Full festival explosion, soaring anthem lead, maximum pressure
//                            - Sample-exact seamless wrap back to Bar 0!
// ============================================================================

const sampleRate = 48000;
const bpm = 128;
const samplesPerBeat = 22500;
const samplesPerBar = samplesPerBeat * 4; // 90000
const loopBars = 32;
const preBars = 4;
const loopSamples = loopBars * samplesPerBar; // 2,880,000
const preSamples = preBars * samplesPerBar;
const totalSamples = preSamples + loopSamples;

const outDir = process.env.OUT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../build/audio");

// Audio Buffers
const leftBuf = new Float32Array(totalSamples);
const rightBuf = new Float32Array(totalSamples);
const sidechain = new Float32Array(totalSamples).fill(1.0);

// Global Stereo Delay (0.75 beat L, 0.5 beat R)
const delLenL = Math.floor(samplesPerBeat * 0.75);
const delLenR = Math.floor(samplesPerBeat * 0.5);

function midiToFreq(m) {
  return 440 * (2 ** ((m - 69) / 12));
}

const noteMap = {
  G1: 31, Ab1: 32, A1: 33, Bb1: 34, B1: 35,
  C2: 36, Cs2: 37, D2: 38, Eb2: 39, E2: 40, F2: 41, Fs2: 42, G2: 43, Ab2: 44, A2: 45, Bb2: 46, B2: 47,
  C3: 48, Cs3: 49, D3: 50, Eb3: 51, E3: 52, F3: 53, Fs3: 54, G3: 55, Ab3: 56, A3: 57, Bb3: 58, B3: 59,
  C4: 60, Cs4: 61, D4: 62, Eb4: 63, E4: 64, F4: 65, Fs4: 66, G4: 67, Ab4: 68, A4: 69, Bb4: 70, B4: 71,
  C5: 72, Cs5: 73, D5: 74, Eb5: 75, E5: 76, F5: 77, Fs5: 78, G5: 79, Ab5: 80, A5: 81, Bb5: 82, B5: 83,
  C6: 84, Cs6: 85, D6: 86, Eb6: 87, E6: 88, F6: 89, Fs6: 90, G6: 91, Ab6: 92, A6: 93, Bb6: 94, B6: 95,
  C7: 96
};

function panGains(pan) {
  const angle = (pan + 1) * Math.PI * 0.25;
  return [Math.cos(angle), Math.sin(angle)];
}

function addAudio(frameIdx, l, r = l) {
  if (frameIdx >= 0 && frameIdx < totalSamples) {
    leftBuf[frameIdx] += l;
    rightBuf[frameIdx] += r;
  }
}

// Unconditionally stable RBJ Biquad Filters
class BiquadLP {
  constructor(fc = 4000, q = 1.0) {
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
    this.set(fc, q);
  }
  set(fc, q = 1.0) {
    fc = Math.max(20, Math.min(sampleRate * 0.45, fc));
    const w0 = (2 * Math.PI * fc) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const b0 = (1 - cosw0) * 0.5;
    const b1 = 1 - cosw0;
    const b2 = (1 - cosw0) * 0.5;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

class BiquadBP {
  constructor(fc = 2000, q = 2.0) {
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
    this.set(fc, q);
  }
  set(fc, q = 2.0) {
    fc = Math.max(20, Math.min(sampleRate * 0.45, fc));
    const w0 = (2 * Math.PI * fc) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// ----------------------------------------------------------------------------
// 1. SYNTHESIS INSTRUMENTS
// ----------------------------------------------------------------------------

// 7-Voice SuperSaw (Lush, wide, euphoric)
function addSuperSawChord(startBeat, beatLength, chordNotes, cutoffFreq = 8000, gain = 0.32, useSidechain = true) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(beatLength * samplesPerBeat);
  const freqs = chordNotes.map(n => midiToFreq(noteMap[n]));
  const svfL = new BiquadLP(cutoffFreq, 1.2);
  const svfR = new BiquadLP(cutoffFreq, 1.2);

  const detunes = [-0.016, -0.009, -0.003, 0.0, 0.003, 0.009, 0.016];
  const phasesL = freqs.map(() => detunes.map(() => Math.random()));
  const phasesR = freqs.map(() => detunes.map(() => Math.random()));

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const attack = Math.min(1, t / 0.012);
    const release = Math.max(0, 1 - Math.max(0, i - (lengthFrames - 600)) / 600);
    const env = attack * release * gain;

    let sigL = 0;
    let sigR = 0;

    for (let c = 0; c < freqs.length; c++) {
      const baseF = freqs[c];
      for (let d = 0; d < detunes.length; d++) {
        const fL = baseF * (1 + detunes[d]);
        const fR = baseF * (1 - detunes[d] * 1.05);

        phasesL[c][d] = (phasesL[c][d] + fL / sampleRate) % 1;
        phasesR[c][d] = (phasesR[c][d] + fR / sampleRate) % 1;

        sigL += 2 * phasesL[c][d] - 1;
        sigR += 2 * phasesR[c][d] - 1;
      }
    }

    const normL = sigL / (freqs.length * 3.5);
    const normR = sigR / (freqs.length * 3.5);

    const filtL = svfL.process(normL);
    const filtR = svfR.process(normR);

    const sc = useSidechain ? sidechain[fIdx] : 1.0;
    addAudio(fIdx, filtL * env * sc, filtR * env * sc);
  }
}

// Heavy Rolling Reese / Saw Bass (for main drops)
function addReeseBass(startBeat, beatLength, noteStr, gain = 0.65, cutoff = 1600) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(beatLength * samplesPerBeat);
  const freq = midiToFreq(noteMap[noteStr]);
  const svf = new BiquadLP(cutoff, 1.4);

  let p1 = Math.random();
  let p2 = Math.random();
  let pSub = Math.random();

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const attack = Math.min(1, t / 0.005);
    const release = Math.max(0, 1 - Math.max(0, i - (lengthFrames - 400)) / 400);
    const env = attack * release * gain;

    p1 = (p1 + freq / sampleRate) % 1;
    p2 = (p2 + (freq * 1.008) / sampleRate) % 1;
    pSub = (pSub + (freq * 0.5) / sampleRate) % 1;

    const saw1 = 2 * p1 - 1;
    const saw2 = 2 * p2 - 1;
    const sub = Math.sin(2 * Math.PI * pSub) * 1.3;

    const filtered = svf.process(saw1 * 0.4 + saw2 * 0.4 + sub);
    const sc = sidechain[fIdx];
    const s = filtered * env * sc;
    addAudio(fIdx, s, s);
  }
}

// AGGRESSIVE GROWLING ELECTRO BASS (Specifically for the 0:30 - 0:45 Breakdown!)
// Distorted, resonant, pulsating, gives maximum impact without stopping the energy!
function addAggressiveElectroBass(startBeat, beatLength, noteStr, gain = 0.75, filterMod = 1.0) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(beatLength * samplesPerBeat);
  const freq = midiToFreq(noteMap[noteStr]);
  const svf = new BiquadLP(Math.min(12000, 1800 * filterMod), 2.2);

  let p1 = 0, p2 = 0;
  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const attack = Math.min(1, t / 0.004);
    const decay = Math.exp(-t * 6.0);
    const env = attack * decay * gain;

    p1 = (p1 + freq / sampleRate) % 1;
    p2 = (p2 + (freq * 1.015) / sampleRate) % 1;

    // Heavily saturated dual saw + sub
    const raw = (2 * p1 - 1) * 0.6 + (2 * p2 - 1) * 0.5 + Math.sin(2 * Math.PI * (freq * 0.5) * t) * 1.2;
    const distorted = Math.tanh(raw * 2.5); // Rich analog saturation
    const filtered = svf.process(distorted);

    addAudio(fIdx, filtered * env, filtered * env);
  }
}

// Soaring Festival Lead Hook (Analog supersaw lead with vibrato)
function addAnthemLead(startBeat, beatLength, noteStr, gain = 0.38, pan = 0) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(beatLength * samplesPerBeat);
  const baseFreq = midiToFreq(noteMap[noteStr]);
  const [pL, pR] = panGains(pan);
  const svf = new BiquadLP(7000, 1.4);

  let p1 = 0, p2 = 0, p3 = 0;

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const attack = Math.min(1, t / 0.008);
    const release = Math.max(0, 1 - Math.max(0, i - (lengthFrames - 500)) / 500);
    const env = attack * release * gain;

    const vib = t > 0.12 ? Math.sin(2 * Math.PI * 5.8 * (t - 0.12)) * 0.016 : 0;
    const f = baseFreq * (1 + vib);

    p1 = (p1 + f / sampleRate) % 1;
    p2 = (p2 + (f * 1.006) / sampleRate) % 1;
    p3 = (p3 + (f * 0.994) / sampleRate) % 1;

    const saw = (2 * p1 - 1) * 0.4 + (2 * p2 - 1) * 0.35 + (2 * p3 - 1) * 0.35;
    const filtered = svf.process(saw);
    const s = filtered * env;

    addAudio(fIdx, s * pL, s * pR);

    // Stereo delay
    if (fIdx + delLenL < totalSamples) addAudio(fIdx + delLenL, s * pR * 0.28, 0);
    if (fIdx + delLenR < totalSamples) addAudio(fIdx + delLenR, 0, s * pL * 0.28);
  }
}

// Sparkling 16th Chiptune Arp (Nyan Rainbow Glaze)
function addChiptuneLeadArp(startBeat, beatLength, notes, duty = 0.25, gain = 0.2, pan = 0) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(beatLength * samplesPerBeat);
  const freqs = notes.map(n => midiToFreq(noteMap[n]));
  const [pL, pR] = panGains(pan);

  let phase = 0;
  const samplesPerStep = Math.floor(samplesPerBeat * 0.25);

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;

    const step = Math.floor(i / samplesPerStep);
    const noteIdx = step % freqs.length;
    const curFreq = freqs[noteIdx];

    const stepT = (i % samplesPerStep) / sampleRate;
    const decay = Math.exp(-stepT * 18);
    const env = decay * gain;

    phase = (phase + curFreq / sampleRate) % 1;
    const p = phase < duty ? 1.0 : -1.0;
    const s = p * env;

    addAudio(fIdx, s * pL, s * pR);

    if (fIdx + delLenL < totalSamples) addAudio(fIdx + delLenL, s * pR * 0.22, 0);
    if (fIdx + delLenR < totalSamples) addAudio(fIdx + delLenR, 0, s * pL * 0.22);
  }
}

// ----------------------------------------------------------------------------
// 2. FESTIVAL DRUMS, SUB-DROPS & FX
// ----------------------------------------------------------------------------

function addClubKick(startBeat, punch = 1.0) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(sampleRate * 0.38);

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const env = Math.exp(-t * 11);
    const pitch = 44 + 170 * Math.exp(-t * 30);
    const body = Math.sin(2 * Math.PI * pitch * t) * env;
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 180) * 0.35;
    const s = (body * 0.95 + click) * 1.18 * punch;

    addAudio(fIdx, s, s);

    // Sidechain ducking
    const duckT = i / (sampleRate * 0.34);
    if (duckT < 1.0) {
      const v = 0.12 + 0.88 * (duckT ** 1.8);
      if (v < sidechain[fIdx]) sidechain[fIdx] = v;
    }
  }
}

// Heavy Industrial Stomp Kick (specifically for the half-time bridge!)
function addIndustrialStomp(startBeat, gain = 1.3) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(sampleRate * 0.65);

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const env = Math.exp(-t * 7.5);
    const pitch = 38 + 140 * Math.exp(-t * 22);
    const body = Math.sin(2 * Math.PI * pitch * t) * env;
    const thud = Math.tanh(body * 2.2) * 0.85;
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.4;
    const s = (thud + click) * gain;

    addAudio(fIdx, s, s);

    // Longer deep sidechain
    const duckT = i / (sampleRate * 0.45);
    if (duckT < 1.0) {
      const v = 0.10 + 0.90 * (duckT ** 1.6);
      if (v < sidechain[fIdx]) sidechain[fIdx] = v;
    }
  }
}

// Massive Gated Reverb Snare / Clap
function addSnareClapLayer(startBeat, gain = 0.9) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(sampleRate * 0.35);

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 20) * 0.45;
    const noiseL = (Math.random() * 2 - 1) * Math.exp(-t * 16) * 0.6;
    const noiseR = (Math.random() * 2 - 1) * Math.exp(-t * 16) * 0.6;
    let clap = 0;
    if (t > 0.012 && t < 0.022) clap += (Math.random() * 2 - 1) * 0.35;
    if (t > 0.022 && t < 0.034) clap += (Math.random() * 2 - 1) * 0.4;

    addAudio(fIdx, (tone + noiseL + clap) * gain, (tone + noiseR + clap) * gain);
  }
}

// Gated 80s / Cyber Snare with massive stadium tail
function addStadiumSnare(startBeat, gain = 1.1) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(sampleRate * 0.55);

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;

    const env = t < 0.35 ? 1.0 : Math.exp(-(t - 0.35) * 45); // Gated tail
    const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 18) * 0.5;
    const noiseL = (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.7;
    const noiseR = (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.7;
    const sL = (tone + noiseL) * env * gain;
    const sR = (tone + noiseR) * env * gain;
    addAudio(fIdx, sL, sR);
  }
}

function addHiHat(startBeat, open = false, gain = 0.28, pan = 0) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(sampleRate * (open ? 0.28 : 0.055));
  const [pL, pR] = panGains(pan);
  const decay = open ? 16 : 85;

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;
    const env = Math.exp(-t * decay);
    const noise = (Math.random() * 2 - 1) * env * gain;
    addAudio(fIdx, noise * pL, noise * pR);
  }
}

function addCrashImpact(startBeat, gain = 0.75) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(sampleRate * 2.8);
  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;
    const env = Math.exp(-t * 1.8);
    const noiseL = (Math.random() * 2 - 1) * env * 0.35 * gain;
    const noiseR = (Math.random() * 2 - 1) * env * 0.35 * gain;
    addAudio(fIdx, noiseL, noiseR);
  }
}

// MASSIVE 808 SUB-DROP (Pitched sub bass bomb hitting at 0:30!)
function addSubDropBomb(startBeat, gain = 1.2) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(sampleRate * 2.5);
  let phase = 0;

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const t = i / sampleRate;
    const env = Math.exp(-t * 1.2);
    // Pitch drops from 140Hz smoothly down to 32Hz (sub-bass earthquake)
    const pitch = 32 + 108 * Math.exp(-t * 2.8);
    phase += pitch / sampleRate;

    const sub = Math.sin(2 * Math.PI * phase);
    const sat = Math.tanh(sub * 1.8) * 0.85; // Warm harmonic saturation
    const s = sat * env * gain;
    addAudio(fIdx, s, s);
  }
}

function addRiserSweep(startBeat, durationBeats, gain = 0.6) {
  const startFrame = Math.floor(startBeat * samplesPerBeat);
  const lengthFrames = Math.floor(durationBeats * samplesPerBeat);
  const svf = new BiquadBP(4000, 2.0);

  for (let i = 0; i < lengthFrames; i++) {
    const fIdx = startFrame + i;
    if (fIdx >= totalSamples) break;
    const p = i / lengthFrames;
    const env = (p ** 2.2) * gain * 0.5;
    const cutoff = 300 + (p ** 2.2) * 9000;
    svf.set(cutoff, 2.0);
    const noise = Math.random() * 2 - 1;
    const filtered = svf.process(noise);
    addAudio(fIdx, filtered * env * 0.85, filtered * env * 1.15);
  }
}

// ----------------------------------------------------------------------------
// 3. COMPOSITION & ARRANGEMENT (32 Bars, 60.00s Exact Loop)
// ----------------------------------------------------------------------------
// Progression (D Major Royal Road):
// 1: Gmaj7 (G - B - D - F#)
// 2: A7    (A - C# - E - G)
// 3: F#m7  (F# - A - C# - E)
// 4: Bm7   (B - D - F# - A)

const chords = [
  { root: "G2", electroRoot: "G1", chord: ["G4", "B4", "D5", "Fs5"], arp: ["G4", "B4", "D5", "Fs5", "G5", "B5", "D6", "Fs6"] },
  { root: "A2", electroRoot: "A1", chord: ["A4", "Cs5", "E5", "G5"], arp: ["A4", "Cs5", "E5", "G5", "A5", "Cs6", "E6", "G6"] },
  { root: "Fs2", electroRoot: "Fs1", chord: ["Fs4", "A4", "Cs5", "E5"], arp: ["Fs4", "A4", "Cs5", "E5", "Fs5", "A5", "Cs6", "E6"] },
  { root: "B2", electroRoot: "B1", chord: ["B4", "D5", "Fs5", "A5"], arp: ["B4", "D5", "Fs5", "A5", "B5", "D6", "Fs6", "A6"] }
];

// The Iconic Soaring Lead Melody
const anthemLeadNotes = [
  // Bar 0 (over G)
  { b: 0.0, len: 0.5, n: "D5" },
  { b: 0.5, len: 0.5, n: "Fs5" },
  { b: 1.0, len: 0.5, n: "G5" },
  { b: 1.5, len: 0.5, n: "A5" },
  { b: 2.0, len: 1.0, n: "Fs5" },
  { b: 3.0, len: 0.5, n: "D5" },
  { b: 3.5, len: 0.5, n: "E5" },

  // Bar 1 (over A)
  { b: 4.0, len: 0.5, n: "Fs5" },
  { b: 4.5, len: 0.5, n: "A5" },
  { b: 5.0, len: 0.5, n: "B5" },
  { b: 5.5, len: 0.5, n: "Cs6" },
  { b: 6.0, len: 1.5, n: "A5" },
  { b: 7.5, len: 0.5, n: "Fs5" },

  // Bar 2 (over F#m)
  { b: 8.0, len: 0.5, n: "A5" },
  { b: 8.5, len: 0.5, n: "Gs5" },
  { b: 9.0, len: 0.5, n: "A5" },
  { b: 9.5, len: 0.5, n: "Cs6" },
  { b: 10.0, len: 1.0, n: "B5" },
  { b: 11.0, len: 0.5, n: "A5" },
  { b: 11.5, len: 0.5, n: "Fs5" },

  // Bar 3 (over Bm)
  { b: 12.0, len: 0.5, n: "E5" },
  { b: 12.5, len: 0.5, n: "Fs5" },
  { b: 13.0, len: 0.5, n: "D5" },
  { b: 13.5, len: 1.5, n: "B4" },
  { b: 15.0, len: 0.5, n: "Cs5" },
  { b: 15.5, len: 0.5, n: "D5" }
];

console.log(">>> Rendering Pure Instrumental Banger (32 Bars)...");

for (let bar = -preBars; bar < loopBars; bar++) {
  const normBar = ((bar % loopBars) + loopBars) % loopBars;
  const pIdx = normBar % 4;
  const ch = chords[pIdx];
  const barStartBeat = (bar + preBars) * 4;

  // Key phases:
  const isPart1 = (normBar < 8);                           // 0:00 - 0:15 (Opening Hook)
  const isPart2 = (normBar >= 8 && normBar < 16);          // 0:15 - 0:30 (Hyper-Drive)
  const isBridge = (normBar >= 16 && normBar < 24);        // 0:30 - 0:45 (HIGH-IMPACT BRIDGE)
  const isDrop = (normBar >= 24);                          // 0:45 - 1:00 (MEGA DROP / CLIMAX)

  // -------------------------------------------------------------
  // A. THE BRIDGE (seconds 30 to 45 / bars 16 to 23)
  // FULL PRESSURE, SUB-DROP & HEAVY ELECTRO BASS!
  // -------------------------------------------------------------
  if (isBridge) {
    const bridgeStep = normBar - 16; // 0 to 7

    // 1. Bar 16 (exactly at 30.0 seconds): the sub-drop hits
    if (bridgeStep === 0) {
      addSubDropBomb(barStartBeat, 1.4);
      addCrashImpact(barStartBeat, 0.9);
    }

    // 2. Heavy half-time stomp (kick on 0 and 2.5, stadium snare on 2)
    addIndustrialStomp(barStartBeat + 0.0, 1.35);
    addIndustrialStomp(barStartBeat + 2.5, 1.25);
    addStadiumSnare(barStartBeat + 2.0, 1.15);

    // Offbeat hi-hats and claps for momentum
    addHiHat(barStartBeat + 1.0, true, 0.35, 0.3);
    addHiHat(barStartBeat + 3.0, true, 0.35, 0.3);

    // 3. Aggressive sixteenth-note electro bass line
    const filterOpen = 0.5 + (bridgeStep / 7) * 1.5; // Open the filter a little further each bar
    for (let s = 0; s < 16; s++) {
      // Driving sixteenth-note rhythm
      const bTime = barStartBeat + s * 0.25;
      const note = (s % 4 === 2 ? ch.root : ch.electroRoot);
      addAggressiveElectroBass(bTime, 0.22, note, 0.65, filterOpen);
    }

    // 4. Rising demoscene arpeggio spanning three octaves
    addChiptuneLeadArp(barStartBeat + 0.0, 4.0, ch.arp, 0.5, 0.22 * filterOpen, -0.4);

    // 5. In the final two bridge bars (22-23 / seconds 41-45):
    // Build a snare roll and sweep the riser upwards
    if (bridgeStep >= 6) {
      for (let s = 0; s < 16; s++) {
        addSnareClapLayer(barStartBeat + s * 0.25, 0.4 + (bridgeStep - 6) * 0.3 + s * 0.02);
      }
    }
    if (bridgeStep === 6) {
      addRiserSweep(barStartBeat, 8, 0.8);
    }

    // Bar 23, beat 3 (44.5 seconds): tension break before the drop
    // No new events are triggered on beat 3.5
  }

  // -------------------------------------------------------------
  // B. DROPS AND MAIN SECTION (bars 0-15 and 24-31)
  // -------------------------------------------------------------
  if (!isBridge) {
    // 1. Driving four-on-the-floor club kick
    addClubKick(barStartBeat + 0);
    addClubKick(barStartBeat + 1);
    addClubKick(barStartBeat + 2);
    addClubKick(barStartBeat + 3);

    // 2. Fat snare on 2 and 4 (beats 1 and 3)
    addSnareClapLayer(barStartBeat + 1);
    addSnareClapLayer(barStartBeat + 3);

    // 3. Open hi-hat on the offbeats
    addHiHat(barStartBeat + 0.5, true, 0.32, 0.3);
    addHiHat(barStartBeat + 1.5, true, 0.32, 0.3);
    addHiHat(barStartBeat + 2.5, true, 0.32, 0.3);
    addHiHat(barStartBeat + 3.5, true, 0.32, 0.3);

    // 4. 16th Shakers
    for (let s = 0; s < 16; s++) {
      addHiHat(barStartBeat + s * 0.25, false, 0.16, s % 2 === 0 ? -0.3 : 0.3);
    }

    // 5. Pumping SuperSaw Chords (Dotted 8th Bounce)
    const sawCutoff = isDrop ? 9500 : (isPart2 ? 8000 : 7000);
    addSuperSawChord(barStartBeat + 0.0, 1.4, ch.chord, sawCutoff, 0.30, true);
    addSuperSawChord(barStartBeat + 1.5, 1.0, ch.chord, sawCutoff, 0.28, true);
    addSuperSawChord(barStartBeat + 2.5, 1.4, ch.chord, sawCutoff, 0.30, true);

    // 6. Rolling Reese bass underneath the kicks
    addReeseBass(barStartBeat + 0.0, 1.4, ch.root, 0.65, 1600);
    addReeseBass(barStartBeat + 1.5, 1.0, ch.root, 0.60, 1600);
    addReeseBass(barStartBeat + 2.5, 1.4, ch.root, 0.65, 1600);

    // 7. Sparkling chiptune arpeggio
    addChiptuneLeadArp(barStartBeat + 0.0, 4.0, ch.chord, 0.25, 0.18, 0.4);

    // 8. Crash impacts at the start of each drop
    if (normBar === 0 || normBar === 24) {
      addCrashImpact(barStartBeat, 0.85);
    }

    // 9. SOARING ANTHEM LEAD HOOK (bars 0-7 and 24-31)
    if (isPart1 || isDrop) {
      const loopStep = normBar % 4;
      for (const h of anthemLeadNotes) {
        const hBar = Math.floor(h.b / 4);
        const hBeat = h.b % 4;
        if (hBar === loopStep) {
          addAnthemLead(barStartBeat + hBeat, h.len, h.n, isDrop ? 0.42 : 0.35, -0.2);
          // Final drop (seconds 45-60): high-octave layer
          if (isDrop) {
            const highNote = h.n.slice(0, -1) + (parseInt(h.n.slice(-1)) + 1);
            addAnthemLead(barStartBeat + hBeat, h.len, highNote, 0.22, 0.3);
          }
        }
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 4. SEAMLESS LOOP EXPORT (SAMPLE-EXACT 60.000s)
// ----------------------------------------------------------------------------
console.log(">>> Extracting seamless loop window...");
const loopL = leftBuf.subarray(preSamples, preSamples + loopSamples);
const loopR = rightBuf.subarray(preSamples, preSamples + loopSamples);

let maxPeak = 0;
for (let i = 0; i < loopSamples; i++) {
  if (Math.abs(loopL[i]) > maxPeak) maxPeak = Math.abs(loopL[i]);
  if (Math.abs(loopR[i]) > maxPeak) maxPeak = Math.abs(loopR[i]);
}
const gain = maxPeak > 0.001 ? Math.min(1.0, 0.95 / maxPeak) : 1.0;
console.log(`[MASTER] Peak: ${maxPeak.toFixed(3)}, Applied Gain: ${gain.toFixed(3)}`);

const baseName = "Model Citizens - 40C3 Rainbow Anthem (Pure Banger)";
const wavPath = path.join(outDir, "soundtrack.wav");
const dataSize = loopSamples * 4;
const buf = Buffer.alloc(44 + dataSize);

buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < loopSamples; i++) {
  const l = Math.tanh(loopL[i] * gain);
  const r = Math.tanh(loopR[i] * gain);
  buf.writeInt16LE(Math.round(l * 32767), offset);
  buf.writeInt16LE(Math.round(r * 32767), offset + 2);
  offset += 4;
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(wavPath, buf);
console.log(`Saved WAV: ${path.basename(wavPath)}`);

const flacPath = path.join(outDir, "soundtrack.flac");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath, "-c:a", "flac", flacPath], { stdio: "inherit" });
console.log(`Saved FLAC: ${path.basename(flacPath)}`);
console.log("Audio rendering complete.");

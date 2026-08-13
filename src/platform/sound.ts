/**
 * The pet's voice.
 *
 * Synthesised rather than shipped as files: seven cues of sampled audio would
 * add more to the installer than the whole rest of the app, and the point of a
 * desktop pet is that it stays out of the way. Web Audio gives us the same
 * result in a few hundred bytes.
 *
 * Everything here is one instrument — a soft struck-wood tone: two detuned
 * oscillators through a lowpass, fast attack, exponential decay. Cues differ
 * only in which notes they play and how long they ring, so the pet sounds like
 * one creature rather than a drawer of unrelated beeps. Notes are semitone
 * offsets on a major pentatonic, which is why no two cues can clash.
 */

export type SoundCue =
  | "chirp" // the pet said something
  | "pop" // poked, or the media pill opened
  | "chime" // a focus block ended
  | "nudge" // a reminder, a break, a glass of water
  | "success" // an agent finished cleanly
  | "error" // an agent failed
  | "unroll"; // the paper scroll opening

/** A5. High enough to read as small and animal, low enough not to pierce. */
const BASE_HZ = 880;

interface Note {
  /** Semitones from BASE_HZ. */
  semitone: number;
  /** Seconds after the cue starts. */
  at: number;
  /** Ring-out in seconds. */
  hold: number;
  /** 0..1, relative within the cue. */
  level?: number;
}

/**
 * Exported so a test can hold the whole voice to one standard rather than
 * checking cues one at a time.
 */
export const CUES: Record<SoundCue, Note[]> = {
  chirp: [
    { semitone: 0, at: 0, hold: 0.09 },
    { semitone: 7, at: 0.055, hold: 0.11 },
  ],
  pop: [{ semitone: 12, at: 0, hold: 0.06, level: 0.7 }],
  chime: [
    { semitone: 0, at: 0, hold: 0.22 },
    { semitone: 4, at: 0.08, hold: 0.24 },
    { semitone: 7, at: 0.16, hold: 0.28 },
    { semitone: 12, at: 0.24, hold: 0.5 },
  ],
  nudge: [
    { semitone: 7, at: 0, hold: 0.18 },
    { semitone: 12, at: 0.11, hold: 0.3 },
  ],
  success: [
    { semitone: 0, at: 0, hold: 0.12 },
    { semitone: 7, at: 0.07, hold: 0.14 },
    { semitone: 12, at: 0.14, hold: 0.34 },
  ],
  // The only descending cue, and the only one that leans minor. Failure should
  // be recognisable with your back to the screen.
  error: [
    { semitone: 3, at: 0, hold: 0.14 },
    { semitone: -2, at: 0.1, hold: 0.28 },
  ],
  unroll: [
    { semitone: -12, at: 0, hold: 0.05, level: 0.35 },
    { semitone: -5, at: 0.06, hold: 0.05, level: 0.3 },
    { semitone: 0, at: 0.12, hold: 0.14, level: 0.4 },
  ],
};

const hz = (semitone: number) => BASE_HZ * Math.pow(2, semitone / 12);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let volume = 0.5;

/** Apply the user's setting. Called on load and on every settings change. */
export function setSound(on: boolean, level: number): void {
  enabled = on;
  volume = Math.max(0, Math.min(1, level));
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
}

function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (ctx && master) {
    // WebView2 suspends the context when the window is occluded; nudge it back
    // rather than silently dropping the cue.
    if (ctx.state === "suspended") void ctx.resume();
    return { ctx, master };
  }
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return { ctx, master };
  } catch {
    // No audio device, or the context was blocked. The pet is still perfectly
    // usable without a voice, so this is never worth surfacing.
    ctx = null;
    master = null;
    return null;
  }
}

function strike(ctx: AudioContext, out: GainNode, note: Note, start: number) {
  const freq = hz(note.semitone);
  const peak = 0.32 * (note.level ?? 1);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  // 4ms attack: any slower and it reads as a synth pad rather than a tap.
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.004 + note.hold);

  // A lowpass that closes as the note decays — what makes a struck tone sound
  // struck rather than held.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(freq * 4, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(220, freq), start + note.hold);
  filter.Q.value = 0.7;

  for (const [type, detune, mix] of [
    ["triangle", 0, 1],
    ["sine", 7, 0.5],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const trim = ctx.createGain();
    trim.gain.value = mix;
    osc.connect(trim).connect(filter);
    osc.start(start);
    osc.stop(start + 0.004 + note.hold + 0.02);
  }

  filter.connect(gain).connect(out);
}

/** Play a cue. Silent and harmless when sound is off or unavailable. */
export function playCue(cue: SoundCue): void {
  if (!enabled) return;
  const notes = CUES[cue];
  if (!notes) return;
  const a = audio();
  if (!a) return;
  try {
    const start = a.ctx.currentTime + 0.001;
    for (const note of notes) strike(a.ctx, a.master, note, start + note.at);
  } catch {
    /* a cue is never worth breaking a render over */
  }
}

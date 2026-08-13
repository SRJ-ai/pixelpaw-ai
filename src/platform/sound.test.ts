import { describe, expect, it } from "vitest";
import { CUES, type SoundCue } from "./sound";

/**
 * The cue table is the pet's whole voice, and the thing most likely to drift
 * once cues are added one at a time. These hold the family together rather
 * than checking any single sound.
 */
describe("cue table", () => {
  const cues = Object.keys(CUES) as SoundCue[];

  it("gives every cue at least one note", () => {
    for (const cue of cues) expect(CUES[cue].length).toBeGreaterThan(0);
  });

  it("never schedules a silent or backwards note", () => {
    for (const cue of cues) {
      for (const note of CUES[cue]) {
        expect(note.hold, cue).toBeGreaterThan(0);
        expect(note.at, cue).toBeGreaterThanOrEqual(0);
        expect(note.level ?? 1, cue).toBeGreaterThan(0);
        expect(note.level ?? 1, cue).toBeLessThanOrEqual(1);
      }
    }
  });

  it("plays each cue's notes in order", () => {
    for (const cue of cues) {
      const times = CUES[cue].map((n) => n.at);
      expect(times, cue).toStrictEqual([...times].sort((a, b) => a - b));
    }
  });

  it("keeps every cue short enough to sit under a glance", () => {
    // Anything longer stops being a cue and starts being a jingle.
    for (const cue of cues) {
      const end = Math.max(...CUES[cue].map((n) => n.at + n.hold));
      expect(end, cue).toBeLessThanOrEqual(0.8);
    }
  });

  it("stays inside one octave-and-a-half, so no cue sounds like a different instrument", () => {
    for (const cue of cues) {
      for (const note of CUES[cue]) {
        expect(Math.abs(note.semitone), cue).toBeLessThanOrEqual(18);
      }
    }
  });

  it("makes failure the only cue that falls", () => {
    // Recognising "that went wrong" without looking is the entire job of the
    // error cue, and it only works while nothing else falls.
    const falls = (cue: SoundCue) => {
      const steps = CUES[cue].map((n) => n.semitone);
      return steps.some((s, i) => i > 0 && s < steps[i - 1]);
    };
    expect(cues.filter(falls)).toStrictEqual(["error"]);
  });
});

import type { AnimState } from "@/types/pet";

/**
 * Idle life system (§9). Picks the next little idle behavior using weighted
 * random selection, avoids repeating the last one, and biases by energy so a
 * tired pet rests and an energetic one explores. Lightweight: it only decides
 * *when* and *what*, the state machine + animator do the rest.
 */
interface IdleOption {
  state: AnimState;
  weight: number;
}

const OPTIONS: IdleOption[] = [
  { state: "blink", weight: 30 },
  { state: "look", weight: 20 },
  { state: "groom", weight: 12 },
  { state: "wiggle", weight: 9 },
  { state: "happy", weight: 7 },
  { state: "sit", weight: 10 },
  { state: "stretch", weight: 7 },
  { state: "yawn", weight: 5 },
  { state: "walk", weight: 5 },
  { state: "sleep", weight: 4 },
];

export class IdleDirector {
  private last: AnimState | null = null;
  private nextAt = 0;

  /** Returns an idle behavior to trigger now, or null if it's not yet time. */
  tick(time: number, energy: number): AnimState | null {
    if (time < this.nextAt) return null;
    this.schedule(time, energy);
    return this.pick(energy);
  }

  private schedule(time: number, energy: number) {
    // Frequent little behaviors so the pet always feels alive.
    const base = 900 + Math.random() * 1600;
    this.nextAt = time + base * (energy < 0.3 ? 1.5 : 1);
  }

  private weightFor(o: IdleOption, energy: number): number {
    let w = o.weight;
    if (energy < 0.3 && (o.state === "sleep" || o.state === "sit" || o.state === "groom")) w *= 2.2;
    if (energy > 0.7 && (o.state === "wiggle" || o.state === "look" || o.state === "happy")) w *= 1.6;
    return w;
  }

  private pick(energy: number): AnimState {
    const opts = OPTIONS.filter((o) => o.state !== this.last);
    const total = opts.reduce((s, o) => s + this.weightFor(o, energy), 0);
    let r = Math.random() * total;
    for (const o of opts) {
      r -= this.weightFor(o, energy);
      if (r <= 0) {
        this.last = o.state;
        return o.state;
      }
    }
    this.last = "blink";
    return "blink";
  }
}

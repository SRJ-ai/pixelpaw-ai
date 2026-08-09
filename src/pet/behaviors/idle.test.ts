import { describe, expect, it } from "vitest";
import { IdleDirector } from "./idle";

describe("IdleDirector", () => {
  it("waits before offering the first behavior", () => {
    const d = new IdleDirector();
    // t=0 schedules the first pick; an immediate re-tick should be too early.
    d.tick(0, 0.8);
    expect(d.tick(1, 0.8)).toBeNull();
  });

  it("eventually returns a behavior", () => {
    const d = new IdleDirector();
    let picked: string | null = null;
    for (let t = 0; t < 60_000 && !picked; t += 500) picked = d.tick(t, 0.8);
    expect(picked).toBeTruthy();
  });

  it("never repeats the same behavior back-to-back", () => {
    const d = new IdleDirector();
    let last: string | null = null;
    let checks = 0;
    for (let t = 0; t < 400_000 && checks < 40; t += 250) {
      const next = d.tick(t, 0.8);
      if (!next) continue;
      if (last) {
        expect(next).not.toBe(last);
        checks++;
      }
      last = next;
    }
    expect(checks).toBeGreaterThan(5);
  });

  it("favors rest when energy is low", () => {
    const rest = new Set(["sleep", "sit", "groom"]);
    const count = (energy: number) => {
      const d = new IdleDirector();
      let n = 0;
      let total = 0;
      for (let t = 0; t < 600_000 && total < 120; t += 250) {
        const next = d.tick(t, energy);
        if (!next) continue;
        total++;
        if (rest.has(next)) n++;
      }
      return n;
    };
    expect(count(0.1)).toBeGreaterThan(count(0.9));
  });
});

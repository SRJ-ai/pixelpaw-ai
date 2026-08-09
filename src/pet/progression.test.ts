import { describe, expect, it } from "vitest";
import { EMPTY_PROGRESS, award, bondLevel, levelFor, levelProgress, ACHIEVEMENTS } from "./progression";

describe("levels", () => {
  it("starts at level 1", () => {
    expect(levelFor(0)).toBe(1);
  });

  it("levels up at the first threshold", () => {
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
  });

  it("needs progressively more XP per level", () => {
    const xpForLevel = (target: number) => {
      let xp = 0;
      while (levelFor(xp) < target) xp++;
      return xp;
    };
    const gap2to3 = xpForLevel(3) - xpForLevel(2);
    const gap3to4 = xpForLevel(4) - xpForLevel(3);
    expect(gap3to4).toBeGreaterThan(gap2to3);
  });

  it("reports progress within the current level as 0..1", () => {
    for (const xp of [0, 50, 99, 100, 500, 5000]) {
      const p = levelProgress(xp);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1.0001);
    }
  });
});

describe("bond", () => {
  it("starts as a stranger", () => {
    expect(bondLevel(0).level).toBe("stranger");
  });

  it("climbs through the tiers", () => {
    expect(bondLevel(60).level).toBe("friend");
    expect(bondLevel(250).level).toBe("close_friend");
    expect(bondLevel(700).level).toBe("best_friend");
    expect(bondLevel(2000).level).toBe("special_bond");
  });

  it("caps progress at the top tier", () => {
    expect(bondLevel(99999).progress).toBe(1);
  });
});

describe("award", () => {
  it("adds xp and bond without mutating the input", () => {
    const start = { ...EMPTY_PROGRESS };
    const { next } = award(start, 10, 5);
    expect(next.xp).toBe(10);
    expect(next.bond).toBe(5);
    expect(start.xp).toBe(0);
  });

  it("flags a level-up when the threshold is crossed", () => {
    expect(award({ ...EMPTY_PROGRESS, xp: 95 }, 10, 0).leveledUp).toBe(true);
    expect(award({ ...EMPTY_PROGRESS, xp: 10 }, 10, 0).leveledUp).toBe(false);
  });

  it("unlocks an achievement only once", () => {
    const first = award({ ...EMPTY_PROGRESS, pets: 1 }, 0, 0);
    expect(first.unlocked.map((a) => a.id)).toContain("first_pet");
    const again = award(first.next, 0, 0);
    expect(again.unlocked.map((a) => a.id)).not.toContain("first_pet");
  });

  it("every achievement is reachable from some progress", () => {
    const maxed = {
      ...EMPTY_PROGRESS,
      xp: 100000,
      bond: 100000,
      pets: 1000,
      pomodoros: 100,
      agentSuccesses: 50,
      tasksDone: 50,
    };
    for (const a of ACHIEVEMENTS) expect(a.earned(maxed)).toBe(true);
  });
});

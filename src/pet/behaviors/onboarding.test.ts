import { beforeEach, describe, expect, it } from "vitest";
import { loadOnboarding, markSeen, planOnboarding } from "./onboarding";

beforeEach(() => localStorage.clear());

describe("onboarding state", () => {
  it("starts with nothing seen", () => {
    expect(loadOnboarding()).toStrictEqual({ intro: false, agent: false });
  });

  it("remembers each step separately", () => {
    markSeen("intro");
    expect(loadOnboarding()).toStrictEqual({ intro: true, agent: false });
    markSeen("agent");
    expect(loadOnboarding()).toStrictEqual({ intro: true, agent: true });
  });

  it("treats a corrupt record as a fresh install", () => {
    // Greeting someone twice is a much smaller failure than never telling them
    // where the menu is, so this fails towards showing it.
    localStorage.setItem("pixelpaw.onboarding.v1", "{{{");
    expect(loadOnboarding()).toStrictEqual({ intro: false, agent: false });
  });

  it("ignores a record that claims truth with the wrong type", () => {
    localStorage.setItem("pixelpaw.onboarding.v1", JSON.stringify({ intro: "yes" }));
    expect(loadOnboarding().intro).toBe(false);
  });
});

describe("planOnboarding", () => {
  it("greets a fresh install", () => {
    const steps = planOnboarding({ intro: false, agent: false }, false);
    expect(steps.map((s) => s.step)).toStrictEqual(["intro"]);
  });

  it("adds the agent tip only when there is an agent to connect", () => {
    expect(planOnboarding({ intro: false, agent: false }, true).map((s) => s.step)).toStrictEqual([
      "intro",
      "agent",
    ]);
  });

  it("says nothing on a second run", () => {
    expect(planOnboarding({ intro: true, agent: true }, true)).toStrictEqual([]);
  });

  it("still offers the agent tip to someone who has already been greeted", () => {
    // Installing a CLI after the first run is the normal case, not an edge one.
    const steps = planOnboarding({ intro: true, agent: false }, true);
    expect(steps.map((s) => s.step)).toStrictEqual(["agent"]);
  });

  it("never overlaps two lines", () => {
    const steps = planOnboarding({ intro: false, agent: false }, true);
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      expect(steps[i].at).toBeGreaterThanOrEqual(prev.at + prev.hold);
    }
  });

  it("waits before the first line rather than firing on the first frame", () => {
    // A line already on screen when the window appears reads as part of the
    // loading and gets skipped by the eye.
    expect(planOnboarding({ intro: false, agent: false }, false)[0].at).toBeGreaterThan(1000);
  });
});

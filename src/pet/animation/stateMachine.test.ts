import { describe, expect, it } from "vitest";
import { StateMachine } from "./stateMachine";
import { STATES } from "./states";

describe("StateMachine", () => {
  it("starts idle", () => {
    expect(new StateMachine().current).toBe("idle");
  });

  it("accepts a transition out of idle", () => {
    const sm = new StateMachine();
    expect(sm.request("happy", 1000)).toBe(true);
    expect(sm.current).toBe("happy");
  });

  it("ignores a request for the state it's already in", () => {
    const sm = new StateMachine();
    sm.request("happy", 1000);
    expect(sm.request("happy", 2000)).toBe(false);
  });

  it("lets higher priority interrupt an uninterruptible state", () => {
    const sm = new StateMachine();
    sm.request("happy", 1000); // priority 1, not interruptible
    // dragged is priority 3
    expect(STATES.dragged.priority).toBeGreaterThan(STATES.happy.priority);
    expect(sm.request("dragged", 1010)).toBe(true);
    expect(sm.current).toBe("dragged");
  });

  it("blocks equal/lower priority while an uninterruptible state is running", () => {
    const sm = new StateMachine();
    sm.request("happy", 1000);
    expect(sm.request("curious", 1010)).toBe(false);
    expect(sm.current).toBe("happy");
  });

  it("enforces per-state cooldowns", () => {
    const sm = new StateMachine();
    const cd = STATES.surprised.cooldownMs;
    sm.request("surprised", 1000);
    // Advance time the way the engine does, so the state finishes and drops to idle.
    const finish = 1000 + STATES.surprised.maxMs + 1;
    sm.update(STATES.surprised.maxMs + 1, finish);
    expect(sm.current).toBe("idle");
    // Too soon — still inside the cooldown window.
    expect(sm.request("surprised", 1000 + cd - 50)).toBe(false);
    // After the cooldown it may fire again.
    expect(sm.request("surprised", 1000 + cd + 10)).toBe(true);
  });

  it("returns non-looping states to idle after maxMs", () => {
    const sm = new StateMachine();
    sm.request("surprised", 0);
    sm.update(STATES.surprised.maxMs + 1, STATES.surprised.maxMs + 1);
    expect(sm.current).toBe("idle");
  });

  it("keeps looping states running past maxMs", () => {
    const sm = new StateMachine();
    sm.request("sleep", 0);
    sm.update(60_000, 60_000);
    expect(sm.current).toBe("sleep");
  });

  it("releaseToIdle respects an in-flight uninterruptible state", () => {
    const sm = new StateMachine();
    sm.request("dizzy", 0); // uninterruptible
    sm.update(10, 10);
    sm.releaseToIdle(10);
    expect(sm.current).toBe("dizzy");
  });
});

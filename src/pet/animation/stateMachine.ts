import type { AnimState } from "@/types/pet";
import { STATES } from "./states";

/**
 * Animation state machine (§8). Enforces priority, interruptibility, minimum
 * dwell time and per-state cooldowns so behaviors don't spam or stomp each other.
 * It does NOT know how to draw anything — it only decides *which* state is active.
 */
export class StateMachine {
  current: AnimState = "idle";
  elapsed = 0; // ms spent in the current state
  private lastTrigger = new Map<AnimState, number>();

  constructor(private onChange?: (s: AnimState) => void) {}

  /** Try to enter `next`. Returns true if the transition was accepted. */
  request(next: AnimState, time: number): boolean {
    if (next === this.current) return false;
    const cur = STATES[this.current];
    const def = STATES[next];

    const last = this.lastTrigger.get(next) ?? -Infinity;
    if (time - last < def.cooldownMs) return false;

    const higherPriority = def.priority > cur.priority;
    const canReplace = cur.interruptible && this.elapsed >= cur.minMs;
    if (!higherPriority && !canReplace) return false;

    this.enter(next, time);
    return true;
  }

  private enter(next: AnimState, time: number) {
    this.current = next;
    this.elapsed = 0;
    this.lastTrigger.set(next, time);
    this.onChange?.(next);
  }

  /** Advance time; auto-return non-looping states to idle when finished. */
  update(dt: number, time: number) {
    this.elapsed += dt;
    const def = STATES[this.current];
    if (!def.loop && def.maxMs > 0 && this.elapsed >= def.maxMs) {
      this.enter("idle", time);
    }
  }

  /** Force back to idle unless we're mid an uninterruptible state. */
  releaseToIdle(time: number) {
    const cur = STATES[this.current];
    if (this.current !== "idle" && (cur.interruptible || this.elapsed >= cur.maxMs)) {
      this.enter("idle", time);
    }
  }

  is(s: AnimState) {
    return this.current === s;
  }
}

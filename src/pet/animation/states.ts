import type { AnimState } from "@/types/pet";

/** Behavior priority tiers (§44). Higher interrupts lower. */
export const PRIORITY = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;

export interface StateDef {
  priority: number;
  /** May a request of equal/lower priority replace this once past `minMs`? */
  interruptible: boolean;
  /** Loops until explicitly changed; otherwise auto-finishes after `maxMs`. */
  loop: boolean;
  /** Minimum dwell time before an equal/lower-priority state can take over. */
  minMs: number;
  /** For non-looping states, when to auto-return to idle. */
  maxMs: number;
  /** Minimum gap before this state may trigger again (§45). */
  cooldownMs: number;
}

export const STATES: Record<AnimState, StateDef> = {
  idle: { priority: 0, interruptible: true, loop: true, minMs: 0, maxMs: 0, cooldownMs: 0 },
  blink: { priority: 0, interruptible: true, loop: false, minMs: 80, maxMs: 160, cooldownMs: 900 },
  look: { priority: 0, interruptible: true, loop: false, minMs: 500, maxMs: 1500, cooldownMs: 2000 },
  walk: { priority: 1, interruptible: true, loop: true, minMs: 700, maxMs: 0, cooldownMs: 2500 },
  sit: { priority: 0, interruptible: true, loop: true, minMs: 1400, maxMs: 0, cooldownMs: 4000 },
  sleep: { priority: 0, interruptible: true, loop: true, minMs: 4000, maxMs: 0, cooldownMs: 8000 },
  wake: { priority: 1, interruptible: false, loop: false, minMs: 500, maxMs: 800, cooldownMs: 0 },
  yawn: { priority: 0, interruptible: false, loop: false, minMs: 900, maxMs: 1200, cooldownMs: 9000 },
  stretch: { priority: 0, interruptible: false, loop: false, minMs: 900, maxMs: 1300, cooldownMs: 9000 },
  happy: { priority: 1, interruptible: false, loop: false, minMs: 800, maxMs: 1300, cooldownMs: 1200 },
  curious: { priority: 1, interruptible: true, loop: false, minMs: 600, maxMs: 1600, cooldownMs: 1200 },
  surprised: { priority: 2, interruptible: false, loop: false, minMs: 450, maxMs: 850, cooldownMs: 1200 },
  petted: { priority: 2, interruptible: true, loop: true, minMs: 250, maxMs: 0, cooldownMs: 0 },
  purring: { priority: 2, interruptible: true, loop: true, minMs: 600, maxMs: 0, cooldownMs: 0 },
  dragged: { priority: 3, interruptible: false, loop: true, minMs: 0, maxMs: 0, cooldownMs: 0 },
  dizzy: { priority: 3, interruptible: false, loop: false, minMs: 1100, maxMs: 1700, cooldownMs: 2000 },
  hunting: { priority: 2, interruptible: true, loop: true, minMs: 600, maxMs: 0, cooldownMs: 4000 },
  kneading: { priority: 1, interruptible: true, loop: true, minMs: 300, maxMs: 0, cooldownMs: 0 },
  overheat: { priority: 2, interruptible: true, loop: true, minMs: 900, maxMs: 0, cooldownMs: 3000 },
  hurt: { priority: 2, interruptible: true, loop: false, minMs: 250, maxMs: 720, cooldownMs: 220 },
  groom: { priority: 0, interruptible: true, loop: false, minMs: 800, maxMs: 2000, cooldownMs: 6000 },
  wiggle: { priority: 1, interruptible: false, loop: false, minMs: 700, maxMs: 1200, cooldownMs: 4000 },
};

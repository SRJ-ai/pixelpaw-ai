/**
 * Progression (§23, §24). XP and bond grow from ordinary use — petting, focus
 * sessions, finished tasks, agent successes — and only ever unlock cosmetic or
 * behavioural extras. Nothing here gates real functionality, and decay is
 * deliberately absent so the app never feels punishing (§22).
 */

export type BondLevel = "stranger" | "friend" | "close_friend" | "best_friend" | "special_bond";

export interface Progress {
  xp: number;
  /** Cumulative bond points. */
  bond: number;
  /** Counters for achievements (§56). */
  pets: number;
  pomodoros: number;
  agentSuccesses: number;
  tasksDone: number;
  /** Unlocked achievement ids. */
  achievements: string[];
}

export const EMPTY_PROGRESS: Progress = {
  xp: 0,
  bond: 0,
  pets: 0,
  pomodoros: 0,
  agentSuccesses: 0,
  tasksDone: 0,
  achievements: [],
};

/** XP awarded per event. Small, frequent, never punitive. */
export const XP = {
  pet: 2,
  pomodoroComplete: 40,
  breakTaken: 5,
  taskDone: 15,
  agentSuccess: 20,
  chat: 3,
} as const;

/** Level curve: each level costs a little more than the last. */
export function levelFor(xp: number): number {
  let level = 1;
  let need = 100;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    level++;
    need = Math.round(need * 1.25);
  }
  return level;
}

/** Progress through the current level, 0..1 — for the HUD bar. */
export function levelProgress(xp: number): number {
  let need = 100;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    need = Math.round(need * 1.25);
  }
  return need === 0 ? 0 : remaining / need;
}

const BOND_THRESHOLDS: { level: BondLevel; at: number; label: string }[] = [
  { level: "stranger", at: 0, label: "Stranger" },
  { level: "friend", at: 50, label: "Friend" },
  { level: "close_friend", at: 200, label: "Close friend" },
  { level: "best_friend", at: 600, label: "Best friend" },
  { level: "special_bond", at: 1500, label: "Special bond" },
];

export function bondLevel(bond: number): { level: BondLevel; label: string; progress: number } {
  let idx = 0;
  for (let i = 0; i < BOND_THRESHOLDS.length; i++) {
    if (bond >= BOND_THRESHOLDS[i].at) idx = i;
  }
  const cur = BOND_THRESHOLDS[idx];
  const next = BOND_THRESHOLDS[idx + 1];
  const progress = next ? (bond - cur.at) / (next.at - cur.at) : 1;
  return { level: cur.level, label: cur.label, progress: Math.max(0, Math.min(1, progress)) };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: (p: Progress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_pet", title: "First Pet", description: "Petted your companion.", earned: (p) => p.pets >= 1 },
  { id: "hundred_pets", title: "100 Pets", description: "Petted 100 times.", earned: (p) => p.pets >= 100 },
  { id: "first_pomodoro", title: "First Focus", description: "Finished a Pomodoro.", earned: (p) => p.pomodoros >= 1 },
  { id: "ten_pomodoros", title: "Deep Worker", description: "Finished 10 Pomodoros.", earned: (p) => p.pomodoros >= 10 },
  { id: "first_task", title: "Ticked Off", description: "Completed a task.", earned: (p) => p.tasksDone >= 1 },
  { id: "first_agent", title: "Good Boy, Agent", description: "An agent finished successfully.", earned: (p) => p.agentSuccesses >= 1 },
  { id: "level_10", title: "Level 10", description: "Reached level 10.", earned: (p) => levelFor(p.xp) >= 10 },
  { id: "max_bond", title: "Special Bond", description: "Reached the deepest bond.", earned: (p) => bondLevel(p.bond).level === "special_bond" },
];

/** Award XP/bond and return the updated progress plus any newly-earned achievements. */
export function award(
  p: Progress,
  xp: number,
  bond: number
): { next: Progress; leveledUp: boolean; unlocked: Achievement[] } {
  const before = levelFor(p.xp);
  const next: Progress = { ...p, xp: p.xp + xp, bond: p.bond + bond, achievements: [...p.achievements] };
  const unlocked = ACHIEVEMENTS.filter(
    (a) => !next.achievements.includes(a.id) && a.earned(next)
  );
  for (const a of unlocked) next.achievements.push(a.id);
  return { next, leveledUp: levelFor(next.xp) > before, unlocked };
}

const KEY = "pixelpaw.progress.v1";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_PROGRESS };
    return { ...EMPTY_PROGRESS, ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full / unavailable — progression is non-critical */
  }
}

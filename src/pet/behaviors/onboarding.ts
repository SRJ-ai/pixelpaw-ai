/**
 * What the pet says the very first time it runs, and only then.
 *
 * A new install currently drops a cat on the desktop and stops. Everything the
 * app can do is behind a right-click that nothing tells you about, and the tray
 * icon — the other route — is the one Windows hides in the overflow flyout. So
 * the pet says it out loud, once.
 *
 * Deliberately not a welcome dialog. A modal on first launch is something to
 * dismiss before you have any reason to care, and it teaches nothing about
 * where things live afterwards. Saying it *from the pet* puts the instruction
 * on the thing the instruction is about.
 *
 * The planning below is pure so the sequencing is testable without a desktop:
 * getting "shown once, ever" wrong is invisible in development, where storage
 * is cleared constantly, and obvious to a user who is greeted every morning.
 */

const KEY = "pixelpaw.onboarding.v1";

export interface OnboardState {
  /** The right-click line — the one that matters. */
  intro: boolean;
  /** The offer to watch a coding agent, only if one is actually installed. */
  agent: boolean;
}

const NONE: OnboardState = { intro: false, agent: false };

export function loadOnboarding(): OnboardState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...NONE };
    const p = JSON.parse(raw) as Partial<OnboardState>;
    return { intro: p.intro === true, agent: p.agent === true };
  } catch {
    // A corrupt record means we show the intro again. Saying it twice is a far
    // smaller failure than a user who never learns about the menu.
    return { ...NONE };
  }
}

export function markSeen(step: keyof OnboardState): void {
  try {
    const next = { ...loadOnboarding(), [step]: true };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — the greeting simply repeats */
  }
}

export interface OnboardStep {
  step: keyof OnboardState;
  /** Milliseconds after the pet appears. */
  at: number;
  /** How long the line stays up. */
  hold: number;
}

/**
 * Which lines are still owed, and when.
 *
 * The intro waits a moment rather than firing on the first frame: a line that
 * is already on screen when the window appears reads as part of the loading,
 * and gets skipped by the eye. The agent tip comes well after, so the two are
 * separate thoughts rather than a wall of text.
 */
export function planOnboarding(
  state: OnboardState,
  hasConnectableAgent: boolean
): OnboardStep[] {
  const steps: OnboardStep[] = [];
  if (!state.intro) steps.push({ step: "intro", at: 2500, hold: 7000 });
  if (!state.agent && hasConnectableAgent) {
    // Deliberately measured from the same origin, and placed after the intro
    // has finished rather than overlapping it.
    steps.push({ step: "agent", at: 11000, hold: 6500 });
  }
  return steps;
}

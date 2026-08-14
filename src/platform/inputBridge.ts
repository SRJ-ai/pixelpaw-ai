/**
 * Subscribes to the native keyboard-activity + scroll streams. These carry only
 * counts/deltas (see src-tauri/src/input.rs) — never key identity or content.
 */
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export function subscribeKeyboard(cb: (presses: number) => void): Promise<UnlistenFn> {
  return listen<{ presses: number }>("input:key", (e) => cb(e.payload.presses));
}

export function subscribeScroll(cb: (delta: number) => void): Promise<UnlistenFn> {
  return listen<{ delta: number }>("input:scroll", (e) => cb(e.payload.delta));
}

/** Tray "Take a break" -> trigger the break flourish on demand. */
export function subscribeBreak(cb: () => void): Promise<UnlistenFn> {
  return listen("tray:break", () => cb());
}

/** Tray "Pomodoro" -> toggle a focus session. */
export function subscribePomodoro(cb: () => void): Promise<UnlistenFn> {
  return listen("tray:pomodoro", () => cb());
}

/**
 * Schedules changed from the pet's own menu. `minutes` of 0 means off for the
 * two intervals; for `onRemindIn` it is always a real duration.
 */
export function subscribeSchedule(
  onBreakEvery: (minutes: number) => void,
  onWaterEvery: (minutes: number) => void,
  onRemindIn: (minutes: number) => void
): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<number>("tray:break-every", (e) => onBreakEvery(e.payload)),
    listen<number>("tray:water-every", (e) => onWaterEvery(e.payload)),
    listen<number>("tray:remind-in", (e) => onRemindIn(e.payload)),
  ]);
}

/** Chat asked the pet to do something ("dance", "sleep"). */
export function subscribeAct(cb: (state: string) => void): Promise<UnlistenFn> {
  return listen<string>("pet:act", (e) => cb(e.payload));
}

/** Menu "Focus mode" -> quiet the pet without hiding it (§37). */
export function subscribeFocus(cb: () => void): Promise<UnlistenFn> {
  return listen("tray:focus", () => cb());
}

/** Tray "Peek Mode" -> tuck to / restore from a screen edge. */
export function subscribePeek(cb: () => void): Promise<UnlistenFn> {
  return listen("tray:peek", () => cb());
}

/** Tray "Drink water" -> water nudge on demand. */
export function subscribeWater(cb: () => void): Promise<UnlistenFn> {
  return listen("tray:water", () => cb());
}

export type AgentStatus =
  | "idle"
  | "working"
  | "thinking"
  | "waiting"
  | "success"
  | "error"
  | "cancelled";

/** Coding-agent status posted to the local API (§41). */
export function subscribeAgent(
  cb: (agent: string, status: AgentStatus) => void
): Promise<UnlistenFn> {
  return listen<{ agent: string; status: AgentStatus }>("agent:status", (e) =>
    cb(e.payload.agent, e.payload.status)
  );
}

/**
 * A newer version exists. Rust does the checking, downloading and installing;
 * the UI's only job is to mention it, so the user knows the menu item is worth
 * clicking rather than having to go looking.
 */
export function subscribeUpdate(
  onAvailable: (version: string) => void,
  onNone: () => void,
  onFailed: (reason: string) => void
): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<{ version: string }>("update:available", (e) => onAvailable(e.payload.version)),
    listen("update:none", () => onNone()),
    listen<string>("update:failed", (e) => onFailed(e.payload)),
  ]);
}

/** Where the pet should park while a coding agent's window has focus (§21). */
export interface DockTarget {
  x: number;
  y: number;
  /** The tool we recognised, so the pet can name it. */
  app: string;
}

export function subscribeDock(
  onTarget: (t: DockTarget) => void,
  onRelease: () => void
): Promise<UnlistenFn[]> {
  return Promise.all([
    listen<DockTarget>("dock:target", (e) => onTarget(e.payload)),
    listen("dock:release", () => onRelease()),
  ]);
}

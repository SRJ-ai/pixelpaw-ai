/**
 * When the pet last heard from a coding agent.
 *
 * "Are my hooks even firing?" is otherwise unanswerable. The pet reacts for a
 * few seconds and then looks exactly as it does when nothing arrived at all, so
 * a hook that is silently broken — a wrong path, a tool that never runs them,
 * an exe that moved — is indistinguishable from an agent that simply has not
 * finished anything yet. Writing down the last contact turns that into
 * something Settings can show and the user can check.
 */

const KEY = "pixelpaw.agent.last";

export interface AgentContact {
  who: string;
  status: string;
  /** Epoch ms. */
  at: number;
}

export function recordAgentContact(who: string, status: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ who, status, at: Date.now() }));
  } catch {
    /* storage blocked — the diagnostic is a nicety, never a dependency */
  }
}

export function readAgentContact(): AgentContact | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AgentContact>;
    if (typeof p?.who !== "string" || typeof p?.status !== "string") return null;
    return { who: p.who, status: p.status, at: typeof p.at === "number" ? p.at : 0 };
  } catch {
    return null;
  }
}

/** "3 minutes ago" — coarse on purpose; the question is recent-or-not. */
export function describeAge(at: number, now = Date.now()): string {
  const secs = Math.max(0, Math.round((now - at) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

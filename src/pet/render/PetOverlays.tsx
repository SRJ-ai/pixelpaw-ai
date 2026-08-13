/**
 * The two things that stay on screen beside the pet: a Pomodoro countdown and
 * a note you pinned.
 *
 * Both are deliberately display-only. The pet window is click-through except
 * over the pet's silhouette and whatever rectangle the UI publishes to Rust,
 * and only one such rectangle exists — the media pill owns it. Making these
 * interactive would mean either fighting the pill for that slot or teaching the
 * native side about a list of rects, and neither buys much: the timer is
 * stopped from the same menu that starts it, and the note is edited in
 * Settings.
 */

/** mm:ss, floor-rounded so the last second is shown rather than skipped. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PomodoroTimer({
  active,
  phase,
  remainingMs,
  label,
}: {
  active: boolean;
  phase: "focus" | "break";
  remainingMs: number;
  label: string;
}) {
  return (
    <div
      className={"pp-timer " + phase + (active ? " show" : "")}
      aria-hidden={!active}
      role="timer"
      aria-label={label}
    >
      <span className="pp-timer-phase">{label}</span>
      <span className="pp-timer-clock">{formatCountdown(remainingMs)}</span>
    </div>
  );
}

/**
 * "Your agent is waiting for you", and it stays waiting.
 *
 * The speech bubble and the scroll are both timed — they say their piece and
 * go. That is right for everything else the pet says, and exactly wrong for
 * this one: an agent blocks on you precisely when you have looked away, so a
 * message that expires after three seconds is a message you will miss. This
 * badge stays up until the agent moves on or you acknowledge it.
 *
 * Kept small and beside the pet rather than large and over it: the point is to
 * be noticeable in peripheral vision, not to demand the screen.
 */
export function AttentionBadge({ who, active }: { who: string; active: boolean }) {
  return (
    <div className={"pp-attn" + (active ? " show" : "")} role="status" aria-hidden={!active}>
      <span className="pp-attn-dot" aria-hidden="true" />
      <span className="pp-attn-who">{who}</span>
    </div>
  );
}

export function PinnedNote({ text }: { text: string }) {
  const shown = text.trim();
  return (
    <div className={"pp-pin" + (shown ? " show" : "")} aria-hidden={!shown}>
      {shown}
    </div>
  );
}

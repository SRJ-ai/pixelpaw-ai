/**
 * Deciding whether a scheduled reminder is due (§34).
 *
 * Split out of the engine because the rule is subtle enough to be worth
 * testing on its own: the scheduler that calls it can be throttled to roughly
 * one tick a minute while the pet window is hidden, and the machine may have
 * been asleep at the scheduled minute, so matching HH:MM exactly would quietly
 * drop reminders. Instead a reminder stays due for a while after its time.
 */
import type { Reminder } from "@/config/settings";

/**
 * How late a recurring reminder may be and still fire. Past this it goes stale
 * rather than ambushing the user hours after the fact.
 */
export const REMINDER_GRACE_MIN = 60;

/** Parse "HH:MM" into minutes past midnight, or null if it isn't a valid time. */
export function minutesOfDay(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Local "YYYY-MM-DD" — the key a reminder's `lastFired` is stamped with. */
/**
 * "In 30 minutes" as the "HH:MM" the scheduler wants.
 *
 * A menu can offer a duration but not a title and a clock time, so the pet's
 * own menu sets relative reminders and the chat window handles absolute ones.
 * Wrapping past midnight is the case worth getting right: 23:50 plus 30 minutes
 * is 00:20, and a reminder that lands at 24:20 never fires at all.
 */
export function inMinutes(minutes: number, now = new Date()): string {
  const total = (now.getHours() * 60 + now.getMinutes() + Math.round(minutes)) % (24 * 60);
  const wrapped = (total + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface DueContext {
  /** Wall-clock moment being evaluated. */
  now: Date;
  /** Date key this reminder last fired on within the running session, if any. */
  firedThisSession?: string;
}

/**
 * True when `r` should fire right now. Caller is responsible for recording the
 * fire (both in-session and on the reminder's `lastFired`).
 */
export function isReminderDue(r: Reminder, ctx: DueContext): boolean {
  if (!r.enabled) return false;

  const { now } = ctx;
  const day = now.getDay();
  if (r.recurrence === "weekdays" && (day === 0 || day === 6)) return false;

  const today = dateKey(now);
  if (ctx.firedThisSession === today || r.lastFired === today) return false;

  const due = minutesOfDay(r.time);
  if (due === null) return false;

  const lateBy = now.getHours() * 60 + now.getMinutes() - due;
  if (lateBy < 0) return false;
  // A one-off is something the user asked for explicitly, so it fires however
  // late we notice it; recurring ones expire instead.
  return r.recurrence === "once" || lateBy <= REMINDER_GRACE_MIN;
}

import { describe, expect, it } from "vitest";
import type { Reminder } from "@/config/settings";
import { dateKey, isReminderDue, minutesOfDay, REMINDER_GRACE_MIN } from "./reminders";

/** 2026-08-12 is a Wednesday; 2026-08-15 is a Saturday. */
const WED = (h: number, m: number) => new Date(2026, 7, 12, h, m, 0);
const SAT = (h: number, m: number) => new Date(2026, 7, 15, h, m, 0);

function reminder(over: Partial<Reminder> = {}): Reminder {
  return { id: "r1", title: "Stand up", time: "09:30", recurrence: "daily", enabled: true, ...over };
}

describe("minutesOfDay", () => {
  it("parses HH:MM", () => {
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("09:30")).toBe(570);
    expect(minutesOfDay("23:59")).toBe(1439);
  });

  it("rejects nonsense instead of firing at a wrong time", () => {
    expect(minutesOfDay("")).toBeNull();
    expect(minutesOfDay("9:5")).toBeNull();
    expect(minutesOfDay("24:00")).toBeNull();
    expect(minutesOfDay("10:75")).toBeNull();
  });
});

describe("isReminderDue", () => {
  it("fires at the scheduled minute", () => {
    expect(isReminderDue(reminder(), { now: WED(9, 30) })).toBe(true);
  });

  it("does not fire early", () => {
    expect(isReminderDue(reminder(), { now: WED(9, 29) })).toBe(false);
  });

  it("still fires when the check was late — a stalled tick must not skip it", () => {
    // The bug this replaces required an exact HH:MM match, so a single missed
    // minute dropped the reminder for the whole day.
    expect(isReminderDue(reminder(), { now: WED(9, 31) })).toBe(true);
    expect(isReminderDue(reminder(), { now: WED(10, 30) })).toBe(true);
  });

  it("lets a recurring reminder go stale past the grace window", () => {
    const past = WED(9, 30 + REMINDER_GRACE_MIN + 1);
    expect(isReminderDue(reminder(), { now: past })).toBe(false);
  });

  it("fires a one-off however late it is noticed", () => {
    const r = reminder({ recurrence: "once" });
    expect(isReminderDue(r, { now: WED(23, 0) })).toBe(true);
  });

  it("respects the enabled flag", () => {
    expect(isReminderDue(reminder({ enabled: false }), { now: WED(9, 30) })).toBe(false);
  });

  it("skips weekend days for weekday reminders", () => {
    const r = reminder({ recurrence: "weekdays" });
    expect(isReminderDue(r, { now: WED(9, 30) })).toBe(true);
    expect(isReminderDue(r, { now: SAT(9, 30) })).toBe(false);
  });

  it("fires at most once a day, in-session", () => {
    const now = WED(9, 30);
    expect(isReminderDue(reminder(), { now, firedThisSession: dateKey(now) })).toBe(false);
  });

  it("does not repeat after a restart on the same day", () => {
    const now = WED(9, 45);
    const r = reminder({ lastFired: dateKey(now) });
    expect(isReminderDue(r, { now })).toBe(false);
  });

  it("fires again the next day once lastFired is stale", () => {
    const r = reminder({ lastFired: "2026-08-11" });
    expect(isReminderDue(r, { now: WED(9, 30) })).toBe(true);
  });
});

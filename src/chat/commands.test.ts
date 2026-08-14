import { describe, expect, it } from "vitest";
import { parseCommand, parseTime } from "./commands";

describe("parseTime", () => {
  it("reads the shapes people actually type", () => {
    expect(parseTime("5pm")).toBe("17:00");
    expect(parseTime("5 pm")).toBe("17:00");
    expect(parseTime("5:30pm")).toBe("17:30");
    expect(parseTime("17:00")).toBe("17:00");
    expect(parseTime("9")).toBe("09:00");
    expect(parseTime("9:05am")).toBe("09:05");
  });

  it("gets the midnight and noon edges right", () => {
    // The two every naive 12-hour parser gets wrong.
    expect(parseTime("12am")).toBe("00:00");
    expect(parseTime("12pm")).toBe("12:00");
    expect(parseTime("12:30am")).toBe("00:30");
  });

  it("refuses nonsense rather than guessing", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("5:99")).toBeNull();
    expect(parseTime("13pm")).toBeNull();
    expect(parseTime("later")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
});

describe("reminders", () => {
  it("takes a time and a subject", () => {
    expect(parseCommand("remind me at 5pm to call mum")).toStrictEqual({
      kind: "reminder",
      title: "call mum",
      time: "17:00",
      recurrence: "once",
    });
  });

  it("accepts the subject before the time", () => {
    expect(parseCommand("remind me to submit the form at 9:30am")).toStrictEqual({
      kind: "reminder",
      title: "submit the form",
      time: "09:30",
      recurrence: "once",
    });
  });

  it("picks up recurrence and strips it from the subject", () => {
    const c = parseCommand("remind me at 7am to stretch every day");
    expect(c).toStrictEqual({
      kind: "reminder",
      title: "stretch",
      time: "07:00",
      recurrence: "daily",
    });
  });

  it("handles weekdays", () => {
    expect(parseCommand("remind me at 10 to stand up on weekdays")).toMatchObject({
      recurrence: "weekdays",
      time: "10:00",
    });
  });

  it("uses the last time, so a stray 'at' does not win", () => {
    expect(parseCommand("remind me at work at 6pm to lock up")).toMatchObject({
      time: "18:00",
    });
  });

  it("declines when there is no readable time rather than inventing one", () => {
    // Silently defaulting to a wrong hour is worse than not creating it.
    expect(parseCommand("remind me to call mum later")).toBeNull();
    expect(parseCommand("remind me at teatime to call mum")).toBeNull();
  });

  it("still makes a reminder when only a time is given", () => {
    expect(parseCommand("remind me at 6pm")).toMatchObject({ title: "Reminder", time: "18:00" });
  });
});

describe("name", () => {
  it("takes the phrasings people use", () => {
    for (const s of ["my name is Vamsi", "call me Vamsi", "I am Vamsi", "i'm Vamsi"]) {
      expect(parseCommand(s)).toStrictEqual({ kind: "name", name: "Vamsi" });
    }
  });

  it("drops a trailing full stop", () => {
    expect(parseCommand("my name is Vamsi.")).toStrictEqual({ kind: "name", name: "Vamsi" });
  });

  it("is not fooled by a sentence that merely starts that way", () => {
    // "I am going to the shop" is conversation, not a registration.
    expect(parseCommand("I am going to the shop to buy milk today")).toBeNull();
  });
});

describe("actions", () => {
  it("maps words onto states the rig already has", () => {
    expect(parseCommand("dance")).toMatchObject({ kind: "act", state: "wiggle" });
    expect(parseCommand("sleep")).toMatchObject({ kind: "act", state: "sleep" });
    expect(parseCommand("sit")).toMatchObject({ kind: "act", state: "sit" });
  });

  it("prefers the longer phrase", () => {
    expect(parseCommand("wake up")).toMatchObject({ state: "wake" });
  });

  it("allows the polite forms", () => {
    expect(parseCommand("can you dance")).toMatchObject({ state: "wiggle" });
    expect(parseCommand("please sleep")).toMatchObject({ state: "sleep" });
    expect(parseCommand("dance!")).toMatchObject({ state: "wiggle" });
  });

  it("does not act on a sentence that merely mentions the word", () => {
    // The whole reason the match is anchored.
    expect(parseCommand("I couldn't sleep last night")).toBeNull();
    expect(parseCommand("do you like to dance with people")).toBeNull();
  });
});

describe("listing", () => {
  it("recognises asking what is scheduled", () => {
    expect(parseCommand("what reminders do I have")).toStrictEqual({ kind: "list" });
    expect(parseCommand("reminders?")).toStrictEqual({ kind: "list" });
  });
});

describe("everything else", () => {
  it("falls through to the AI", () => {
    expect(parseCommand("what should I work on today?")).toBeNull();
    expect(parseCommand("")).toBeNull();
  });
});

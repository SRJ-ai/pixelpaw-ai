/**
 * Things you can just say to the pet, handled without an AI.
 *
 * Reminders already existed as data with a working scheduler, but the only way
 * to add one was Settings → Reminders → Add → fill three fields. Nobody sets a
 * reminder that way while they are in the middle of something, so the feature
 * went unused. Typing "remind me at 5pm to call mum" is the interaction people
 * actually want.
 *
 * Handled locally on purpose, ahead of the AI call. The AI is off by default and
 * needs a key or a CLI, so routing these through it would mean the most useful
 * thing in the chat window only worked for people who had already configured
 * something else. It also costs nothing and cannot hallucinate a time.
 */
import type { AnimState } from "@/types/pet";
import type { Recurrence } from "@/config/settings";

export type Command =
  | { kind: "reminder"; title: string; time: string; recurrence: Recurrence }
  | { kind: "name"; name: string }
  | { kind: "act"; state: AnimState; word: string }
  | { kind: "list" };

/**
 * Words that make the pet do something, mapped onto states the rig already has.
 *
 * "dance" is `wiggle` rather than a new animation: the rig wiggles its whole
 * body already, which reads as dancing, and a bespoke dance state would be a
 * new keyframe set for one word.
 */
const ACTS: Record<string, AnimState> = {
  dance: "wiggle",
  wiggle: "wiggle",
  sleep: "sleep",
  nap: "sleep",
  "wake up": "wake",
  wake: "wake",
  sit: "sit",
  stretch: "stretch",
  yawn: "yawn",
  spin: "dizzy",
  jump: "happy",
  happy: "happy",
  smile: "happy",
  purr: "purring",
  groom: "groom",
  clean: "groom",
};

/**
 * "5pm", "5:30 pm", "17:00", "9", "9:05am" → "HH:MM" on a 24-hour clock.
 * Returns null for anything it cannot read, so a sentence that merely contains
 * a number does not become a reminder at a wrong time.
 */
export function parseTime(raw: string): string | null {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const suffix = m[3];
  if (min > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "pm" && hour !== 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "every day" / "weekdays" / nothing → a recurrence, and the text without it. */
function takeRecurrence(text: string): { recurrence: Recurrence; rest: string } {
  const patterns: [RegExp, Recurrence][] = [
    [/\b(every ?day|daily|each day)\b/i, "daily"],
    [/\b(weekdays|every weekday|work ?days)\b/i, "weekdays"],
  ];
  for (const [re, recurrence] of patterns) {
    if (re.test(text)) return { recurrence, rest: text.replace(re, " ").trim() };
  }
  return { recurrence: "once", rest: text };
}

/** Trim the filler people leave on the front of a reminder's subject. */
function cleanTitle(s: string): string {
  return s
    .replace(/^(to|that|about|for)\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCommand(input: string): Command | null {
  const text = input.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  // "my name is X" / "call me X" / "i am X"
  const name = text.match(/^(?:my name is|call me|i am|i'm|im)\s+(.{1,24}?)[.!]?$/i);
  if (name) return { kind: "name", name: name[1].trim() };

  if (/^(what|list|show)\b.*\breminders?\b/i.test(lower) || /^reminders\??$/i.test(lower)) {
    return { kind: "list" };
  }

  // "remind me at 5pm to call mum", "remind me to call mum at 5pm every day"
  if (/\bremind\b/i.test(lower)) {
    const { recurrence, rest } = takeRecurrence(text);
    // Take the last "at <time>" so "remind me at work at 5pm" still lands on 5pm.
    const times = [...rest.matchAll(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi)];
    const hit = times[times.length - 1];
    if (!hit) return null;
    const time = parseTime(hit[1]);
    if (!time) return null;
    const title = cleanTitle(
      rest
        .replace(hit[0], " ")
        .replace(/^\s*remind(?:\s+me)?\s*/i, "")
        .trim()
    );
    return { kind: "reminder", title: title || "Reminder", time, recurrence };
  }

  // Bare action words, longest first so "wake up" beats "wake".
  const words = Object.keys(ACTS).sort((a, b) => b.length - a.length);
  for (const word of words) {
    // Anchored: a sentence merely mentioning sleep should not put the pet to
    // sleep. "dance!" and "now dance" count; "I couldn't sleep last night"
    // does not.
    if (new RegExp(`^(?:can you |please |now )?${word}[!.]?$`, "i").test(lower)) {
      return { kind: "act", state: ACTS[word], word };
    }
  }

  return null;
}

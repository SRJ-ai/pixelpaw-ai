import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_VERSION, huntSpeedFrom, overheatRateFrom } from "./settings";

const KEY = "pixelpaw.settings.v1";

describe("settings", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("survives corrupt storage", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadSettings().petName).toBe(DEFAULT_SETTINGS.petName);
  });

  it("fills in fields missing from older saves", () => {
    localStorage.setItem(KEY, JSON.stringify({ version: SETTINGS_VERSION, petName: "Luna" }));
    const s = loadSettings();
    expect(s.petName).toBe("Luna");
    expect(s.interactions.gaze).toBe(DEFAULT_SETTINGS.interactions.gaze);
    expect(s.productivity.waterIntervalMin).toBe(DEFAULT_SETTINGS.productivity.waterIntervalMin);
  });

  it("keeps a user's scale once they're on the current version", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: SETTINGS_VERSION, general: { scale: 1.2 } })
    );
    expect(loadSettings().general.scale).toBe(1.2);
  });

  it("migrates the scale forward from an older version", () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, general: { scale: 1.0 } }));
    expect(loadSettings().general.scale).toBe(DEFAULT_SETTINGS.general.scale);
  });

  it("preserves other customizations while migrating", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, characterId: "samurai", general: { opacity: 0.5 } })
    );
    const s = loadSettings();
    expect(s.characterId).toBe("samurai");
    expect(s.general.opacity).toBe(0.5);
  });

  it("maps sensitivity so higher = easier to trigger", () => {
    expect(huntSpeedFrom(1)).toBeLessThan(huntSpeedFrom(0));
    expect(overheatRateFrom(1)).toBeLessThan(overheatRateFrom(0));
  });

  it("clamps out-of-range sensitivities", () => {
    expect(huntSpeedFrom(5)).toBe(huntSpeedFrom(1));
    expect(overheatRateFrom(-3)).toBe(overheatRateFrom(0));
  });
});

describe("mergeSettings", () => {
  it("fills a field the sending window never heard of", async () => {
    const { mergeSettings, DEFAULT_SETTINGS } = await import("./settings");
    // Exactly the broadcast that crashed the pet: a general block from an
    // older build, with no pinnedNote in it.
    const fromOlderWindow = {
      general: { scale: 0.8, opacity: 1, alwaysOnTop: true },
    } as never;
    const merged = mergeSettings(fromOlderWindow);
    expect(merged.general.pinnedNote).toBe("");
    expect(typeof merged.general.pinnedNote).toBe("string");
    // The field it did send still wins.
    expect(merged.general.scale).toBe(0.8);
    // And unrelated blocks are whole, not undefined.
    expect(merged.ai).toEqual(DEFAULT_SETTINGS.ai);
    expect(merged.productivity).toEqual(DEFAULT_SETTINGS.productivity);
  });

  it("survives an empty payload rather than throwing", async () => {
    const { mergeSettings, DEFAULT_SETTINGS } = await import("./settings");
    const merged = mergeSettings({});
    expect(merged.general).toEqual(DEFAULT_SETTINGS.general);
    expect(merged.reminders).toEqual([]);
  });

  it("every string field the pet renders is a string, never undefined", async () => {
    const { mergeSettings } = await import("./settings");
    const m = mergeSettings({} as never);
    // These are the ones read with .trim() or passed to the DOM during render.
    for (const v of [m.general.pinnedNote, m.petName, m.characterId, m.ai.userName]) {
      expect(typeof v).toBe("string");
    }
  });
});

describe("the version migration", () => {
  it("runs on load, where a stored document really can be old", async () => {
    const { mergeSettings, DEFAULT_SETTINGS } = await import("./settings");
    const old = { version: 1, general: { scale: 0.8 } } as never;
    expect(mergeSettings(old, true).general.scale).toBe(DEFAULT_SETTINGS.general.scale);
  });

  it("does not run on a broadcast, so a live scale is never reset", async () => {
    const { mergeSettings } = await import("./settings");
    // A payload without `version` must not be mistaken for an old document.
    const broadcast = { general: { scale: 0.8 } } as never;
    expect(mergeSettings(broadcast).general.scale).toBe(0.8);
  });
});

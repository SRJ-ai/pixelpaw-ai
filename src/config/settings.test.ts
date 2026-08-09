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

import { afterEach, describe, expect, it } from "vitest";
import { getUiLang, setUiLang, t, UI_LANGUAGES } from "./i18n";
import { formatInterval, INTERVAL_PRESETS, POMODORO_PRESETS } from "./settings";

afterEach(() => setUiLang("en"));

describe("formatInterval", () => {
  it("reads minutes below the hour", () => {
    expect(formatInterval(15)).toBe("15 min");
    expect(formatInterval(59)).toBe("59 min");
  });

  it("collapses whole hours", () => {
    expect(formatInterval(60)).toBe("1 h");
    expect(formatInterval(120)).toBe("2 h");
  });

  it("splits hours and minutes", () => {
    expect(formatInterval(90)).toBe("1 h 30 m");
    expect(formatInterval(155)).toBe("2 h 35 m");
  });

  it("renders every shipped preset without a stray zero", () => {
    for (const m of INTERVAL_PRESETS) {
      expect(formatInterval(m)).not.toMatch(/\b0 m\b/);
    }
  });
});

describe("presets", () => {
  it("labels each Pomodoro preset as focus / break", () => {
    for (const p of POMODORO_PRESETS) {
      expect(p.label).toBe(`${p.focus} / ${p.brk}`);
    }
  });

  it("keeps every break shorter than its focus block", () => {
    for (const p of POMODORO_PRESETS) {
      expect(p.brk).toBeLessThan(p.focus);
    }
  });
});

describe("t", () => {
  it("defaults to English", () => {
    expect(getUiLang()).toBe("en");
    expect(t("chat.send")).toBe("Send");
  });

  it("switches language for every later lookup", () => {
    setUiLang("te");
    expect(t("chat.send")).toBe("పంపు");
  });

  it("substitutes named placeholders", () => {
    expect(t("chat.sayHello", { name: "Pixel" })).toBe("Say hello to Pixel 🐾");
    expect(t("games.solved", { moves: 12 })).toBe("Solved in 12 moves! 🎉");
  });

  it("substitutes placeholders in Telugu too, where word order differs", () => {
    setUiLang("te");
    expect(t("chat.sayHello", { name: "Pixel" })).toContain("Pixel");
    expect(t("games.solved", { moves: 12 })).toContain("12");
  });

  it("leaves an unknown placeholder alone rather than printing undefined", () => {
    expect(t("chat.sayHello", { nope: "x" })).toContain("{name}");
  });

  it("offers a translation for every advertised language", () => {
    for (const lang of UI_LANGUAGES) {
      setUiLang(lang.id);
      expect(t("set.tab.pet").length).toBeGreaterThan(0);
    }
  });
});

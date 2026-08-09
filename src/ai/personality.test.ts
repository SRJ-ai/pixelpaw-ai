import { describe, expect, it } from "vitest";
import { systemPrompt, PERSONALITIES, LANGUAGES } from "./personality";

describe("systemPrompt", () => {
  const base = {
    petName: "Pixel",
    personality: "playful" as const,
    language: "en" as const,
    memory: "",
  };

  it("names the pet", () => {
    expect(systemPrompt(base)).toContain("Pixel");
  });

  it("reflects the chosen personality", () => {
    const p = systemPrompt({ ...base, personality: "nerdy" });
    expect(p).toContain("Nerdy");
  });

  it("asks for Telugu when selected", () => {
    expect(systemPrompt({ ...base, language: "te" })).toContain("Telugu");
  });

  it("supports a Telugu/English mix", () => {
    const p = systemPrompt({ ...base, language: "te_en" });
    expect(p).toContain("Telugu");
    expect(p).toContain("English");
  });

  it("includes the user's name only when given", () => {
    expect(systemPrompt(base)).not.toContain("The user's name");
    expect(systemPrompt({ ...base, userName: "Sree" })).toContain("Sree");
  });

  it("includes memories when present", () => {
    const p = systemPrompt({ ...base, memory: "Goals: ship PixelPaw" });
    expect(p).toContain("ship PixelPaw");
  });

  it("covers every personality and language without throwing", () => {
    for (const per of PERSONALITIES) {
      for (const lang of LANGUAGES) {
        const p = systemPrompt({ ...base, personality: per.id, language: lang.id });
        expect(p.length).toBeGreaterThan(0);
      }
    }
  });
});

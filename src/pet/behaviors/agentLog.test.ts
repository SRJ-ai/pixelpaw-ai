import { beforeEach, describe, expect, it } from "vitest";
import { describeAge, readAgentContact, recordAgentContact } from "./agentLog";

beforeEach(() => localStorage.clear());

describe("agent contact log", () => {
  it("reports nothing before an agent has ever called", () => {
    expect(readAgentContact()).toBeNull();
  });

  it("keeps who called and what they said", () => {
    recordAgentContact("claude-code · pixelpaw-ai", "waiting");
    const c = readAgentContact();
    expect(c?.who).toBe("claude-code · pixelpaw-ai");
    expect(c?.status).toBe("waiting");
    expect(c?.at).toBeGreaterThan(0);
  });

  it("keeps only the most recent", () => {
    recordAgentContact("codex", "working");
    recordAgentContact("claude-code", "success");
    expect(readAgentContact()?.who).toBe("claude-code");
  });

  it("survives a corrupt record", () => {
    localStorage.setItem("pixelpaw.agent.last", "not json");
    expect(readAgentContact()).toBeNull();
  });
});

describe("describeAge", () => {
  const now = 1_700_000_000_000;

  it("calls anything under a minute 'just now'", () => {
    expect(describeAge(now - 1_000, now)).toBe("just now");
    expect(describeAge(now - 59_000, now)).toBe("just now");
  });

  it("counts minutes and hours", () => {
    expect(describeAge(now - 60_000, now)).toBe("1 minute ago");
    expect(describeAge(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(describeAge(now - 60 * 60_000, now)).toBe("1 hour ago");
    expect(describeAge(now - 5 * 60 * 60_000, now)).toBe("5 hours ago");
  });

  it("falls back to days", () => {
    expect(describeAge(now - 48 * 60 * 60_000, now)).toBe("2 days ago");
  });

  it("never reads as the future when clocks disagree", () => {
    // A record written before a clock change can carry a timestamp ahead of
    // now; "in -3 minutes" would be worse than useless in a diagnostic.
    expect(describeAge(now + 90_000, now)).toBe("just now");
  });

  it("says singular once and plural after", () => {
    expect(describeAge(now - 60_000, now)).toContain("1 minute ");
    expect(describeAge(now - 120_000, now)).toContain("2 minutes ");
  });
});

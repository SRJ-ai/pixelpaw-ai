import { beforeEach, describe, expect, it } from "vitest";
import { clearCrash, readCrash, recordCrash } from "./crashLog";

beforeEach(() => {
  localStorage.clear();
});

describe("crash log", () => {
  it("has nothing to report before anything breaks", () => {
    expect(readCrash()).toBeNull();
  });

  it("keeps the message and the window it came from", () => {
    recordCrash(new Error("pinnedNote is undefined"));
    const got = readCrash();
    expect(got?.message).toBe("pinnedNote is undefined");
    // The pet window is the one with no console, which is the whole reason
    // this exists — an unrouted bundle is the pet.
    expect(got?.where).toBe("pet");
    expect(got?.at).toBeGreaterThan(0);
  });

  it("records a throw that was never an Error", () => {
    recordCrash("boom");
    expect(readCrash()?.message).toBe("boom");
  });

  it("keeps only the most recent failure", () => {
    recordCrash(new Error("first"));
    recordCrash(new Error("second"));
    expect(readCrash()?.message).toBe("second");
  });

  it("caps the stack so one crash cannot fill storage", () => {
    const err = new Error("deep");
    err.stack = "x".repeat(9000);
    recordCrash(err);
    expect(readCrash()!.stack!.length).toBeLessThanOrEqual(2001);
  });

  it("clears", () => {
    recordCrash(new Error("gone soon"));
    clearCrash();
    expect(readCrash()).toBeNull();
  });

  it("survives a corrupted record rather than throwing on read", () => {
    localStorage.setItem("pixelpaw.lastCrash", "{not json");
    expect(readCrash()).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { homePosition, isReachable, MIN_VISIBLE_PX, overlap, type Box } from "./placement";

/** A 1920x1080 primary at the origin, and a second screen to its left. */
const PRIMARY: Box = { x: 0, y: 0, w: 1920, h: 1080 };
const LEFT: Box = { x: -1920, y: 0, w: 1920, h: 1080 };
const PET = { w: 300, h: 300 };

const at = (x: number, y: number): Box => ({ x, y, ...PET });

describe("overlap", () => {
  it("is the whole window when fully on screen", () => {
    expect(overlap(at(100, 100), PRIMARY)).toStrictEqual({ w: 300, h: 300 });
  });

  it("clips at an edge", () => {
    expect(overlap(at(1800, 100), PRIMARY)).toStrictEqual({ w: 120, h: 300 });
  });

  it("is zero on both axes when the window shares neither", () => {
    expect(overlap(at(-3000, -3000), PRIMARY)).toStrictEqual({ w: 0, h: 0 });
  });

  it("reports the axis that still overlaps when only one is off", () => {
    // A window on a monitor to the left is horizontally elsewhere but shares
    // the vertical span, so only `w` collapses. Reachability turns on either
    // axis being too thin, which is what makes this worth stating.
    expect(overlap(at(-3000, 0), PRIMARY)).toStrictEqual({ w: 0, h: 300 });
    expect(isReachable(at(-3000, 0), [PRIMARY])).toBe(false);
  });

  it("never reports negative overlap", () => {
    const o = overlap(at(5000, 5000), PRIMARY);
    expect(o.w).toBeGreaterThanOrEqual(0);
    expect(o.h).toBeGreaterThanOrEqual(0);
  });
});

describe("isReachable", () => {
  it("accepts a pet sitting well inside a screen", () => {
    expect(isReachable(at(800, 400), [PRIMARY])).toBe(true);
  });

  it("rejects a position on a monitor that is no longer connected", () => {
    // The bug this exists for: the pet was left on a second screen, the screen
    // went away, and the saved position now points into nothing.
    expect(isReachable(at(-1500, 300), [PRIMARY])).toBe(false);
  });

  it("accepts that same position once the monitor is back", () => {
    expect(isReachable(at(-1500, 300), [PRIMARY, LEFT])).toBe(true);
  });

  it("accepts a pet hanging off an edge while still grabbable", () => {
    expect(isReachable(at(1920 - MIN_VISIBLE_PX - 1, 500), [PRIMARY])).toBe(true);
  });

  it("rejects a sliver too thin to put a cursor on", () => {
    expect(isReachable(at(1920 - 4, 500), [PRIMARY])).toBe(false);
    expect(isReachable(at(500, 1080 - 4), [PRIMARY])).toBe(false);
  });

  it("does not add two unreachable slivers into one reachable pet", () => {
    // Straddling the seam between two screens with a few pixels on each: the
    // area sums to plenty, and it is still impossible to grab.
    const seam: Box[] = [
      { x: 0, y: 0, w: 1000, h: 1080 },
      { x: 1300, y: 0, w: 1000, h: 1080 },
    ];
    expect(isReachable({ x: 996, y: 500, w: 308, h: 300 }, seam)).toBe(false);
  });

  it("rejects everything when no screens are reported at all", () => {
    expect(isReachable(at(100, 100), [])).toBe(false);
  });
});

describe("homePosition", () => {
  it("sits inside the bottom-right of the screen", () => {
    const p = homePosition(PRIMARY, PET);
    expect(p.x + PET.w).toBeLessThanOrEqual(PRIMARY.w);
    expect(p.y + PET.h).toBeLessThanOrEqual(PRIMARY.h);
    expect(isReachable({ ...p, ...PET }, [PRIMARY])).toBe(true);
  });

  it("clears the taskbar rather than sitting under it", () => {
    expect(homePosition(PRIMARY, PET).y + PET.h).toBeLessThan(PRIMARY.h - 40);
  });

  it("scales its margins with the display, so the gap looks the same", () => {
    const at1x = homePosition(PRIMARY, PET, 1);
    const at2x = homePosition(PRIMARY, PET, 2);
    // Twice the scaling means twice the physical pixels of clearance.
    expect(PRIMARY.h - (at2x.y + PET.h)).toBe((PRIMARY.h - (at1x.y + PET.h)) * 2);
  });

  it("lands on the right screen when that screen is not at the origin", () => {
    const p = homePosition(LEFT, PET);
    expect(isReachable({ ...p, ...PET }, [LEFT])).toBe(true);
    expect(isReachable({ ...p, ...PET }, [PRIMARY])).toBe(false);
  });
});

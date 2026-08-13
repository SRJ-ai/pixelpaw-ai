/**
 * Is the pet somewhere the user can actually see and grab it?
 *
 * The pet remembers where it was left, which is right until the screen it was
 * left on stops existing. Undock a laptop, unplug a second monitor, or change a
 * resolution, and the saved position can land the window entirely outside the
 * visible desktop. The window is transparent, frameless and skips the taskbar,
 * so there is nothing to see and nothing to click — and the two routes back
 * (the right-click menu, and a tray icon Windows files into the hidden overflow
 * flyout) both require finding the pet first. It is a dead end.
 *
 * So a restored position is checked before it is trusted. All measurements are
 * physical pixels, matching what the native layer reports, which is what makes
 * this DPI-safe: a fraction of a monitor means the same thing at 100% and 200%
 * scaling, where a pixel count would not.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * How much of the pet is on a given screen, as a width/height pair in pixels.
 * Zero on either axis means no overlap at all.
 */
export function overlap(win: Box, screen: Box): { w: number; h: number } {
  const w = Math.min(win.x + win.w, screen.x + screen.w) - Math.max(win.x, screen.x);
  const h = Math.min(win.y + win.h, screen.y + screen.h) - Math.max(win.y, screen.y);
  return { w: Math.max(0, w), h: Math.max(0, h) };
}

/**
 * Enough of the pet must be showing to see it and put a cursor on it. Measured
 * on both axes rather than by area, because a sliver down one edge has plenty
 * of area and is still impossible to grab.
 */
export const MIN_VISIBLE_PX = 48;

/**
 * Whether a window at this position can be reached on at least one of these
 * screens. A window straddling two monitors counts if either half alone is
 * enough — the overlap is never summed, because two unreachable slivers on
 * neighbouring screens do not add up to a grabbable pet.
 */
export function isReachable(win: Box, screens: Box[]): boolean {
  return screens.some((s) => {
    const o = overlap(win, s);
    return o.w >= MIN_VISIBLE_PX && o.h >= MIN_VISIBLE_PX;
  });
}

/** Bottom-right of a screen, clear of the taskbar. */
export function homePosition(screen: Box, win: { w: number; h: number }, scale = 1): { x: number; y: number } {
  // Scaled, because a taskbar is about 40 logical pixels tall whatever the
  // display does — as fixed physical pixels this margin lands under the taskbar
  // on a 200% screen and miles above it on a 100% one.
  const margin = Math.round(24 * scale);
  const taskbar = Math.round(48 * scale);
  return {
    x: screen.x + screen.w - win.w - margin,
    y: screen.y + screen.h - win.h - margin - taskbar,
  };
}

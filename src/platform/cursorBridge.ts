/**
 * Bridges the native `cursor:move` stream (emitted by src-tauri/src/cursor.rs)
 * into normalized samples the engine can use directly. Also relays the tray
 * pause/resume events. This is the *only* place that talks to the Tauri event
 * API for input, keeping the rest of the UI platform-agnostic.
 */
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface CursorSample {
  /** Absolute physical-pixel screen position. */
  x: number;
  y: number;
  left: boolean;
  /** Cursor relative to the pet window (physical px). */
  relX: number;
  relY: number;
  winW: number;
  winH: number;
  /** DPI-safe fractions across the window (0..1). */
  fracX: number;
  fracY: number;
  /** Derived window top-left (physical px). */
  winX: number;
  winY: number;
}

interface RawCursor {
  x: number;
  y: number;
  left: boolean;
  rel_x: number;
  rel_y: number;
  win_w: number;
  win_h: number;
}

export function subscribeCursor(cb: (s: CursorSample) => void): Promise<UnlistenFn> {
  return listen<RawCursor>("cursor:move", (e) => {
    const d = e.payload;
    const winW = d.win_w || 1;
    const winH = d.win_h || 1;
    cb({
      x: d.x,
      y: d.y,
      left: d.left,
      relX: d.rel_x,
      relY: d.rel_y,
      winW,
      winH,
      fracX: d.rel_x / winW,
      fracY: d.rel_y / winH,
      winX: d.x - d.rel_x,
      winY: d.y - d.rel_y,
    });
  });
}

export async function subscribeControl(
  onPause: () => void,
  onResume: () => void
): Promise<UnlistenFn[]> {
  const u1 = await listen("tray:pause", onPause);
  const u2 = await listen("tray:resume", onResume);
  return [u1, u2];
}

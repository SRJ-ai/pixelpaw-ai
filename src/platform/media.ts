/**
 * Media transport controls. These synthesize the standard OS media keys, so
 * they drive whichever player currently owns playback (Spotify, a browser tab,
 * a local player…). No app-specific integration or credentials required.
 */
import { invoke } from "@tauri-apps/api/core";

export type MediaAction =
  | "play_pause"
  | "next"
  | "prev"
  | "volume_up"
  | "volume_down"
  | "mute";

export async function mediaControl(action: MediaAction): Promise<void> {
  try {
    await invoke("media_control", { action });
  } catch (err) {
    console.error("[PixelPaw] media control failed", err);
  }
}

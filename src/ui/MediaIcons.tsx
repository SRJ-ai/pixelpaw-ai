/**
 * The app's transport icons, drawn once and shared by the pet's media pill and
 * the Settings music panel. They used to be emoji in Settings and paths in the
 * pill, which read as two different products; one set at one stroke weight is
 * the whole point.
 */
import type { MediaAction } from "@/platform/media";

const PATHS: Record<MediaAction, JSX.Element> = {
  prev: (
    <>
      <path d="M4 3.2h1.8v9.6H4z" />
      <path d="M13.4 3.4v9.2L6.6 8z" />
    </>
  ),
  play_pause: (
    <>
      <path d="M3 3.4v9.2L9.2 8z" />
      <path d="M11 3.4h1.5v9.2H11z" />
      <path d="M13.8 3.4h1.5v9.2h-1.5z" />
    </>
  ),
  next: (
    <>
      <path d="M11.2 3.2H13v9.6h-1.8z" />
      <path d="M2.6 3.4v9.2L9.4 8z" />
    </>
  ),
  volume_down: (
    <>
      <path d="M2.5 6.2h2.3L7.6 3.6v8.8L4.8 9.8H2.5z" />
      <path d="M9.6 6.1a2.6 2.6 0 0 1 0 3.8" fill="none" strokeWidth="1.3" />
    </>
  ),
  volume_up: (
    <>
      <path d="M2.5 6.2h2.3L7.6 3.6v8.8L4.8 9.8H2.5z" />
      <path d="M9.6 6.1a2.6 2.6 0 0 1 0 3.8" fill="none" strokeWidth="1.3" />
      <path d="M11.6 4.3a5.2 5.2 0 0 1 0 7.4" fill="none" strokeWidth="1.3" />
    </>
  ),
  mute: (
    <>
      <path d="M2.5 6.2h2.3L7.6 3.6v8.8L4.8 9.8H2.5z" />
      <path d="M10 6.2l3.4 3.6M13.4 6.2L10 9.8" fill="none" strokeWidth="1.4" />
    </>
  ),
};

/** Human-readable labels, kept next to the glyphs so they never drift apart. */
export const MEDIA_LABELS: Record<MediaAction, string> = {
  prev: "Previous track",
  play_pause: "Play / Pause",
  next: "Next track",
  volume_down: "Volume down",
  volume_up: "Volume up",
  mute: "Mute",
};

export const MEDIA_ORDER: MediaAction[] = [
  "prev",
  "play_pause",
  "next",
  "volume_down",
  "volume_up",
  "mute",
];

export function MediaIcon({ action, size = 13 }: { action: MediaAction; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ fill: "currentColor", stroke: "currentColor", display: "block" }}
    >
      {PATHS[action]}
    </svg>
  );
}

/**
 * A capsule that slides out above the pet's head while the cursor is on it,
 * giving transport control over whatever is currently playing (§40). The
 * buttons drive the OS media keys, so they work with any player.
 *
 * The pet window is click-through everywhere except the pet's silhouette, so
 * the pill reports its own box upward via `onBox`; the native hit-test adds
 * that rectangle while the pill is out, and drops it again when it retracts.
 */
import { useEffect, useRef } from "react";
import { mediaControl, type MediaAction } from "@/platform/media";

/** Layout box in fractions of the window, as the Rust hit-test wants it. */
export interface UiBox {
  l: number;
  t: number;
  r: number;
  b: number;
}

interface Props {
  open: boolean;
  /** Called with the pill's box while it is out, and `null` once it retracts. */
  onBox: (box: UiBox | null) => void;
  /** Keeps the pill out while the cursor is on it, not just on the cat. */
  onHoverChange: (hovering: boolean) => void;
  /** Any press should also extend the time the pill stays out. */
  onPress: () => void;
}

const ICONS: Record<string, JSX.Element> = {
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

const BUTTONS: { action: MediaAction; icon: keyof typeof ICONS; title: string }[] = [
  { action: "prev", icon: "prev", title: "Previous track" },
  { action: "play_pause", icon: "play_pause", title: "Play / Pause" },
  { action: "next", icon: "next", title: "Next track" },
  { action: "volume_down", icon: "volume_down", title: "Volume down" },
  { action: "volume_up", icon: "volume_up", title: "Volume up" },
  { action: "mute", icon: "mute", title: "Mute" },
];

export function MediaPill({ open, onBox, onHoverChange, onPress }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Report the layout box (offset*, not getBoundingClientRect) so the slide-in
  // transform doesn't make the hit region wobble while it animates.
  useEffect(() => {
    const el = ref.current;
    if (!el || !open) {
      onBox(null);
      return;
    }
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    onBox({
      l: el.offsetLeft / w,
      t: el.offsetTop / h,
      r: (el.offsetLeft + el.offsetWidth) / w,
      b: (el.offsetTop + el.offsetHeight) / h,
    });
  }, [open, onBox]);

  const button = (b: (typeof BUTTONS)[number], variant: "ghost" | "primary") => (
    <button
      key={b.action}
      type="button"
      className={"pp-pill-btn" + (variant === "primary" ? " primary" : "")}
      title={b.title}
      aria-label={b.title}
      tabIndex={open ? 0 : -1}
      onClick={() => {
        onPress();
        void mediaControl(b.action);
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {ICONS[b.icon]}
      </svg>
    </button>
  );

  // Transport and volume are different jobs, so they read as two clusters with
  // play/pause carrying the weight rather than six identical buttons in a row.
  const transport = BUTTONS.slice(0, 3);
  const volume = BUTTONS.slice(3);

  return (
    <div
      ref={ref}
      className={"pp-pill" + (open ? " show" : "")}
      aria-hidden={!open}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <span className="pp-pill-group">
        {transport.map((b) => button(b, b.action === "play_pause" ? "primary" : "ghost"))}
      </span>
      <span className="pp-pill-sep" aria-hidden="true" />
      <span className="pp-pill-group">{volume.map((b) => button(b, "ghost"))}</span>
    </div>
  );
}

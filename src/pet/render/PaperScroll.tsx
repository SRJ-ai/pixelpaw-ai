/**
 * The pet's announcements arrive on a scroll of paper that unrolls.
 *
 * Not decoration for its own sake — it is the hierarchy. The speech bubble
 * carries chatter: pokes, greetings, an agent starting work. Things that matter
 * whether or not you were looking — a reminder coming due, a focus block
 * ending, a session finishing — get the scroll instead, so the difference is
 * legible from the corner of your eye without reading a word.
 *
 * The unroll is one authored moment rather than a pile of effects: the sheet is
 * revealed by a `clip-path` opening downward while the rod travels the same
 * distance in the same time, so the paper looks like it is coming off the rod
 * rather than fading in behind it. That shared distance is the reason for the
 * measurement below; CSS has no way to know how tall a wrapped message is.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface Props {
  text: string | null;
  /** Honour the user's reduced-motion setting: show it, just don't roll it. */
  reducedMotion: boolean;
}

export function PaperScroll({ text, reducedMotion }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [roll, setRoll] = useState(0);
  // Hold the last message through the roll-up. Clearing it the moment `text`
  // goes null would collapse the sheet to nothing and the paper would roll away
  // empty. Written during render on purpose, so the DOM already has the new
  // text by the time the layout effect below measures it.
  const lastText = useRef("");
  if (text) lastText.current = text;
  // The sheet must be laid out at full height before the roll can start, so the
  // open class waits a frame. Without it the first message unrolls to a stale
  // height, or skips the animation entirely.
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!text) {
      setOpen(false);
      return;
    }
    const h = sheetRef.current?.offsetHeight ?? 0;
    setRoll(h);
  }, [text]);

  useEffect(() => {
    if (!text) return;
    const id = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(id);
  }, [text]);

  return (
    <div
      className={"pp-scroll" + (text && (open || reducedMotion) ? " show" : "")}
      style={{ "--roll": `${roll}px` } as React.CSSProperties}
      aria-live="polite"
      aria-hidden={!text}
    >
      <span className="pp-scroll-cap" aria-hidden="true" />
      <div className="pp-scroll-sheet" ref={sheetRef}>
        {lastText.current}
      </div>
      <span className="pp-scroll-rod" aria-hidden="true" />
    </div>
  );
}

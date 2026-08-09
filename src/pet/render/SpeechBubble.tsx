/**
 * Minimal speech bubble shown above the pet. The engine triggers it via its
 * `onSay` callback (e.g. the overheat gag); it's also the foundation for
 * reminders and AI replies in later phases.
 */
interface Props {
  text: string | null;
}

export function SpeechBubble({ text }: Props) {
  return (
    <div className={"pp-bubble" + (text ? " show" : "")} aria-live="polite">
      {text ?? ""}
    </div>
  );
}

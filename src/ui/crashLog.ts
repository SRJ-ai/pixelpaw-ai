/**
 * The last thing that went wrong, kept where it can be read back.
 *
 * The pet window has no console, no title bar and no scrollback. When a render
 * threw, all the user got was a small red marker on the wallpaper with no way
 * to find out what it meant — and by the time they asked, the message had gone.
 *
 * So every crash is written down: the boundary catches React render errors, and
 * `installCrashHandlers` catches the ones that happen outside a render (a
 * rejected promise from an event listener, a throw in a timer). Settings reads
 * the record back, and the pet's own marker shows the first line of it.
 */

const KEY = "pixelpaw.lastCrash";

export interface CrashRecord {
  /** Epoch ms, so it can be shown in the reader's own locale. */
  at: number;
  /** Which window: "pet", "settings", "chat", "games". */
  where: string;
  message: string;
  /** Truncated — enough to identify the site, not a full heap dump. */
  stack?: string;
}

/** Which window this bundle is running as. Mirrors the routing in main.tsx. */
function currentRoute(): string {
  return window.location.hash.replace(/^#\/?/, "") || "pet";
}

function clip(s: string | undefined, n: number): string | undefined {
  if (!s) return undefined;
  return s.length <= n ? s : s.slice(0, n) + "…";
}

export function recordCrash(error: unknown, extra?: string): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const record: CrashRecord = {
      at: Date.now(),
      where: currentRoute(),
      message: err.message || String(error),
      stack: clip([err.stack, extra].filter(Boolean).join("\n\n"), 2000),
    };
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage can be full or blocked. Losing the record is not worth throwing
    // a second error on top of the first.
  }
}

export function readCrash(): CrashRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CrashRecord>;
    if (typeof parsed?.message !== "string") return null;
    return {
      at: typeof parsed.at === "number" ? parsed.at : 0,
      where: typeof parsed.where === "string" ? parsed.where : "?",
      message: parsed.message,
      stack: typeof parsed.stack === "string" ? parsed.stack : undefined,
    };
  } catch {
    return null;
  }
}

export function clearCrash(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Catch what the error boundary cannot: throws from timers, event listeners and
 * unhandled promise rejections. These never unmount the tree, so the pet keeps
 * running and the user sees nothing — which is exactly why they are worth
 * recording. Returns a teardown so tests can unwind.
 */
export function installCrashHandlers(): () => void {
  const onError = (e: ErrorEvent) => recordCrash(e.error ?? e.message, `${e.filename}:${e.lineno}`);
  const onRejection = (e: PromiseRejectionEvent) => recordCrash(e.reason, "unhandled rejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

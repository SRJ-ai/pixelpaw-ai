/**
 * The fullscreen reminder overlay.
 *
 * Two jobs in one window, because they want opposite things.
 *
 * A water or break nudge is *information*: the screen flashes, a big pet does
 * the thing it is asking you to do, and it leaves on its own. It never takes a
 * click, so the window stays click-through and the desktop stays usable.
 *
 * A scheduled reminder is a *decision*: it waits, centred and modest, with Stop
 * and Snooze. That one takes clicks, so it is the only case that turns
 * click-through off.
 */
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PixelCat } from "@/pet/render/PixelCat";
import { characterById } from "@/config/characters";
import { loadSettings, saveSettings } from "@/config/settings";
import { inMinutes } from "@/pet/behaviors/reminders";
import { t } from "@/config/i18n";
import { playCue } from "@/platform/sound";

/** How long a nudge stays up before leaving by itself. */
const NUDGE_MS = 5200;
/** Snooze pushes a reminder this far out. */
const SNOOZE_MIN = 10;

type Kind = "water" | "break" | "reminder";

function params() {
  // "#alert?kind=water&title=..." — read from the hash rather than an event so
  // the values are present on first render.
  const q = window.location.hash.split("?")[1] ?? "";
  const p = new URLSearchParams(q);
  const kind = p.get("kind");
  return {
    kind: (kind === "water" || kind === "break" || kind === "reminder" ? kind : "reminder") as Kind,
    title: p.get("title") ?? "",
    id: p.get("id") ?? "",
  };
}

export default function Alert() {
  const [{ kind, title, id }] = useState(params);
  const [settings] = useState(() => loadSettings());
  const [leaving, setLeaving] = useState(false);
  const character = characterById(settings.characterId);
  const isNudge = kind !== "reminder";

  const dismiss = () => {
    setLeaving(true);
    // Let the fade finish before the window goes, or it vanishes mid-animation.
    window.setTimeout(() => void invoke("close_alert"), 260);
  };

  useEffect(() => {
    playCue(kind === "reminder" ? "nudge" : "chime");
    if (!isNudge) return;
    const id = window.setTimeout(dismiss, NUDGE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes the card. A modal you cannot dismiss from the keyboard is a
  // trap, and this one covers the whole screen.
  useEffect(() => {
    if (isNudge) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNudge]);

  const snooze = () => {
    const cur = loadSettings();
    const target = cur.reminders.find((r) => r.id === id);
    if (target) {
      // Re-arm rather than duplicate, and clear lastFired so today counts again.
      target.time = inMinutes(SNOOZE_MIN);
      target.enabled = true;
      delete target.lastFired;
    } else {
      cur.reminders.push({
        id: crypto.randomUUID(),
        title: title || t("pet.remindInTitle"),
        time: inMinutes(SNOOZE_MIN),
        recurrence: "once",
        enabled: true,
      });
    }
    void saveSettings(cur);
    dismiss();
  };

  /** Stop means "don't tell me again": a one-off is done, a repeat stays on. */
  const stop = () => {
    const cur = loadSettings();
    const target = cur.reminders.find((r) => r.id === id);
    if (target && target.recurrence === "once") {
      target.enabled = false;
      void saveSettings(cur);
    }
    dismiss();
  };

  // The overlay only takes clicks for the card. Set here rather than in Rust so
  // it follows the render: whatever is on screen decides.
  useEffect(() => {
    getCurrentWindow()
      .setIgnoreCursorEvents(isNudge)
      .catch(() => {});
  }, [isNudge]);

  return (
    <div className={"al-root" + (leaving ? " leaving" : "")}>
      {isNudge && <div className="al-flash" aria-hidden="true" />}

      {isNudge ? (
        <div className="al-nudge" role="alert">
          {/* Enlarged and centred, drinking. The animation is CSS on the shared
              rig, so every character does it — no per-character art. */}
          <div className={"al-pet " + kind}>
            <PixelCat
              appearance={settings.appearance}
              accessories={character.accessories}
              species={settings.appearance.species ?? character.species}
              shape={character.shape}
            />
            {kind === "water" && (
              <>
                <span className="al-bowl" aria-hidden="true" />
                <span className="al-drop d1" aria-hidden="true" />
                <span className="al-drop d2" aria-hidden="true" />
              </>
            )}
          </div>
          <p className="al-line">{title}</p>
        </div>
      ) : (
        <div className="al-card" role="alertdialog" aria-labelledby="al-title">
          <span className="al-card-pet" aria-hidden="true">
            <PixelCat
              appearance={settings.appearance}
              accessories={character.accessories}
              species={settings.appearance.species ?? character.species}
              shape={character.shape}
            />
          </span>
          <p className="al-card-kicker">{t("alert.reminder")}</p>
          <p className="al-card-title" id="al-title">
            {title}
          </p>
          <div className="al-actions">
            <button type="button" className="al-btn" onClick={snooze} autoFocus>
              {t("alert.snooze", { min: SNOOZE_MIN })}
            </button>
            <button type="button" className="al-btn primary" onClick={stop}>
              {t("alert.stop")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

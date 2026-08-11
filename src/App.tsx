import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { PixelCat } from "./pet/render/PixelCat";
import { MediaPill, type UiBox } from "./pet/render/MediaPill";
import { SpeechBubble } from "./pet/render/SpeechBubble";
import { BreakBurst } from "./pet/render/BreakBurst";
import { SamuraiEntrance } from "./pet/render/SamuraiEntrance";
import { PetEngine } from "./pet/engine";
import { bus } from "./events/eventBus";
import { loadSettings, onSettingsChanged, saveSettings, type Settings } from "./config/settings";
import { characterById } from "./config/characters";

/** How long the media pill lingers after the cursor leaves the pet. */
const PILL_LINGER_MS = 2200;

/** Apply the "general" settings that live on the DOM / window, not the engine. */
function applyGeneral(g: Settings["general"]) {
  const el = document.documentElement;
  el.style.setProperty("--pet-scale", String(g.scale));
  el.style.setProperty("--pet-opacity", String(g.opacity));
  document.body.classList.toggle("reduced-motion", g.reducedMotion);
  getCurrentWindow()
    .setAlwaysOnTop(g.alwaysOnTop)
    .catch(() => {});
  // Keep the native click-through hit box in step with the drawn size.
  emit("pet:scale", g.scale).catch(() => {});
}

/**
 * The pet window is almost nothing but the character (§73): a transparent stage
 * holding the SVG, a speech bubble, and the occasional break flourish. The
 * `PetEngine` owns the animation loop + interaction; settings apply live.
 */
export default function App() {
  const svgRef = useRef<SVGSVGElement>(null);
  const engineRef = useRef<PetEngine | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [say, setSay] = useState<string | null>(null);
  const [breaking, setBreaking] = useState(false);
  const [samurai, setSamurai] = useState(false);
  const [pillOpen, setPillOpen] = useState(false);
  const pillTimer = useRef<number | undefined>(undefined);
  const sayTimer = useRef<number | undefined>(undefined);
  const burstTimer = useRef<number | undefined>(undefined);
  const samTimer = useRef<number | undefined>(undefined);
  const prevCharacter = useRef<string>(settings.characterId);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const initial = loadSettings();
    applyGeneral(initial.general);

    const engine = new PetEngine(
      undefined,
      (text, ms) => {
        setSay(text);
        window.clearTimeout(sayTimer.current);
        sayTimer.current = window.setTimeout(() => setSay(null), ms);
      },
      () => {
        setBreaking(false);
        // restart the CSS animation cleanly on repeated triggers
        window.requestAnimationFrame(() => setBreaking(true));
        window.clearTimeout(burstTimer.current);
        burstTimer.current = window.setTimeout(() => setBreaking(false), 1400);
      },
      (id, dateKey) => {
        // Record the day it fired so a restart doesn't repeat it, and switch
        // off one-shots now that they've had their moment.
        const cur = loadSettings();
        const target = cur.reminders.find((r) => r.id === id);
        if (!target || !target.enabled) return;
        target.lastFired = dateKey;
        if (target.recurrence === "once") target.enabled = false;
        void saveSettings(cur);
      }
    );
    engineRef.current = engine;
    engine.attach(svg, initial).catch((err) => console.error("[PixelPaw] engine error", err));

    let unlisten: (() => void) | undefined;
    onSettingsChanged((next) => {
      setSettings(next);
      engine.setSettings(next);
      applyGeneral(next.general);
    }).then((u) => (unlisten = u));

    return () => {
      engine.detach();
      unlisten?.();
      window.clearTimeout(sayTimer.current);
      window.clearTimeout(burstTimer.current);
    };
  }, []);

  /**
   * Right-clicking the pet is the primary way to reach Settings, Chat and
   * Quit. Windows drops new tray icons into the hidden notification overflow,
   * so the tray menu alone leaves the app with no visible way out.
   */
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      invoke("open_pet_menu").catch((err) => console.error("[PixelPaw] menu", err));
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // Launching the app again surfaces the pet that's already running; say so,
  // otherwise a second click of the shortcut looks like it did nothing.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("app:second-instance", () => {
      setSay("I'm already here! Right-click me 🐾");
      window.clearTimeout(sayTimer.current);
      sayTimer.current = window.setTimeout(() => setSay(null), 4200);
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  /**
   * The media pill follows the cursor being on the pet. The window is
   * click-through off the silhouette, so hover comes from the engine's global
   * cursor stream rather than DOM events; it lingers briefly on the way out so
   * you can travel from the cat up to the buttons.
   */
  useEffect(() => {
    const hold = () => window.clearTimeout(pillTimer.current);
    const release = () => {
      hold();
      pillTimer.current = window.setTimeout(() => setPillOpen(false), PILL_LINGER_MS);
    };
    const offEnter = bus.on("mouse.enter", () => {
      hold();
      setPillOpen(true);
    });
    const offLeave = bus.on("mouse.leave", release);
    return () => {
      offEnter();
      offLeave();
      hold();
    };
  }, []);

  // Tell the native hit-test about the pill so its buttons are clickable —
  // without this the clicks fall straight through to the desktop.
  const onPillBox = useCallback((box: UiBox | null) => {
    emit("pet:uirect", box ?? { l: 0, t: 0, r: 0, b: 0 }).catch(() => {});
  }, []);

  const keepPillOpen = useCallback((hovering: boolean) => {
    window.clearTimeout(pillTimer.current);
    if (hovering) setPillOpen(true);
    else pillTimer.current = window.setTimeout(() => setPillOpen(false), PILL_LINGER_MS);
  }, []);

  const extendPill = useCallback(() => {
    window.clearTimeout(pillTimer.current);
    pillTimer.current = window.setTimeout(() => setPillOpen(false), PILL_LINGER_MS * 2);
  }, []);

  // Re-bind SVG parts whenever the character/skin/decor re-renders (nodes replaced).
  useEffect(() => {
    if (engineRef.current && svgRef.current) engineRef.current.rebind(svgRef.current);
  }, [settings.appearance, settings.characterId, settings.general.cosmicDecor]);

  // Switching *to* the samurai plays its entrance (§80).
  useEffect(() => {
    const changedToSamurai =
      settings.characterId === "samurai" && prevCharacter.current !== "samurai";
    prevCharacter.current = settings.characterId;
    if (!changedToSamurai || settings.general.reducedMotion) return;
    setSamurai(true);
    window.clearTimeout(samTimer.current);
    samTimer.current = window.setTimeout(() => setSamurai(false), 2600);
    return () => window.clearTimeout(samTimer.current);
  }, [settings.characterId, settings.general.reducedMotion]);

  const accessories = characterById(settings.characterId).accessories;

  return (
    <div className={"pet-stage" + (pillOpen ? " pill-open" : "")}>
      <SpeechBubble text={say} />
      <MediaPill open={pillOpen} onBox={onPillBox} onHoverChange={keepPillOpen} onPress={extendPill} />
      <PixelCat ref={svgRef} appearance={settings.appearance} accessories={accessories} decor={settings.general.cosmicDecor} />
      <BreakBurst active={breaking} />
      <SamuraiEntrance active={samurai} caption="ఏం చేద్దాం బాస్?" />
    </div>
  );
}

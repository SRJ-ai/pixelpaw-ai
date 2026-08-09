import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { PixelCat } from "./pet/render/PixelCat";
import { SpeechBubble } from "./pet/render/SpeechBubble";
import { BreakBurst } from "./pet/render/BreakBurst";
import { SamuraiEntrance } from "./pet/render/SamuraiEntrance";
import { PetEngine } from "./pet/engine";
import { loadSettings, onSettingsChanged, saveSettings, type Settings } from "./config/settings";
import { characterById } from "./config/characters";

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
      (id) => {
        // A one-shot reminder has fired — switch it off and persist.
        const cur = loadSettings();
        const target = cur.reminders.find((r) => r.id === id);
        if (!target || !target.enabled) return;
        target.enabled = false;
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
    <div className="pet-stage">
      <SpeechBubble text={say} />
      <PixelCat ref={svgRef} appearance={settings.appearance} accessories={accessories} decor={settings.general.cosmicDecor} />
      <BreakBurst active={breaking} />
      <SamuraiEntrance active={samurai} caption="ఏం చేద్దాం బాస్?" />
    </div>
  );
}

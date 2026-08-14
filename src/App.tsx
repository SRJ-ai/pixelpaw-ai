import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { subscribeSchedule, subscribeUpdate } from "./platform/inputBridge";
import { inMinutes } from "./pet/behaviors/reminders";
import { loadOnboarding, markSeen, planOnboarding } from "./pet/behaviors/onboarding";
import { invoke } from "@tauri-apps/api/core";
import { PixelCat } from "./pet/render/PixelCat";
import { MediaPill, type UiBox } from "./pet/render/MediaPill";
import { AttentionBadge, FocusChip, PinnedNote, PomodoroTimer } from "./pet/render/PetOverlays";
import { PaperScroll } from "./pet/render/PaperScroll";
import { SpeechBubble } from "./pet/render/SpeechBubble";
import { BreakBurst } from "./pet/render/BreakBurst";
import { SamuraiEntrance } from "./pet/render/SamuraiEntrance";
import { PetEngine, type SayTone } from "./pet/engine";
import { bus } from "./events/eventBus";
import { playCue, setSound } from "./platform/sound";
import { t } from "./config/i18n";
import {
  formatInterval,
  loadSettings,
  onSettingsChanged,
  saveSettings,
  type Settings,
} from "./config/settings";
import { characterById } from "./config/characters";

/** How long the media pill lingers after the cursor leaves the pet. */
const PILL_LINGER_MS = 2200;

/** Apply the "general" settings that live on the DOM / window, not the engine. */
function applyGeneral(g: Settings["general"]) {
  const el = document.documentElement;
  el.style.setProperty("--pet-scale", String(g.scale));
  el.style.setProperty("--pet-opacity", String(g.opacity));
  document.body.classList.toggle("reduced-motion", g.reducedMotion);
  setSound(g.sound, g.volume);
  getCurrentWindow()
    .setAlwaysOnTop(g.alwaysOnTop)
    .catch(() => {});
  // Keep the native click-through hit box in step with the drawn size.
  emit("pet:scale", g.scale).catch(() => {});
  // The focus watcher runs on its own thread and can't read settings.
  emit("pet:dock", g.dockToAgent).catch(() => {});
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
  /** One line at a time, plus how it should be shown (bubble or scroll). */
  const [say, setSay] = useState<{ text: string; tone: SayTone } | null>(null);
  const [breaking, setBreaking] = useState(false);
  const [samurai, setSamurai] = useState(false);
  const [pillOpen, setPillOpen] = useState(false);
  const [pomo, setPomo] = useState({ active: false, phase: "focus" as "focus" | "break", remainingMs: 0 });
  /** Which agent is blocked on the user. Held until cleared, never on a timer. */
  const [waitingOn, setWaitingOn] = useState("");
  /** Quiet mode. Shown, or the toggle has no visible effect until a nudge
   *  fails to arrive — which is indistinguishable from it not working. */
  const [focus, setFocus] = useState(false);
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
      (status) => {
        setPomo(status.pomo);
        setWaitingOn(status.waitingOn);
        setFocus(status.focus);
      },
      (text, ms, tone = "chat") => {
        setSay({ text, tone });
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

  /**
   * Schedules set from the pet's own right-click menu.
   *
   * These write straight to stored settings and broadcast, which is the same
   * path the Settings window uses — so a change made here shows up there, and
   * the live pet picks it up without a restart.
   */
  useEffect(() => {
    let unlisten: UnlistenFn[] = [];
    const announce = (text: string) => {
      setSay({ text, tone: "notice" });
      playCue("nudge");
      window.clearTimeout(sayTimer.current);
      sayTimer.current = window.setTimeout(() => setSay(null), 3200);
    };
    const setInterval_ = (key: "break" | "water", minutes: number) => {
      const next = loadSettings();
      if (key === "break") {
        next.productivity.breakEnabled = minutes > 0;
        if (minutes > 0) next.productivity.breakIntervalMin = minutes;
      } else {
        next.productivity.waterEnabled = minutes > 0;
        if (minutes > 0) next.productivity.waterIntervalMin = minutes;
      }
      void saveSettings(next);
      announce(
        minutes === 0
          ? t(key === "break" ? "pet.breakOff" : "pet.waterOff")
          : t(key === "break" ? "pet.breakEvery" : "pet.waterEvery", {
              every: formatInterval(minutes),
            })
      );
    };
    subscribeSchedule(
      (m) => setInterval_("break", m),
      (m) => setInterval_("water", m),
      (m) => {
        const next = loadSettings();
        const time = inMinutes(m);
        next.reminders.push({
          id: crypto.randomUUID(),
          title: t("pet.remindInTitle"),
          time,
          recurrence: "once",
          enabled: true,
        });
        void saveSettings(next);
        announce(t("pet.remindIn", { every: formatInterval(m), time }));
      }
    ).then((u) => (unlisten = u));
    return () => unlisten.forEach((u) => u());
  }, []);

  /**
   * The first run. Everything this app does is behind a right-click that
   * nothing announces, and the tray icon Windows hides in the overflow flyout
   * is the only other route — so the pet says it, once, and then never again.
   */
  useEffect(() => {
    const timers: number[] = [];
    const state = loadOnboarding();
    if (state.intro && state.agent) return;

    invoke<{ id: string; name: string; found: boolean }[]>("detect_agents")
      .catch(() => [])
      .then((agents) => {
        const agent = (agents ?? []).find((a) => a.found);
        for (const step of planOnboarding(state, Boolean(agent))) {
          timers.push(
            window.setTimeout(() => {
              const text =
                step.step === "intro"
                  ? t("pet.welcome", { name: loadSettings().petName })
                  : t("pet.welcomeAgent", { agent: agent?.name ?? "your agent" });
              setSay({ text, tone: "notice" });
              playCue("chirp");
              markSeen(step.step);
              window.clearTimeout(sayTimer.current);
              sayTimer.current = window.setTimeout(() => setSay(null), step.hold);
            }, step.at)
          );
        }
      });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  /**
   * A new version exists. Rust found it, downloads it and installs it; all the
   * pet does is mention it — otherwise the menu item announcing an update is
   * something you'd only see by going looking for it.
   */
  useEffect(() => {
    let unlisten: UnlistenFn[] = [];
    const announce = (text: string, ms: number, cue: Parameters<typeof playCue>[0]) => {
      setSay({ text, tone: "notice" });
      playCue(cue);
      window.clearTimeout(sayTimer.current);
      sayTimer.current = window.setTimeout(() => setSay(null), ms);
    };
    subscribeUpdate(
      (v) => announce(t("pet.updateReady", { v }), 6000, "chime"),
      () => announce(t("pet.updateNone"), 2600, "pop"),
      () => announce(t("pet.updateFailed"), 4000, "error")
    ).then((u) => (unlisten = u));
    return () => unlisten.forEach((u) => u());
  }, []);

  // Launching the app again surfaces the pet that's already running; say so,
  // otherwise a second click of the shortcut looks like it did nothing.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("app:second-instance", () => {
      setSay({ text: "I'm already here! Right-click me 🐾", tone: "chat" });
      playCue("chirp");
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
    const changed = prevCharacter.current !== settings.characterId;
    prevCharacter.current = settings.characterId;
    // Each character introduces itself in its own voice. Cheap, and it makes
    // switching feel like meeting someone rather than repainting a sprite.
    const line = characterById(settings.characterId).line;
    if (changed && line) {
      setSay({ text: line, tone: "chat" });
      playCue("chirp");
      window.clearTimeout(sayTimer.current);
      sayTimer.current = window.setTimeout(() => setSay(null), 3600);
    }
    if (!changedToSamurai || settings.general.reducedMotion) return;
    setSamurai(true);
    window.clearTimeout(samTimer.current);
    samTimer.current = window.setTimeout(() => setSamurai(false), 2600);
    return () => window.clearTimeout(samTimer.current);
  }, [settings.characterId, settings.general.reducedMotion]);

  const character = characterById(settings.characterId);

  return (
    <div
      className={
        "pet-stage" +
        (pillOpen ? " pill-open" : "") +
        // The badge stays put while a bubble or scroll passes through, so it
        // has to know when to step aside.
        (say ? " say-open" : "") +
        (settings.general.pinnedNote.trim() ? " pin-open" : "")
      }
    >
      <PinnedNote text={settings.general.pinnedNote} />
      <AttentionBadge who={t("pet.needsYou", { who: waitingOn })} active={Boolean(waitingOn)} />
      {/* Only when a Pomodoro isn't already showing its own countdown there —
          the Pomodoro implies focus, so showing both would say it twice. */}
      <FocusChip active={focus && !pomo.active} label={t("pet.focusChip")} />
      <PomodoroTimer
        active={pomo.active}
        phase={pomo.phase}
        remainingMs={pomo.remainingMs}
        label={t(pomo.phase === "focus" ? "pet.timerFocus" : "pet.timerBreak")}
      />
      {/* One line at a time, so these never collide: chatter gets the bubble,
          anything worth noticing unrolls on paper. */}
      <SpeechBubble text={say?.tone === "chat" ? say.text : null} />
      <PaperScroll
        text={say?.tone === "notice" ? say.text : null}
        reducedMotion={settings.general.reducedMotion}
      />
      <MediaPill open={pillOpen} onBox={onPillBox} onHoverChange={keepPillOpen} onPress={extendPill} />
      <PixelCat
        ref={svgRef}
        appearance={settings.appearance}
        accessories={character.accessories}
        species={settings.appearance.species ?? character.species} shape={character.shape}
        decor={settings.general.cosmicDecor}
      />
      <BreakBurst active={breaking} />
      <SamuraiEntrance active={samurai} caption="ఏం చేద్దాం బాస్?" />
    </div>
  );
}

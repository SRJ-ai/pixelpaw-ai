/**
 * User settings + persistence (§58). Stored in localStorage (per-origin, survives
 * restart) and broadcast across windows via a Tauri `settings:changed` event so the
 * running pet applies changes live. Relational data (conversations/memories) will
 * move to SQLite in the AI phase; simple settings/state live here.
 */
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { DEFAULT_APPEARANCE, type PetAppearance } from "@/types/pet";
import type { ProviderId } from "@/ai/client";
import type { LanguageId, PersonalityId } from "@/ai/personality";

export interface InteractionSettings {
  gaze: boolean; // eyes follow cursor
  hunt: boolean;
  huntSensitivity: number; // 0..1 (higher = easier to trigger)
  petting: boolean;
  drag: boolean;
  keyboard: boolean; // kneading while typing
  overheat: boolean;
  overheatSensitivity: number; // 0..1
  scroll: boolean;
}

export interface GeneralSettings {
  alwaysOnTop: boolean;
  scale: number; // 0.5..1.6 visual size
  opacity: number; // 0.3..1
  reducedMotion: boolean;
  cosmicDecor: boolean; // ambient stars + black hole behind the pet
  /** Pet never dozes off, and the render loop is kept alive even when the
   *  window is occluded (WebView2 throttles rAF in that case). */
  neverSleep: boolean;
}

export interface ProductivitySettings {
  breakEnabled: boolean;
  breakIntervalMin: number; // minutes between "take a break" prompts (§38)
  waterEnabled: boolean; // §39
  waterIntervalMin: number;
  pomodoroFocusMin: number; // §36
  pomodoroBreakMin: number;
  taskNudgeEnabled: boolean; // periodic nudge about unfinished tasks
  taskNudgeMin: number;
}

/** A scheduled reminder (§34). */
export type Recurrence = "once" | "daily" | "weekdays";

export interface Reminder {
  id: string;
  title: string;
  /** 24h local time, "HH:MM". */
  time: string;
  recurrence: Recurrence;
  enabled: boolean;
  /** Local date ("YYYY-MM-DD") this last fired, so it fires at most once a day. */
  lastFired?: string;
}

/** A simple task the pet can nudge you about. */
export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

/** AI companion configuration (§27, §87). Keys live in Rust, never here. */
export interface AISettings {
  enabled: boolean;
  provider: ProviderId;
  model: string;
  /** Base URL / CLI path, meaning depends on provider. */
  baseUrl: string;
  personality: PersonalityId;
  language: LanguageId;
  userName: string;
  /** React to coding-agent status posted to the local API (§41). */
  agentReactions: boolean;
}

export interface Settings {
  /** Bumped when a new default should override a previously-stored value. */
  version: number;
  petName: string;
  characterId: string; // selected character/skin from the roster
  appearance: PetAppearance;
  general: GeneralSettings;
  interactions: InteractionSettings;
  productivity: ProductivitySettings;
  reminders: Reminder[];
  tasks: TaskItem[];
  ai: AISettings;
}

/** Current defaults revision — bump to push a new default onto existing installs. */
export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  petName: "Pixel",
  characterId: "classic",
  appearance: { ...DEFAULT_APPEARANCE },
  general: {
    alwaysOnTop: true,
    scale: 0.49,
    opacity: 1,
    reducedMotion: false,
    cosmicDecor: true,
    neverSleep: true,
  },
  interactions: {
    gaze: true,
    hunt: false, // off by default — the pet stays put instead of chasing the cursor
    huntSensitivity: 0.5,
    petting: true,
    drag: true,
    keyboard: true,
    overheat: true,
    overheatSensitivity: 0.5,
    scroll: true,
  },
  productivity: {
    breakEnabled: true,
    breakIntervalMin: 15,
    waterEnabled: true,
    waterIntervalMin: 15,
    pomodoroFocusMin: 25,
    pomodoroBreakMin: 5,
    taskNudgeEnabled: true,
    taskNudgeMin: 30,
  },
  reminders: [],
  tasks: [],
  ai: {
    enabled: false,
    provider: "claude_code",
    model: "",
    baseUrl: "",
    personality: "playful",
    language: "en",
    userName: "",
    agentReactions: true,
  },
};

const KEY = "pixelpaw.settings.v1";

/** Load settings, deep-merging over defaults so new fields always have a value. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const p = JSON.parse(raw) as Partial<Settings>;
    const merged: Settings = {
      version: SETTINGS_VERSION,
      petName: p.petName ?? DEFAULT_SETTINGS.petName,
      characterId: p.characterId ?? DEFAULT_SETTINGS.characterId,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...(p.appearance ?? {}) },
      general: { ...DEFAULT_SETTINGS.general, ...(p.general ?? {}) },
      interactions: { ...DEFAULT_SETTINGS.interactions, ...(p.interactions ?? {}) },
      productivity: { ...DEFAULT_SETTINGS.productivity, ...(p.productivity ?? {}) },
      reminders: Array.isArray(p.reminders) ? p.reminders : [],
      tasks: Array.isArray(p.tasks) ? p.tasks : [],
      ai: { ...DEFAULT_SETTINGS.ai, ...(p.ai ?? {}) },
    };
    // Settings saved before this revision keep their old size; adopt the new
    // default once, leaving every other customization intact.
    if ((p.version ?? 1) < SETTINGS_VERSION) {
      merged.general.scale = DEFAULT_SETTINGS.general.scale;
    }
    return merged;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

/** Persist + broadcast to other windows (so the live pet updates). */
export async function saveSettings(s: Settings): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(s));
  try {
    await emit("settings:changed", s);
  } catch {
    /* not in a Tauri context (e.g. plain browser dev) — ignore */
  }
}

export function onSettingsChanged(cb: (s: Settings) => void): Promise<UnlistenFn> {
  return listen<Settings>("settings:changed", (e) => cb(e.payload));
}

/** Map a 0..1 "sensitivity" to the hunt speed threshold (px/ms). */
export function huntSpeedFrom(sensitivity: number): number {
  return 3.2 - 2.0 * clamp01(sensitivity); // 3.2 (hard) .. 1.2 (easy)
}
/** Map a 0..1 "sensitivity" to the overheat key-rate threshold (keys/s). */
export function overheatRateFrom(sensitivity: number): number {
  return 14 - 8 * clamp01(sensitivity); // 14 (hard) .. 6 (easy)
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

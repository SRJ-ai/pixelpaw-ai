import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import type { UnlistenFn } from "@tauri-apps/api/event";

import type { AnimState, PetNeeds } from "@/types/pet";
import { StateMachine } from "./animation/stateMachine";
import { Animator } from "./animation/animator";
import { IdleDirector } from "./behaviors/idle";
import { dateKey, isReminderDue } from "./behaviors/reminders";
import { applyRenderState, bindParts, type PetParts } from "./render/parts";
import { subscribeControl, subscribeCursor, type CursorSample } from "@/platform/cursorBridge";
import {
  subscribeKeyboard,
  subscribeScroll,
  subscribeBreak,
  subscribePomodoro,
  subscribePeek,
  subscribeWater,
  subscribeAgent,
  type AgentStatus,
} from "@/platform/inputBridge";
import { bus } from "@/events/eventBus";
import { t } from "@/config/i18n";
import { award, levelFor, loadProgress, saveProgress, XP, type Progress } from "./progression";
import {
  DEFAULT_SETTINGS,
  huntSpeedFrom,
  overheatRateFrom,
  type Settings,
} from "@/config/settings";

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/**
 * How often the wall-clock schedulers (reminders, break, water, pomodoro, task
 * nudges) run. They are deliberately *not* driven by the render loop: WebView2
 * stops `requestAnimationFrame` outright while the window is hidden or fully
 * occluded, which silently stalls every timer that hangs off it.
 */
const WALL_CLOCK_TICK_MS = 15000;

/** Lines that read better with the user's name in them, and their variants. */
type NamedLine = "pet.break" | "pet.water" | "pet.focusStart" | "pet.pomodoroDone";
const NAMED = {
  "pet.break": "pet.breakNamed",
  "pet.water": "pet.waterNamed",
  "pet.focusStart": "pet.focusStartNamed",
  "pet.pomodoroDone": "pet.pomodoroDoneNamed",
} as const;

/** What the pet says as taps pile up — one line per tier, worst last. */
const POKE_KEYS = ["pet.poke1", "pet.poke2", "pet.poke3", "pet.poke4"] as const;
/** Leave the pet alone this long and its patience resets. */
const POKE_CALM_MS = 5000;

/** A little critically-ish damped spring, used for drag stretch + release bounce. */
class Spring {
  value = 0;
  vel = 0;
  constructor(private k = 220, private damp = 13) {}
  drive(v: number) {
    this.vel = (v - this.value) * 60;
    this.value = v;
  }
  update(dt: number) {
    const a = -this.k * this.value - this.damp * this.vel;
    this.vel += a * dt;
    this.value += this.vel * dt;
    if (Math.abs(this.value) < 0.001 && Math.abs(this.vel) < 0.02) {
      this.value = 0;
      this.vel = 0;
    }
  }
}

/** Tunables (later surfaced in Settings; §11/§12/§15). */
const CFG = {
  huntSpeed: 2.1, // physical px/ms that counts as a "dart"
  huntDurationMs: 2600,
  gazeRadius: 380, // px over which gaze saturates to full
  idleSleepMs: 30000, // stillness before the pet may doze off
  overheatRate: 9, // key-presses/second that triggers the overheat gag (§15)
  kneadIdleMs: 600, // stop kneading this long after typing stops
  scrollFastMag: 500, // accumulated |wheel delta| that counts as a fast scroll (§16)
};

export interface EngineStatus {
  state: AnimState;
  needs: PetNeeds;
  /** Live countdown, so the UI can float a timer beside the pet. */
  pomo: { active: boolean; phase: "focus" | "break"; remainingMs: number };
}

export class PetEngine {
  private sm = new StateMachine((s) => {
    bus.emit("pet.stateChange", { state: s });
    this.onStateEnter(s);
  });
  private anim = new Animator();
  private idle = new IdleDirector();
  private parts: PetParts | null = null;
  private appWindow = getCurrentWindow();

  private raf = 0;
  private lastFrame = 0;
  private running = false;
  private paused = false;
  private unlisten: UnlistenFn[] = [];

  private needs: PetNeeds = { happiness: 0.7, energy: 0.85, affection: 0.4 };

  // input tracking
  private latest: CursorSample | null = null;
  private prevLeft = false;
  private lastMoveTime = 0;
  private velX = 0;
  private velY = 0;
  private prevX = 0;
  private prevY = 0;

  // window position (authoritative while we drive it; synced from samples otherwise)
  private winX = 0;
  private winY = 0;
  private haveWin = false;

  // drag (pending = pressed but not yet moved enough to count as a pick-up)
  private drag = {
    active: false,
    pending: false,
    grabX: 0,
    grabY: 0,
    targetX: 0,
    targetY: 0,
    downX: 0,
    downY: 0,
    downTime: 0,
  };
  private poke = { count: 0, windowStart: 0 };
  /** Escalating irritation at repeated taps (see `escalatePoke`). */
  private annoy = { count: 0, lastAt: 0, tier: -1 };
  private springX = new Spring();
  private springY = new Spring();
  private shake = { reversals: 0, lastDir: 0, windowStart: 0 };

  // hunt
  private hunt = { active: false, until: 0 };

  // petting
  private pet = { lastStroke: 0, lastDir: 0, reversals: 0, windowStart: 0 };

  // walk
  private walk = { until: 0, dir: 1 as 1 | -1, startX: 0 };

  private facing: 1 | -1 = 1;
  /** Whether the global cursor is currently over the drawn pet. */
  private hovering = false;

  // typing (activity only — never content)
  private typing = { events: [] as { t: number; n: number }[], lastType: 0, overheatSaid: false };
  // scroll
  private scroll = { recent: 0, lastAt: 0 };

  // live settings + derived thresholds
  private settings: Settings = DEFAULT_SETTINGS;
  private huntSpeed = CFG.huntSpeed;
  private overheatRate = CFG.overheatRate;

  // break (§38) / water (§39) / task nudges
  private lastBreakAt = 0;
  private lastWaterAt = 0;
  private lastTaskNudgeAt = 0;
  private lastReminderCheck = 0;
  /** Reminder ids fired today, so each fires at most once per day. */
  private firedToday = new Map<string, string>();
  /** Wall-clock scheduler handle (see `tickWallClock`). */
  private wallClock: number | undefined;
  // pomodoro (§36) + focus (§37) + peek (§18)
  private pomo = { active: false, phase: "focus" as "focus" | "break", endsAt: 0 };
  private focusMode = false;
  /** True while a coding agent reports it's working (keeps the pet attentive). */
  private agentBusy = false;
  private progress: Progress = loadProgress();
  private progressDirty = false;
  private lastProgressSave = 0;
  private peek = { active: false, savedX: 0, savedY: 0 };

  constructor(
    private onStatus?: (s: EngineStatus) => void,
    private onSay?: (text: string, ms: number) => void,
    private onBreak?: () => void,
    /**
     * Fired when a reminder has run, so the UI can record the date it last
     * fired (and switch off one-shots). `dateKey` is a local "YYYY-MM-DD".
     */
    private onReminderFired?: (id: string, dateKey: string) => void
  ) {}

  async attach(svg: SVGSVGElement, settings: Settings = DEFAULT_SETTINGS) {
    this.setSettings(settings);
    this.parts = bindParts(svg);
    this.unlisten.push(await subscribeCursor((s) => this.onCursor(s)));
    this.unlisten.push(await subscribeKeyboard((n) => this.onKey(n)));
    this.unlisten.push(await subscribeScroll((d) => this.onScroll(d)));
    this.unlisten.push(await subscribeBreak(() => this.triggerBreak(performance.now())));
    this.unlisten.push(await subscribePomodoro(() => this.togglePomodoro(performance.now())));
    this.unlisten.push(await subscribePeek(() => void this.togglePeek()));
    this.unlisten.push(await subscribeWater(() => this.triggerWater(performance.now())));
    this.unlisten.push(await subscribeAgent((agent, status) => this.onAgent(agent, status)));
    this.unlisten.push(
      ...(await subscribeControl(
        () => this.pause(),
        () => this.resume()
      ))
    );
    // Return to wherever the user last left it.
    this.restorePos();

    this.running = true;
    this.lastFrame = performance.now();
    // Timers start now, so each first nudge lands one interval from launch.
    this.lastBreakAt = this.lastFrame;
    this.lastWaterAt = this.lastFrame;
    this.lastTaskNudgeAt = this.lastFrame;
    this.raf = requestAnimationFrame(this.loop);
    this.wallClock = window.setInterval(this.tickWallClock, WALL_CLOCK_TICK_MS);
  }

  detach() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.clearInterval(this.wallClock);
    this.unlisten.forEach((u) => u());
    this.unlisten = [];
  }

  /**
   * Everything scheduled against the clock rather than against frames. Kept on
   * a timer so reminders still land when the pet is hidden or covered by a
   * full-screen window, where the render loop is suspended.
   */
  private tickWallClock = () => {
    if (!this.running || this.paused) return;
    const now = performance.now();
    this.updateBreak(now);
    this.updateWater(now);
    this.updateReminders(now);
    this.updateTaskNudge(now);
    this.updatePomodoro(now);
  };

  pause() {
    this.paused = true;
    bus.emit("control.pause", {});
  }
  resume() {
    this.paused = false;
    bus.emit("control.resume", {});
  }

  getNeeds() {
    return this.needs;
  }

  /**
   * Pick the named variant of a line when the user has told the pet their name.
   * The name lives in `ai.userName` because that is where it was first
   * collected, but it belongs to the pet, not to the AI.
   */
  private say(key: NamedLine, ms: number) {
    const name = this.settings.ai.userName.trim();
    this.onSay?.(name ? t(NAMED[key], { name }) : t(key), ms);
  }

  /** Apply user settings live (called on change from the settings window). */
  setSettings(s: Settings) {
    this.settings = s;
    this.huntSpeed = huntSpeedFrom(s.interactions.huntSensitivity);
    this.overheatRate = overheatRateFrom(s.interactions.overheatSensitivity);
  }

  /** Re-bind SVG parts after the character is re-rendered (e.g. recolor). */
  rebind(svg: SVGSVGElement) {
    this.parts = bindParts(svg);
  }

  getProgress(): Progress {
    return this.progress;
  }

  /**
   * Grant XP/bond for something the user did, announce any level-up or new
   * achievement, and mark progress for saving.
   */
  private grant(xp: number, bond: number, counter?: keyof Progress) {
    if (counter && typeof this.progress[counter] === "number") {
      (this.progress[counter] as number)++;
    }
    const { next, leveledUp, unlocked } = award(this.progress, xp, bond);
    this.progress = next;
    this.progressDirty = true;
    if (unlocked.length > 0) {
      this.onSay?.(`🏆 ${unlocked[0].title}`, 3200);
      this.onBreak?.();
    } else if (leveledUp) {
      this.onSay?.(t("pet.levelUp", { n: levelFor(this.progress.xp) }), 3000);
      this.onBreak?.();
    }
  }

  /** Persist progress at most once every few seconds. */
  private flushProgress(now: number) {
    if (!this.progressDirty || now - this.lastProgressSave < 4000) return;
    this.lastProgressSave = now;
    this.progressDirty = false;
    saveProgress(this.progress);
  }

  // ------------------------------------------------------------------ input
  /**
   * Hit boxes follow the *rendered* size (the art is scaled from its bottom
   * edge), so a small pet only reacts where it's actually drawn. Mirrors
   * `is_over_pet` on the Rust side.
   */
  private bodyBox() {
    const s = this.settings.general.scale;
    const bottom = 0.96;
    const top = bottom - 0.84 * s;
    return { halfW: 0.36 * s, top, bottom };
  }

  private overPet(s: CursorSample) {
    const b = this.bodyBox();
    return Math.abs(s.fracX - 0.5) <= b.halfW && s.fracY >= b.top && s.fracY <= b.bottom;
  }

  private overHead(s: CursorSample) {
    const b = this.bodyBox();
    const headBottom = b.top + (b.bottom - b.top) * 0.55;
    return Math.abs(s.fracX - 0.5) <= b.halfW * 0.8 && s.fracY >= b.top && s.fracY <= headBottom;
  }

  private onCursor(s: CursorSample) {
    const now = performance.now();
    const prev = this.latest;
    this.latest = s;

    // velocity (physical px / ms) for hunting + drag stretch
    if (prev) {
      const dt = Math.max(1, now - this.lastMoveTime);
      this.velX = lerp(this.velX, (s.x - this.prevX), 0.5);
      this.velY = lerp(this.velY, (s.y - this.prevY), 0.5);
      const speed = Math.hypot(s.x - this.prevX, s.y - this.prevY) / dt;

      // Mouse hunting (§11): a fast dart that isn't over the pet.
      if (
        this.settings.interactions.hunt &&
        speed > this.huntSpeed &&
        !this.overPet(s) &&
        !this.drag.active &&
        !this.hunt.active
      ) {
        if (this.sm.request("hunting", now)) {
          this.hunt.active = true;
          this.hunt.until = now + CFG.huntDurationMs;
          bus.emit("mouse.hunt", { speed });
        }
      }
    }
    this.prevX = s.x;
    this.prevY = s.y;
    this.lastMoveTime = now;

    // Hover edges. The window is click-through unless the cursor is on the
    // art, so the DOM never sees these — the global cursor stream is the only
    // place they can be detected.
    const over = this.overPet(s);
    if (over !== this.hovering) {
      this.hovering = over;
      if (over) bus.emit("mouse.enter", { fracX: s.fracX, fracY: s.fracY });
      else bus.emit("mouse.leave", {});
    }

    // Wake from sleep on real movement.
    if (this.sm.is("sleep")) {
      this.sm.request("wake", now);
      bus.emit("pet.wake", {});
    }

    // Sync our window position from ground truth unless we're driving it.
    if (!this.drag.active && !this.hunt.active) {
      this.winX = s.winX;
      this.winY = s.winY;
      this.haveWin = true;
    }

    // Left-button edges: a quick tap = poke (hurt reaction), press+move = pick-up.
    if (s.left && !this.prevLeft && this.overPet(s) && this.settings.interactions.drag) {
      this.drag.pending = true;
      this.drag.active = false;
      this.drag.grabX = s.relX;
      this.drag.grabY = s.relY;
      this.drag.downX = s.x;
      this.drag.downY = s.y;
      this.drag.downTime = now;
      this.shake = { reversals: 0, lastDir: 0, windowStart: now };
    }
    if (this.drag.pending && !this.drag.active && s.left) {
      if (Math.hypot(s.x - this.drag.downX, s.y - this.drag.downY) > 6) this.activateDrag(now);
    }
    if (!s.left && this.prevLeft) {
      if (this.drag.active) this.endDrag(now);
      else if (this.drag.pending) {
        this.drag.pending = false;
        this.onPoke(now);
      }
    }
    this.prevLeft = s.left;

    // Petting (§13): stroking the head back-and-forth, button up.
    if (!s.left && !this.drag.active && this.overHead(s) && this.settings.interactions.petting)
      this.detectPet(now);
  }

  private activateDrag(now: number) {
    this.drag.active = true;
    this.drag.pending = false;
    this.drag.targetX = this.winX;
    this.drag.targetY = this.winY;
    this.sm.request("dragged", now);
    bus.emit("drag.start", {});
  }

  private endDrag(now: number) {
    this.drag.active = false;
    // Kick the springs so the body bounces back.
    this.springX.vel += clamp(-this.velX * 0.6, -8, 8);
    this.springY.vel += clamp(-this.velY * 0.6, -8, 8);
    if (this.shake.reversals >= 4) {
      this.sm.request("dizzy", now);
      bus.emit("mouse.shake", { intensity: this.shake.reversals });
    } else {
      this.sm.releaseToIdle(now);
    }
    // Remember where the user put it (persists across restarts).
    this.savePos();
    bus.emit("drag.end", {});
  }

  private onPoke(now: number) {
    // A tap on the cat: "ow!" — repeated taps daze it (Talking-Tom-like).
    if (now - this.poke.windowStart > 1600) {
      this.poke.windowStart = now;
      this.poke.count = 0;
    }
    this.poke.count++;
    this.needs.happiness = clamp(this.needs.happiness - 0.04, 0, 1);
    this.needs.affection = clamp(this.needs.affection - 0.02, 0, 1);
    if (this.poke.count >= 4) this.sm.request("dizzy", now);
    else this.sm.request("hurt", now);
    this.escalatePoke(now);
  }

  /**
   * Keep poking and the pet gets progressively more fed up, ending in a plea to
   * stop. It speaks only when it moves up a tier, so a burst of taps produces a
   * changing reaction rather than the same line over and over.
   */
  private escalatePoke(now: number) {
    if (now - this.annoy.lastAt > POKE_CALM_MS) {
      this.annoy.count = 0;
      this.annoy.tier = -1;
    }
    this.annoy.lastAt = now;
    this.annoy.count++;

    const tier = Math.min(POKE_KEYS.length - 1, Math.floor((this.annoy.count - 1) / 2));
    if (tier === this.annoy.tier) return;
    this.annoy.tier = tier;
    this.onSay?.(t(POKE_KEYS[tier]), 1800);
  }

  private savePos() {
    try {
      localStorage.setItem(
        "pixelpaw.pos.v1",
        JSON.stringify({ x: Math.round(this.winX), y: Math.round(this.winY) })
      );
    } catch {
      /* ignore */
    }
  }

  private restorePos() {
    try {
      const raw = localStorage.getItem("pixelpaw.pos.v1");
      if (!raw) return;
      const p = JSON.parse(raw) as { x: number; y: number };
      if (typeof p.x === "number" && typeof p.y === "number") {
        this.winX = p.x;
        this.winY = p.y;
        this.haveWin = true;
        this.setWindow();
      }
    } catch {
      /* ignore */
    }
  }

  private detectPet(now: number) {
    if (now - this.pet.windowStart > 900) {
      this.pet.windowStart = now;
      this.pet.reversals = 0;
    }
    const dir = Math.sign(this.velX);
    if (dir !== 0 && dir !== this.pet.lastDir && this.pet.lastDir !== 0) {
      this.pet.reversals++;
    }
    if (dir !== 0) this.pet.lastDir = dir;

    if (this.pet.reversals >= 2) {
      this.pet.lastStroke = now;
      if (this.sm.request("petted", now)) {
        this.needs.happiness = clamp(this.needs.happiness + 0.03, 0, 1);
        this.needs.affection = clamp(this.needs.affection + 0.02, 0, 1);
        this.grant(XP.pet, 2, "pets");
        bus.emit("mouse.pet", { strokes: this.pet.reversals });
      }
    }
  }

  // ------------------------------------------------------ keyboard + scroll
  private onKey(presses: number) {
    const now = performance.now();
    this.typing.events.push({ t: now, n: presses });
    this.typing.lastType = now;
    if (this.sm.is("sleep")) {
      this.sm.request("wake", now);
      bus.emit("pet.wake", {});
    }
  }

  private onScroll(delta: number) {
    if (!this.settings.interactions.scroll) return;
    const now = performance.now();
    // Accumulate magnitude within a short window to distinguish gentle vs fast.
    this.scroll.recent = (now - this.scroll.lastAt < 250 ? this.scroll.recent : 0) + Math.abs(delta);
    this.scroll.lastAt = now;
    if (this.scroll.recent >= CFG.scrollFastMag) {
      this.sm.request("surprised", now);
    } else {
      this.sm.request("curious", now);
    }
  }

  private typingRate(now: number): number {
    // keys/second over the last 1000 ms
    this.typing.events = this.typing.events.filter((e) => now - e.t <= 1000);
    return this.typing.events.reduce((s, e) => s + e.n, 0);
  }

  private updateTyping(now: number) {
    if (!this.settings.interactions.keyboard) return;
    const rate = this.typingRate(now);
    const typingNow = now - this.typing.lastType < 350;
    const canOverheat = this.settings.interactions.overheat;

    if (canOverheat && rate >= this.overheatRate) {
      if (this.sm.request("overheat", now) || this.sm.is("overheat")) {
        if (!this.typing.overheatSaid) {
          this.onSay?.(t("pet.overheat"), 1800);
          this.typing.overheatSaid = true;
        }
      }
    } else if (typingNow && rate > 0) {
      this.sm.request("kneading", now);
    }

    // Recovery.
    if (this.sm.is("overheat") && rate < this.overheatRate * 0.55) {
      this.sm.releaseToIdle(now);
    }
    if (rate < this.overheatRate * 0.55) this.typing.overheatSaid = false;
    if (this.sm.is("kneading") && now - this.typing.lastType > CFG.kneadIdleMs) {
      this.sm.releaseToIdle(now);
    }
  }

  // ---------------------------------------------------------------- lifecycle
  private onStateEnter(s: AnimState) {
    if (s === "walk") {
      this.walk.until = performance.now() + 1500 + Math.random() * 1500;
      this.walk.dir = Math.random() < 0.5 ? -1 : 1;
      this.walk.startX = this.winX;
      this.facing = this.walk.dir;
    }
  }

  // ------------------------------------------------------------------- frame
  private loop = (now: number) => {
    if (!this.running) return;
    const dtMs = Math.min(50, now - this.lastFrame);
    this.lastFrame = now;
    const dt = dtMs / 1000;

    if (!this.paused) {
      this.updateNeeds(dt);
      this.sm.update(dtMs, now);
      this.updateInteractions(now);
      this.updateTyping(now);
      this.updateMovement(dt, now);
      this.maybeIdle(now);
    }

    this.render(now);
    this.emitStatus(now);
    this.flushProgress(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private updateNeeds(dt: number) {
    const sleeping = this.sm.is("sleep");
    this.needs.energy = clamp(
      this.needs.energy + (sleeping ? 0.02 : -0.0025) * dt,
      0,
      1
    );
    // happiness gently drifts toward a contented baseline
    this.needs.happiness = lerp(this.needs.happiness, 0.6, 0.0005 * dt);
  }

  private updateInteractions(now: number) {
    // End petting -> purr -> idle.
    if (this.sm.is("petted") && now - this.pet.lastStroke > 500) {
      this.sm.request("purring", now);
    }
    if (this.sm.is("purring") && now - this.pet.lastStroke > 2600) {
      this.sm.releaseToIdle(now);
    }
    // End hunt.
    if (this.hunt.active && now > this.hunt.until) {
      this.hunt.active = false;
      this.sm.releaseToIdle(now);
    }
    // End walk.
    if (this.sm.is("walk") && now > this.walk.until) {
      this.sm.releaseToIdle(now);
    }
  }

  private updateMovement(dt: number, _now: number) {
    const s = this.latest;

    if (this.drag.active && s) {
      // Follow the grab point with a little lag (the "mochi" trail).
      this.drag.targetX = s.x - this.drag.grabX;
      this.drag.targetY = s.y - this.drag.grabY;
      this.winX = lerp(this.winX, this.drag.targetX, 0.5);
      this.winY = lerp(this.winY, this.drag.targetY, 0.5);
      this.setWindow();

      // Stretch toward motion, squash the other axis (rough volume conservation).
      let sx = clamp(this.velX * 0.01, -0.4, 0.55);
      let sy = clamp(this.velY * 0.01, -0.4, 0.55);
      sx -= sy * 0.3;
      sy -= sx * 0.3;
      this.springX.drive(sx);
      this.springY.drive(sy);

      // Shake detection.
      const dir = Math.sign(this.velX);
      if (dir !== 0 && dir !== this.shake.lastDir && this.shake.lastDir !== 0) {
        this.shake.reversals++;
      }
      if (dir !== 0) this.shake.lastDir = dir;
      return;
    }

    // Not dragging: springs relax (release bounce).
    this.springX.update(dt);
    this.springY.update(dt);

    if (this.hunt.active && s) {
      const tx = s.x - s.winW / 2;
      const ty = s.y - s.winH / 2;
      this.winX = lerp(this.winX, tx, 0.12);
      this.winY = lerp(this.winY, ty, 0.12);
      this.facing = s.x >= this.winX + s.winW / 2 ? 1 : -1;
      this.setWindow();
      if (Math.hypot(tx - this.winX, ty - this.winY) < 30) {
        this.hunt.active = false;
        this.sm.request("surprised", performance.now());
      }
      return;
    }

    if (this.sm.is("walk")) {
      if (this.peek.active) return; // stay tucked at the edge
      const range = 45; // gentle wander; the pet mostly stays put
      let nx = this.winX + this.walk.dir * 0.7;
      if (Math.abs(nx - this.walk.startX) > range) {
        this.walk.dir = (this.walk.dir * -1) as 1 | -1;
        this.facing = this.walk.dir;
        nx = this.winX + this.walk.dir * 0.7;
      }
      this.winX = nx;
      this.setWindow();
    }
  }

  private setWindow() {
    if (!this.haveWin) return;
    void this.appWindow.setPosition(
      new PhysicalPosition(Math.round(this.winX), Math.round(this.winY))
    );
  }

  private updateBreak(now: number) {
    if (!this.settings.productivity.breakEnabled) return;
    const interval = Math.max(1, this.settings.productivity.breakIntervalMin) * 60000;
    if (now - this.lastBreakAt >= interval) this.triggerBreak(now);
  }

  private triggerBreak(now: number) {
    this.lastBreakAt = now;
    this.sm.request("stretch", now);
    this.say("pet.break", 3400);
    this.onBreak?.();
  }

  // ---- Coding-agent reactions (§41) ----
  private onAgent(agent: string, status: AgentStatus) {
    if (!this.settings.ai.agentReactions) return;
    const now = performance.now();
    const who = agent || "agent";
    switch (status) {
      case "working":
      case "thinking":
        this.agentBusy = true;
        this.sm.request("curious", now);
        this.onSay?.(t("pet.agentWorking", { who }), 2200);
        break;
      case "waiting":
        this.sm.request("curious", now);
        break;
      case "success":
        this.agentBusy = false;
        this.sm.request("happy", now);
        this.needs.happiness = clamp(this.needs.happiness + 0.05, 0, 1);
        this.onSay?.(t("pet.agentDone"), 2600);
        this.onBreak?.();
        this.grant(XP.agentSuccess, 5, "agentSuccesses");
        break;
      case "error":
        this.agentBusy = false;
        this.sm.request("surprised", now);
        this.onSay?.(t("pet.agentError"), 3000);
        break;
      case "cancelled":
      case "idle":
        this.agentBusy = false;
        this.sm.releaseToIdle(now);
        break;
    }
  }

  // ---- Water (§39) ----
  private updateWater(now: number) {
    if (!this.settings.productivity.waterEnabled || this.focusMode) return;
    const interval = Math.max(1, this.settings.productivity.waterIntervalMin) * 60000;
    if (now - this.lastWaterAt >= interval) this.triggerWater(now);
  }

  private triggerWater(now: number) {
    this.lastWaterAt = now;
    this.sm.request("happy", now);
    this.say("pet.water", 3400);
  }

  // ---- Scheduled reminders (§34) ----
  private updateReminders(now: number) {
    // Wall-clock check; once every 5s is plenty and stays cheap.
    if (now - this.lastReminderCheck < 5000) return;
    this.lastReminderCheck = now;

    const d = new Date();
    const today = dateKey(d);

    for (const r of this.settings.reminders) {
      // `firedToday` covers the gap before the `lastFired` save lands; the
      // persisted half is what survives a restart.
      if (!isReminderDue(r, { now: d, firedThisSession: this.firedToday.get(r.id) })) continue;

      this.firedToday.set(r.id, today);
      this.sm.request("surprised", now);
      this.onSay?.(`⏰ ${r.title}`, 5200);
      this.onBreak?.(); // reuse the attention-grabbing flourish
      this.onReminderFired?.(r.id, today);
    }
  }

  // ---- Task nudges ----
  private updateTaskNudge(now: number) {
    const p = this.settings.productivity;
    if (!p.taskNudgeEnabled || this.focusMode) return;
    const pending = this.settings.tasks.filter((t) => !t.done);
    if (pending.length === 0) return;
    if (now - this.lastTaskNudgeAt < Math.max(1, p.taskNudgeMin) * 60000) return;

    this.lastTaskNudgeAt = now;
    const pick = pending[Math.floor(Math.random() * pending.length)];
    this.sm.request("curious", now);
    this.onSay?.(`📝 ${pick.text}`, 4200);
  }

  // ---- Pomodoro (§36) + Focus (§37) ----
  private togglePomodoro(now: number) {
    if (this.pomo.active) this.stopPomodoro();
    else this.startPomodoro(now);
  }

  /** Force the next status through, so the timer appears the instant it starts. */
  private flushStatus() {
    this.lastStatusAt = 0;
  }

  private startPomodoro(now: number) {
    this.pomo.active = true;
    this.pomo.phase = "focus";
    this.pomo.endsAt = now + this.settings.productivity.pomodoroFocusMin * 60000;
    this.focusMode = true;
    this.flushStatus();
    this.sm.request("sit", now);
    this.say("pet.focusStart", 3000);
  }

  private stopPomodoro() {
    this.pomo.active = false;
    this.focusMode = false;
    this.flushStatus();
    this.onSay?.(t("pet.pomodoroStopped"), 1600);
  }

  private updatePomodoro(now: number) {
    if (!this.pomo.active || now < this.pomo.endsAt) return;
    if (this.pomo.phase === "focus") {
      this.pomo.phase = "break";
      this.pomo.endsAt = now + this.settings.productivity.pomodoroBreakMin * 60000;
      this.focusMode = false;
      this.sm.request("stretch", now);
      this.onSay?.(t("pet.focusDone"), 3400);
      this.onBreak?.();
    } else {
      this.pomo.active = false;
      this.sm.request("happy", now);
      this.say("pet.pomodoroDone", 3600);
      this.grant(XP.pomodoroComplete, 10, "pomodoros");
    }
  }

  // ---- Peek Mode (§18) ----
  private async togglePeek() {
    if (this.peek.active) {
      this.winX = this.peek.savedX;
      this.winY = this.peek.savedY;
      this.peek.active = false;
      this.setWindow();
      this.savePos();
      return;
    }
    this.peek.savedX = this.winX;
    this.peek.savedY = this.winY;
    try {
      const mon = await currentMonitor();
      const winW = this.latest?.winW ?? 300;
      if (mon) {
        const right = mon.position.x + mon.size.width;
        const visible = Math.round(winW * 0.42);
        this.winX = right - visible;
        this.peek.active = true;
        this.setWindow();
      }
    } catch {
      /* ignore */
    }
  }

  private maybeIdle(now: number) {
    // Doze off after prolonged stillness (mouse + keyboard quiet) — never while
    // focusing, while an agent is working, or when "never sleep" is on.
    if (
      this.sm.is("idle") &&
      !this.focusMode &&
      !this.agentBusy &&
      !this.settings.general.neverSleep
    ) {
      const lastActivity = Math.max(this.lastMoveTime, this.typing.lastType);
      if (now - lastActivity > CFG.idleSleepMs && this.needs.energy < 0.5) {
        this.sm.request("sleep", now);
        bus.emit("pet.sleep", {});
        return;
      }
    }
    if (!this.sm.is("idle")) return;
    const next = this.idle.tick(now, this.needs.energy);
    if (!next) return;
    // "Never sleep" also removes dozing from the idle rotation.
    if (next === "sleep" && this.settings.general.neverSleep) return;
    if (this.focusMode) {
      // Focus mode (§37): keep it calm — only gentle, quiet behaviors.
      if (next === "blink" || next === "look" || next === "sit" || next === "groom") {
        this.sm.request(next, now);
      }
      return;
    }
    if (this.peek.active && next === "walk") return; // don't wander off the edge
    this.sm.request(next, now);
  }

  private computeGaze(now: number) {
    const s = this.latest;
    const stale = now - this.lastMoveTime > 4000;
    if (!s || stale || !this.settings.interactions.gaze)
      return { gaze: { x: 0, y: 0 }, active: false };
    const eyesX = s.winX + s.winW * 0.5;
    const eyesY = s.winY + s.winH * 0.53;
    const gx = clamp((s.x - eyesX) / CFG.gazeRadius);
    const gy = clamp((s.y - eyesY) / CFG.gazeRadius);
    // facing hysteresis
    if (gx > 0.55) this.facing = 1;
    else if (gx < -0.55) this.facing = -1;
    return { gaze: { x: gx, y: gy }, active: true };
  }

  private render(now: number) {
    if (!this.parts) return;
    const awake = !this.sm.is("sleep");
    const { gaze, active } = this.computeGaze(now);
    const rs = this.anim.frame({
      state: this.sm.current,
      elapsed: this.sm.elapsed,
      time: now,
      awake,
      gaze,
      gazeActive: active,
      stretch: { x: this.springX.value, y: this.springY.value },
      facing: this.facing,
      happiness: this.needs.happiness,
    });
    applyRenderState(this.parts, rs);
  }

  private lastStatusAt = 0;
  private emitStatus(now: number) {
    if (!this.onStatus || now - this.lastStatusAt < 400) return;
    this.lastStatusAt = now;
    this.onStatus({
      state: this.sm.current,
      needs: { ...this.needs },
      pomo: {
        active: this.pomo.active,
        phase: this.pomo.phase,
        remainingMs: Math.max(0, this.pomo.endsAt - now),
      },
    });
  }
}

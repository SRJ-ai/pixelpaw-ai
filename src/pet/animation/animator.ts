import { neutralRenderState, type AnimState, type Mouth, type RenderState } from "@/types/pet";

/**
 * Procedural animator. Given the active state + live inputs it produces one
 * `RenderState` per frame. Instead of pre-rendered sprite frames it computes
 * targets per state and eases the persistent render state toward them, layering
 * in continuous motion (breathing, tail sway, blinks). This keeps the character
 * expressive and tiny while leaving the door open to swap in sprite sheets later.
 */

export interface AnimInput {
  state: AnimState;
  elapsed: number; // ms in current state
  time: number; // absolute ms (performance.now)
  awake: boolean;
  gaze: { x: number; y: number }; // desired pupil offset / lean, -1..1
  gazeActive: boolean;
  /** Additive squash/stretch from the drag spring (also drives release bounce). */
  stretch: { x: number; y: number };
  facing: 1 | -1;
  happiness: number; // 0..1
}

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

const BLINK_MS = 150;

export class Animator {
  private cur: RenderState = neutralRenderState();
  private prev: AnimState = "idle";
  private lookX = 0.5;
  private lookY = -0.2;

  /** Called when the active state changes; seed per-state randomness here. */
  private onEnter(state: AnimState) {
    if (state === "look") {
      this.lookX = (Math.random() * 2 - 1) * 0.8;
      this.lookY = (Math.random() * 2 - 1) * 0.5;
    }
  }

  frame(input: AnimInput): RenderState {
    if (input.state !== this.prev) {
      this.onEnter(input.state);
      this.prev = input.state;
    }

    const { time, elapsed } = input;
    const sleeping = input.state === "sleep";

    // ---- Base target for this frame ----
    const t = neutralRenderState();
    t.facing = input.facing;

    // Continuous life: breathing + tail sway + subtle idle bob/ear flick so the
    // pet always looks alive even when doing "nothing".
    const breathe = Math.sin(time / (sleeping ? 1700 : 900)) * (sleeping ? 0.03 : 0.02);
    t.scaleY = 1 + breathe;
    t.scaleX = 1 - breathe * 0.5;
    t.tailAngle = Math.sin(time / 620) * 8;
    t.earTwitch = Math.sin(time / 2100) * 0.12;
    t.offsetY = Math.sin(time / 1500) * 0.5;

    // Gaze (eyes follow cursor + a subtle body lean toward it).
    if (input.awake && input.gazeActive) {
      t.eyeX = clamp(input.gaze.x);
      t.eyeY = clamp(input.gaze.y);
      t.rotation = input.gaze.x * 2.5;
      t.offsetX = input.gaze.x * 1.5;
    }

    // ---- Per-state expression ----
    switch (input.state) {
      case "blink": {
        const p = clamp(elapsed / BLINK_MS, 0, 1);
        t.eyeOpen = Math.abs(Math.cos(p * Math.PI));
        break;
      }
      case "look": {
        t.eyeX = this.lookX;
        t.eyeY = this.lookY;
        t.rotation = this.lookX * 5;
        t.earTwitch = 0.3;
        break;
      }
      case "walk": {
        t.offsetY = -Math.abs(Math.sin(time / 110)) * 1.6;
        t.rotation = Math.sin(time / 110) * 2.5;
        break;
      }
      case "sit": {
        t.offsetY = 2;
        t.scaleY = 0.97 + breathe;
        t.scaleX = 1.03;
        t.tailAngle = 14 + Math.sin(time / 900) * 4;
        break;
      }
      case "sleep": {
        t.eyeOpen = 0.05;
        t.offsetY = 2;
        t.zzz = 1;
        t.tailAngle = 6 + Math.sin(time / 1600) * 3;
        break;
      }
      case "wake": {
        const p = clamp(elapsed / 800, 0, 1);
        t.eyeOpen = p;
        t.scaleY = 1 + 0.08 * Math.sin(p * Math.PI);
        break;
      }
      case "yawn": {
        const p = clamp(elapsed / 1100, 0, 1);
        t.mouth = "open";
        t.eyeOpen = 1 - 0.8 * Math.sin(p * Math.PI);
        t.scaleY = 1 + 0.06 * Math.sin(p * Math.PI);
        break;
      }
      case "stretch": {
        const p = clamp(elapsed / 1100, 0, 1);
        t.scaleY = 1 + 0.18 * Math.sin(p * Math.PI);
        t.scaleX = 1 - 0.1 * Math.sin(p * Math.PI);
        t.offsetY = -3 * Math.sin(p * Math.PI);
        break;
      }
      case "happy": {
        t.offsetY = -Math.abs(Math.sin(time / 95)) * 4.5;
        t.mouth = "smile";
        t.sparkle = 1;
        t.blush = 0.35;
        t.earTwitch = Math.sin(time / 120) * 0.5;
        break;
      }
      case "curious": {
        t.rotation = 10;
        t.question = 1;
        t.earTwitch = 0.6;
        t.pupilScale = 1.1;
        break;
      }
      case "surprised": {
        const p = clamp(elapsed / 850, 0, 1);
        t.offsetY = -7 * (1 - p);
        t.exclaim = 1;
        t.pupilScale = 1.25;
        t.mouth = "open";
        t.scaleY = 1.05;
        break;
      }
      case "petted": {
        t.eyeOpen = 0.14;
        t.mouth = "smile";
        t.blush = 1;
        t.offsetX = Math.sin(time / 120) * 1.6;
        t.earTwitch = Math.sin(time / 160) * 0.4;
        t.hearts = 1;
        t.tailAngle = Math.sin(time / 260) * 12;
        break;
      }
      case "purring": {
        t.eyeOpen = 0.2;
        t.mouth = "smile";
        t.blush = 0.7;
        t.hearts = 0.5;
        t.scaleX = 1 + Math.sin(time / 45) * 0.012; // subtle vibration
        break;
      }
      case "dragged": {
        // Handle it gently/slowly and it stays relaxed and smiles; yank it
        // around and it looks startled (Talking-Tom-like).
        const rough = Math.abs(input.stretch.x) + Math.abs(input.stretch.y) > 0.16;
        t.pupilScale = rough ? 1.25 : 1.05;
        t.mouth = rough ? "open" : "smile";
        t.eyeOpen = rough ? 1 : 0.55;
        t.blush = rough ? 0 : 0.4;
        t.earTwitch = clamp(input.stretch.x * 3);
        break;
      }
      case "dizzy": {
        t.rotation = Math.sin(time / 80) * 14;
        t.eyeX = Math.cos(time / 90) * 0.8;
        t.eyeY = Math.sin(time / 90) * 0.8;
        t.mouth = "open";
        t.sweat = 0.7;
        break;
      }
      case "hunting": {
        t.scaleY = 0.9 + breathe;
        t.scaleX = 1.06;
        t.offsetY = 2;
        t.pupilScale = 1.35;
        t.earTwitch = -0.5;
        t.tailAngle = Math.sin(time / 70) * 16;
        break;
      }
      case "kneading": {
        // Alternating front-paw knead while the user types; looks engaged.
        t.pawL = -3 * (0.5 + 0.5 * Math.sin(time / 140));
        t.pawR = -3 * (0.5 + 0.5 * Math.sin(time / 140 + Math.PI));
        t.earTwitch = 0.3;
        t.offsetY = -Math.abs(Math.sin(time / 140));
        t.eyeY = 0.2;
        break;
      }
      case "overheat": {
        t.heat = 1;
        t.steam = 1;
        t.sweat = 0.85;
        t.mouth = "open";
        t.eyeOpen = 1;
        t.pupilScale = 1.2;
        t.offsetX = Math.sin(time / 45) * 2.4; // frantic jitter
        t.rotation = Math.sin(time / 50) * 4;
        t.pawL = -3 * (0.5 + 0.5 * Math.sin(time / 70));
        t.pawR = -3 * (0.5 + 0.5 * Math.sin(time / 70 + Math.PI));
        break;
      }
      case "hurt": {
        // "Ow!" recoil: squeeze eyes, ears back, a decaying shake.
        const p = clamp(elapsed / 700, 0, 1);
        t.offsetY = -4 * (1 - p) - 1;
        t.rotation = Math.sin(time / 38) * 6 * (1 - p);
        t.eyeOpen = 0.15;
        t.mouth = "open";
        t.earTwitch = -0.7;
        t.exclaim = 1 - p;
        t.pupilScale = 1.15;
        break;
      }
      case "groom": {
        // Lick a front paw; head dips toward it.
        const cyc = 0.5 + 0.5 * Math.sin(time / 220);
        t.pawL = -7 * cyc;
        t.offsetY = 1 + cyc * 0.6;
        t.rotation = 4;
        t.eyeOpen = 0.4;
        t.mouth = "smile";
        break;
      }
      case "wiggle": {
        // Happy little shimmy.
        t.offsetX = Math.sin(time / 85) * 2.2;
        t.rotation = Math.sin(time / 85) * 4;
        t.mouth = "smile";
        t.blush = 0.3;
        t.sparkle = 0.6;
        t.earTwitch = Math.sin(time / 120) * 0.5;
        break;
      }
      case "idle":
      default:
        break;
    }

    // Drag spring / release bounce always contributes.
    t.scaleX += input.stretch.x;
    t.scaleY += input.stretch.y;

    // ---- Ease persistent state toward target ----
    const c = this.cur;
    c.scaleX = lerp(c.scaleX, t.scaleX, 0.3);
    c.scaleY = lerp(c.scaleY, t.scaleY, 0.3);
    c.offsetX = lerp(c.offsetX, t.offsetX, 0.3);
    c.offsetY = lerp(c.offsetY, t.offsetY, 0.35);
    c.rotation = lerp(c.rotation, t.rotation, 0.22);
    c.eyeX = lerp(c.eyeX, t.eyeX, 0.4);
    c.eyeY = lerp(c.eyeY, t.eyeY, 0.4);
    c.eyeOpen = lerp(c.eyeOpen, t.eyeOpen, 0.5);
    c.pupilScale = lerp(c.pupilScale, t.pupilScale, 0.3);
    c.blush = lerp(c.blush, t.blush, 0.15);
    c.earTwitch = lerp(c.earTwitch, t.earTwitch, 0.3);
    c.tailAngle = lerp(c.tailAngle, t.tailAngle, 0.25);
    c.pawL = lerp(c.pawL, t.pawL, 0.4);
    c.pawR = lerp(c.pawR, t.pawR, 0.4);
    c.heat = lerp(c.heat, t.heat, 0.12);
    c.steam = lerp(c.steam, t.steam, 0.2);
    c.hearts = lerp(c.hearts, t.hearts, 0.2);
    c.zzz = lerp(c.zzz, t.zzz, 0.15);
    c.sparkle = lerp(c.sparkle, t.sparkle, 0.2);
    c.exclaim = lerp(c.exclaim, t.exclaim, 0.35);
    c.question = lerp(c.question, t.question, 0.35);
    c.sweat = lerp(c.sweat, t.sweat, 0.25);

    // Discrete fields.
    c.mouth = t.mouth as Mouth;
    c.facing = t.facing;

    return c;
  }
}

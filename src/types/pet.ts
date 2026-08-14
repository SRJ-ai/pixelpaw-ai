/**
 * Core pet data model. Deliberately species-agnostic (§6): the app is built
 * around the generic `PetCharacter` shape, not hard-coded to one animal.
 */

export type Species =
  | "cat"
  | "dog"
  | "bunny"
  | "fox"
  | "panda"
  | "bird"
  | "robot"
  | "fantasy";

/** Animation states the state machine can be in (MVP subset of the full spec). */
/**
 * Every state the rig can play. The type is derived from the list rather than
 * written twice, so a state added here is immediately valid at runtime too —
 * anything that accepts a state name from outside (the chat's "dance") needs to
 * check it against something, and two hand-maintained copies would drift.
 */
export const ANIM_STATE_LIST = [
  "idle",
  "blink",
  "look",
  "walk",
  "sit",
  "sleep",
  "wake",
  "yawn",
  "stretch",
  "happy",
  "curious",
  "surprised",
  "petted",
  "purring",
  "dragged",
  "dizzy",
  "hunting",
  "kneading",
  "overheat",
  "hurt",
  "groom",
  "wiggle",
] as const;

export type AnimState = (typeof ANIM_STATE_LIST)[number];

export const ANIM_STATES: ReadonlySet<string> = new Set(ANIM_STATE_LIST);

export type Mouth = "neutral" | "smile" | "open" | "frown";

/** Recolorable appearance (§7). Every color is data, never hard-coded in art. */
/**
 * The bodies the rig can actually draw — a narrower thing than `Species` above,
 * which is the aspirational data model and still lists animals nothing has been
 * drawn for. Kept separate and named for what it is, because a picker offering
 * "bunny" that renders a cat would be a worse lie than a shorter list.
 *
 * Lives here rather than beside the character roster so `PetAppearance` can name
 * it without the two files importing each other.
 */
export const SPECIES = ["cat", "dog", "panda", "dragon"] as const;

export type RigSpecies = (typeof SPECIES)[number];

export interface PetAppearance {
  bodyColor: string;
  bellyColor: string;
  patternColor: string;
  innerEarColor: string;
  eyeColor: string;
  noseColor: string;
  /**
   * Overrides the body the chosen character came with.
   *
   * Undefined means "whatever this character is", which is what every preset
   * wants. Setting it decouples the body from the costume, so any of the six
   * colours can be worn on any of the four animals — which is a far larger
   * roster than shipping more presets would be.
   */
  species?: RigSpecies;
}

/** Slow-decaying persistent needs (§22). Stored later; defaults for now. */
export interface PetNeeds {
  happiness: number; // 0..1
  energy: number; // 0..1
  affection: number; // 0..1
}

export interface PetCharacter {
  id: string;
  name: string;
  species: Species;
  appearance: PetAppearance;
  needs: PetNeeds;
}

/**
 * Everything the renderer needs to draw ONE frame. Pure view state — the
 * animator produces it, `PixelCat` only displays it. This separation lets us
 * swap procedural animation for sprite sheets later without touching the art.
 */
export interface RenderState {
  // whole-body transform
  scaleX: number;
  scaleY: number;
  offsetX: number; // in cat viewBox units
  offsetY: number;
  rotation: number; // degrees
  facing: 1 | -1;
  // face
  eyeX: number; // pupil offset -1..1
  eyeY: number; // pupil offset -1..1
  eyeOpen: number; // 0 (closed) .. 1 (open)
  pupilScale: number; // dilation
  mouth: Mouth;
  blush: number; // 0..1
  earTwitch: number; // -1..1
  tailAngle: number; // degrees
  pawL: number; // front-paw lift (viewBox units, negative = up) for kneading
  pawR: number;
  heat: number; // 0..1 "overheating" red tint
  // floating effects (0..1 intensity each)
  hearts: number;
  zzz: number;
  sparkle: number;
  exclaim: number;
  question: number;
  sweat: number;
  steam: number;
}

export const DEFAULT_APPEARANCE: PetAppearance = {
  bodyColor: "#F6B26B", // warm orange (original design, not tied to any product)
  bellyColor: "#FFE7C7", // cream
  patternColor: "#E58E3A", // darker orange stripes
  innerEarColor: "#FFC2CE", // soft pink
  eyeColor: "#39B37A", // green
  noseColor: "#E86A92", // pink
};

export function neutralRenderState(): RenderState {
  return {
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    facing: 1,
    eyeX: 0,
    eyeY: 0,
    eyeOpen: 1,
    pupilScale: 1,
    mouth: "neutral",
    blush: 0,
    earTwitch: 0,
    tailAngle: 0,
    pawL: 0,
    pawR: 0,
    heat: 0,
    hearts: 0,
    zzz: 0,
    sparkle: 0,
    exclaim: 0,
    question: 0,
    sweat: 0,
    steam: 0,
  };
}

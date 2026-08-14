/**
 * Original character roster (§6, §52). These are ORIGINAL designs inspired by
 * broad archetypes (robot, caped hero, masked acrobat, armored tech, samurai) —
 * deliberately NOT copies of any existing copyrighted/trademarked character.
 * Each is expressed as base colors + a set of themed accessories rendered over
 * the shared animation rig, so every animation works for every character.
 */
import { DEFAULT_APPEARANCE, type PetAppearance } from "@/types/pet";

export interface Accessories {
  cape?: string; // cape color (hero)
  capeInner?: string;
  mask?: string; // domino mask color (masked / hero)
  emblem?: "star" | "paw" | null; // original chest emblem
  emblemColor?: string;
  headband?: string; // samurai headband color
  /** Badge worn on the headband. Defaults to "OG"; non-Latin script gets a
   *  deeper band and a script-capable font so it isn't clipped. */
  headbandText?: string;
  katana?: boolean; // samurai sheathed sword
  antenna?: string; // robot antenna bulb color
  bellyScreen?: boolean; // robot chest display
  armor?: string; // armored chest/shoulders color
  visor?: string; // tech brow visor color
  chestLight?: string; // tech chest light color
  /** Spectral glow behind the body (summoner). */
  aura?: string;
  /** A floating sigil above the head. Original geometry, not any real script. */
  rune?: string;
  /** Pointed mage hood. */
  hood?: string;
  /** Staff with a glowing orb, worn at the side like the katana. */
  staff?: string;
}

/**
 * Which animal the rig draws.
 *
 * Everything before this was one cat in six colourways, which is fine for a
 * costume but not for a different animal — a dog with pointed cat ears and
 * whiskers just reads as a badly coloured cat. Species swaps the parts that
 * actually carry the silhouette (ears, tail, muzzle, markings) and leaves the
 * PART ids alone, so every existing animation drives all three unchanged.
 */
/** What the rig can draw, re-exported so the roster reads naturally. */
export type { RigSpecies as Species } from "@/types/pet";
import type { RigSpecies as Species } from "@/types/pet";
import type { EntranceKind } from "@/pet/render/Entrance";

/**
 * Silhouette variation, which is what actually distinguishes creature designs.
 *
 * Recolouring is cheap and it shows: four dragons in four hues sharing one
 * outline read as one dragon with a palette slider, not as four characters. You
 * recognise a creature by its shape at a glance and its colour second, so the
 * shape is what has to differ.
 */
export interface Shape {
  horns?: "swept" | "curled" | "spiked";
  wings?: "bat" | "finned" | "none";
  /**
   * Ear shape, for the cat rig. Eight of the roster were one cat in different
   * colours with a prop on it, which is the same failure the dragons had: you
   * recognise an animal by its outline, so the outline is what has to change.
   */
  ears?: "pointed" | "tall" | "round" | "tufted";
  tail?: "curl" | "bushy" | "stub";
  /** A fan around the neck. Reads from further away than any horn. */
  frill?: boolean;
  /** Wider and lower, or narrower and taller, than the default body. */
  build?: "stocky" | "slim";
}

export interface CharacterTheme {
  id: string;
  name: string;
  blurb: string;
  /**
   * What it says when you switch to it. Written for this project — the
   * archetype's voice, not a quotation from anything.
   */
  line?: string;
  /** Defaults to "cat" — the roster that existed before species did. */
  species?: Species;
  /** The flourish it makes when you switch to it. */
  entrance?: { kind: EntranceKind; color: string };
  /** Silhouette tweaks. Omitted means the species' own default outline. */
  shape?: Shape;
  appearance: PetAppearance;
  accessories: Accessories;
}

export const CHARACTERS: CharacterTheme[] = [
  {
    id: "classic",
    name: "Pixel",
    entrance: { kind: "puff", color: "#ffd23f" },
    line: "Reporting for duty. Mostly.",
    blurb: "The original companion.",
    appearance: { ...DEFAULT_APPEARANCE },
    accessories: {},
  },
  {
    id: "robot",
    name: "Bolt",
    entrance: { kind: "spark", color: "#2fd3e6" },
    shape: { ears: "round", tail: "stub", build: "stocky" },
    line: "Systems nominal. Mood: excellent.",
    blurb: "A friendly gadget-bot.",
    appearance: {
      bodyColor: "#9fb3c8",
      bellyColor: "#dbe6f0",
      patternColor: "#7387a0",
      innerEarColor: "#b7c7d8",
      eyeColor: "#2fd3e6",
      noseColor: "#596b7a",
    },
    accessories: { antenna: "#ff5c5c", bellyScreen: true },
  },
  {
    id: "hero",
    name: "Captain Paw",
    entrance: { kind: "dash", color: "#ffd23f" },
    shape: { ears: "tall", tail: "bushy" },
    line: "Naps defended. You are welcome.",
    blurb: "Caped defender of naps.",
    appearance: {
      bodyColor: "#e8a24a",
      bellyColor: "#ffe7c7",
      patternColor: "#cf8534",
      innerEarColor: "#ffc2ce",
      eyeColor: "#2e7dd7",
      noseColor: "#e86a92",
    },
    accessories: { cape: "#d23b3b", capeInner: "#9e2a2a", emblem: "star", emblemColor: "#ffd23f", mask: "#22357a" },
  },
  {
    id: "acrobat",
    name: "Web-Whiskers",
    entrance: { kind: "dash", color: "#e0446a" },
    shape: { ears: "tall", tail: "curl", build: "slim" },
    line: "Nothing gets past these whiskers.",
    blurb: "A masked wall-crawler.",
    appearance: {
      bodyColor: "#c8324b",
      bellyColor: "#274a86",
      patternColor: "#9e2438",
      innerEarColor: "#e08aa0",
      eyeColor: "#ffffff",
      noseColor: "#2a2f45",
    },
    accessories: { mask: "#26417d" },
  },
  {
    id: "tech",
    name: "Iron Paw",
    entrance: { kind: "spark", color: "#5ad1ff" },
    shape: { ears: "round", tail: "stub", build: "stocky" },
    line: "Suited up. Try to keep pace.",
    blurb: "Armored tech hero.",
    appearance: {
      bodyColor: "#b3b8bf",
      bellyColor: "#d7dbe0",
      patternColor: "#8b9098",
      innerEarColor: "#c6b48a",
      eyeColor: "#4fd1ff",
      noseColor: "#6a6f75",
    },
    accessories: { armor: "#c9463a", visor: "#ffd23f", chestLight: "#5ad1ff" },
  },
  {
    id: "dog",
    name: "Biscuit",
    entrance: { kind: "puff", color: "#f6e3c4" },
    line: "You came back! You came back!",
    species: "dog",
    blurb: "Ears down, tail up, waiting.",
    appearance: {
      bodyColor: "#d9a25c",
      bellyColor: "#f6e3c4",
      // Doubles as the ear/muzzle shading on the dog rig.
      patternColor: "#b07f3f",
      innerEarColor: "#c98f4d",
      eyeColor: "#5b3a1e",
      noseColor: "#3a2a20",
    },
    accessories: {},
  },
  {
    id: "panda",
    name: "Bamboo",
    entrance: { kind: "puff", color: "#ffffff" },
    line: "I was resting. I will resume resting.",
    species: "panda",
    blurb: "Unbothered. Well rested.",
    appearance: {
      bodyColor: "#f4f1ea",
      bellyColor: "#ffffff",
      // The panda rig paints ears, patches and paws with this, so it is the
      // marking colour rather than a stripe colour here.
      patternColor: "#25272d",
      innerEarColor: "#3a3d45",
      eyeColor: "#2c2f36",
      noseColor: "#25272d",
    },
    accessories: {},
  },
  {
    id: "dragon",
    name: "Emberling",
    entrance: { kind: "roar", color: "#8fa4e8" },
    line: "Small. Winged. Unimpressed.",
    species: "dragon",
    shape: { horns: "swept", wings: "bat" },
    blurb: "Small dragon. Big opinions.",
    appearance: {
      bodyColor: "#4b6bd6",
      bellyColor: "#cfd9ff",
      // Horns, wing membrane and tail spines all read off this.
      patternColor: "#2c3f8f",
      innerEarColor: "#8fa4e8",
      eyeColor: "#ffc93a",
      noseColor: "#2c3f8f",
    },
    accessories: {},
  },
  {
    id: "dragon-ember",
    name: "Cinder",
    entrance: { kind: "roar", color: "#ff8a3d" },
    line: "Careful — I run hot.",
    species: "dragon",
    shape: { horns: "spiked", wings: "bat", build: "stocky", frill: true },
    blurb: "Warm to the touch. Ask first.",
    appearance: {
      bodyColor: "#e05a2b",
      bellyColor: "#ffd9a8",
      patternColor: "#a3341a",
      innerEarColor: "#ffab5e",
      eyeColor: "#ffe14d",
      noseColor: "#7d2712",
    },
    accessories: { aura: "#ff8a3d" },
  },
  {
    id: "dragon-storm",
    name: "Volt",
    entrance: { kind: "spark", color: "#ffe14d" },
    line: "Hair standing up? That is me.",
    species: "dragon",
    shape: { horns: "spiked", wings: "none", build: "slim" },
    blurb: "Static in the whiskers.",
    appearance: {
      bodyColor: "#f2c53d",
      bellyColor: "#fff4c2",
      patternColor: "#9a7410",
      innerEarColor: "#ffe07a",
      eyeColor: "#3ad0ff",
      noseColor: "#6b4f08",
    },
    accessories: { aura: "#ffe14d" },
  },
  {
    id: "dragon-frost",
    name: "Rime",
    entrance: { kind: "roar", color: "#9fe8ff" },
    line: "Cold paws. Warm intentions.",
    species: "dragon",
    shape: { horns: "curled", wings: "finned", build: "stocky" },
    blurb: "Prefers the window seat.",
    appearance: {
      bodyColor: "#7fd4e8",
      bellyColor: "#e8fbff",
      patternColor: "#3f92ad",
      innerEarColor: "#bdeeff",
      eyeColor: "#2f6f8f",
      noseColor: "#2f6f8f",
    },
    accessories: { aura: "#9fe8ff" },
  },
  {
    id: "summoner",
    name: "Umbra",
    entrance: { kind: "bloom", color: "#b39cff" },
    shape: { ears: "tufted", tail: "bushy", build: "slim" },
    line: "The shadows and I have an arrangement.",
    blurb: "Commands what the light leaves behind.",
    appearance: {
      bodyColor: "#2f3140",
      bellyColor: "#474b60",
      patternColor: "#1d1e28",
      innerEarColor: "#5b4b78",
      eyeColor: "#8f6bff",
      noseColor: "#1d1e28",
    },
    // An original archetype: a shadow-summoner in dark plate with a sigil
    // overhead. Deliberately generic — no existing character is referenced.
    // The plate has to be well clear of the body colour: at #3b3d52 against a
    // #2f3140 body it was two shades apart and simply disappeared.
    accessories: { armor: "#6a6f96", aura: "#8f6bff", rune: "#b39cff" },
  },
  {
    id: "mage",
    name: "Hexpaw",
    entrance: { kind: "bloom", color: "#5ce1c4" },
    shape: { ears: "tufted", tail: "bushy" },
    line: "I can read the old marks. Most of them.",
    blurb: "Reads the old marks. Mostly correctly.",
    appearance: {
      bodyColor: "#6b5bb5",
      bellyColor: "#d8cff2",
      patternColor: "#4a3d85",
      innerEarColor: "#b9a8e8",
      eyeColor: "#5ce1c4",
      noseColor: "#4a3d85",
    },
    accessories: { hood: "#3b2f6b", staff: "#c9a227", rune: "#5ce1c4" },
  },
  {
    id: "samurai",
    name: "OG Ronin",
    entrance: { kind: "slash", color: "#ffd23f" },
    shape: { ears: "tufted", tail: "curl", build: "stocky" },
    // Already had a voice: the entrance cinematic says this too.
    line: "ఏం చేద్దాం బాస్?",
    blurb: "A lone samurai cat. ఏం చేద్దాం బాస్?",
    appearance: {
      bodyColor: "#4a4e57",
      bellyColor: "#6c717b",
      patternColor: "#2e3138",
      innerEarColor: "#8a5a5a",
      eyeColor: "#ffca3a",
      noseColor: "#2e3138",
    },
    accessories: { headband: "#c0392b", headbandText: "ఓజీ", katana: true },
  },
];

export function characterById(id: string): CharacterTheme {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

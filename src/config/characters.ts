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
export type Species = "cat" | "dog" | "panda" | "dragon";

export interface CharacterTheme {
  id: string;
  name: string;
  blurb: string;
  /** Defaults to "cat" — the roster that existed before species did. */
  species?: Species;
  appearance: PetAppearance;
  accessories: Accessories;
}

export const CHARACTERS: CharacterTheme[] = [
  {
    id: "classic",
    name: "Pixel",
    blurb: "The original companion.",
    appearance: { ...DEFAULT_APPEARANCE },
    accessories: {},
  },
  {
    id: "robot",
    name: "Bolt",
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
    species: "dragon",
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
    id: "summoner",
    name: "Umbra",
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

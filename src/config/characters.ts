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
}

export interface CharacterTheme {
  id: string;
  name: string;
  blurb: string;
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

/**
 * Binds the addressable parts of the PixelCat SVG and applies a `RenderState`
 * to them each frame by mutating transforms/opacity directly (no React re-render
 * in the hot path — the SVG structure is rendered once, the animator drives it).
 */
import type { Mouth, RenderState } from "@/types/pet";

export const PART = {
  body: "pp-body",
  tail: "pp-tail",
  earL: "pp-earL",
  earR: "pp-earR",
  eyeL: "pp-eyeL",
  eyeR: "pp-eyeR",
  pupilL: "pp-pupilL",
  pupilR: "pp-pupilR",
  pawL: "pp-pawL",
  pawR: "pp-pawR",
  blushL: "pp-blushL",
  blushR: "pp-blushR",
  mouthNeutral: "pp-mouth-neutral",
  mouthSmile: "pp-mouth-smile",
  mouthOpen: "pp-mouth-open",
  mouthFrown: "pp-mouth-frown",
  fxHearts: "pp-fx-hearts",
  fxZzz: "pp-fx-zzz",
  fxSparkle: "pp-fx-sparkle",
  fxExclaim: "pp-fx-exclaim",
  fxQuestion: "pp-fx-question",
  fxSweat: "pp-fx-sweat",
  fxSteam: "pp-fx-steam",
} as const;

const EYE_RANGE = 2.4; // user units of pupil travel at full gaze

export interface PetParts {
  body: SVGGElement;
  tail: SVGGElement;
  earL: SVGGElement;
  earR: SVGGElement;
  eyeL: SVGGElement;
  eyeR: SVGGElement;
  pupilL: SVGGElement;
  pupilR: SVGGElement;
  pawL: SVGGElement;
  pawR: SVGGElement;
  blushL: SVGElement;
  blushR: SVGElement;
  mouths: Record<Mouth, SVGGElement>;
  fx: {
    hearts: SVGGElement;
    zzz: SVGGElement;
    sparkle: SVGGElement;
    exclaim: SVGGElement;
    question: SVGGElement;
    sweat: SVGGElement;
    steam: SVGGElement;
  };
}

function q<T extends Element>(root: ParentNode, id: string): T {
  const el = root.querySelector<T>("#" + id);
  if (!el) throw new Error("PixelCat: missing part #" + id);
  return el;
}

export function bindParts(svg: SVGSVGElement): PetParts {
  return {
    body: q<SVGGElement>(svg, PART.body),
    tail: q<SVGGElement>(svg, PART.tail),
    earL: q<SVGGElement>(svg, PART.earL),
    earR: q<SVGGElement>(svg, PART.earR),
    eyeL: q<SVGGElement>(svg, PART.eyeL),
    eyeR: q<SVGGElement>(svg, PART.eyeR),
    pupilL: q<SVGGElement>(svg, PART.pupilL),
    pupilR: q<SVGGElement>(svg, PART.pupilR),
    pawL: q<SVGGElement>(svg, PART.pawL),
    pawR: q<SVGGElement>(svg, PART.pawR),
    blushL: q<SVGElement>(svg, PART.blushL),
    blushR: q<SVGElement>(svg, PART.blushR),
    mouths: {
      neutral: q<SVGGElement>(svg, PART.mouthNeutral),
      smile: q<SVGGElement>(svg, PART.mouthSmile),
      open: q<SVGGElement>(svg, PART.mouthOpen),
      frown: q<SVGGElement>(svg, PART.mouthFrown),
    },
    fx: {
      hearts: q<SVGGElement>(svg, PART.fxHearts),
      zzz: q<SVGGElement>(svg, PART.fxZzz),
      sparkle: q<SVGGElement>(svg, PART.fxSparkle),
      exclaim: q<SVGGElement>(svg, PART.fxExclaim),
      question: q<SVGGElement>(svg, PART.fxQuestion),
      sweat: q<SVGGElement>(svg, PART.fxSweat),
      steam: q<SVGGElement>(svg, PART.fxSteam),
    },
  };
}

function fx(el: SVGGElement, intensity: number) {
  el.style.opacity = intensity <= 0.01 ? "0" : String(Math.min(1, intensity));
}

export function applyRenderState(p: PetParts, rs: RenderState): void {
  // Whole body: squash/stretch + bob + lean + facing flip (origin at the feet).
  p.body.style.transform =
    `translate(${rs.offsetX}px, ${rs.offsetY}px) ` +
    `rotate(${rs.rotation}deg) ` +
    `scale(${rs.scaleX * rs.facing}, ${rs.scaleY})`;

  // Overheat tint: push the palette toward red without recoloring the art.
  p.body.style.filter =
    rs.heat > 0.01
      ? `saturate(${1 + rs.heat * 1.4}) hue-rotate(-${rs.heat * 24}deg) brightness(${1 + rs.heat * 0.06})`
      : "";

  // Front paws (kneading lift).
  p.pawL.style.transform = `translate(0px, ${rs.pawL}px)`;
  p.pawR.style.transform = `translate(0px, ${rs.pawR}px)`;

  // Blink: squash eyes vertically. Clamp so a closed eye stays a thin line.
  const open = Math.max(0.06, rs.eyeOpen);
  p.eyeL.style.transform = `scale(1, ${open})`;
  p.eyeR.style.transform = `scale(1, ${open})`;

  // Gaze: move pupils toward the cursor + dilation.
  const px = rs.eyeX * EYE_RANGE;
  const py = rs.eyeY * EYE_RANGE;
  p.pupilL.style.transform = `translate(${px}px, ${py}px) scale(${rs.pupilScale})`;
  p.pupilR.style.transform = `translate(${px}px, ${py}px) scale(${rs.pupilScale})`;

  // Ears twitch, tail wags.
  p.earL.style.transform = `rotate(${-rs.earTwitch * 8}deg)`;
  p.earR.style.transform = `rotate(${rs.earTwitch * 8}deg)`;
  p.tail.style.transform = `rotate(${rs.tailAngle}deg)`;

  // Cheeks.
  p.blushL.style.opacity = String(rs.blush);
  p.blushR.style.opacity = String(rs.blush);

  // Mouth: only the active one is visible.
  (Object.keys(p.mouths) as Mouth[]).forEach((m) => {
    p.mouths[m].style.display = m === rs.mouth ? "inline" : "none";
  });

  // Floating effects.
  fx(p.fx.hearts, rs.hearts);
  fx(p.fx.zzz, rs.zzz);
  fx(p.fx.sparkle, rs.sparkle);
  fx(p.fx.exclaim, rs.exclaim);
  fx(p.fx.question, rs.question);
  fx(p.fx.sweat, rs.sweat);
  fx(p.fx.steam, rs.steam);
}

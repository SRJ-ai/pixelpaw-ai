import { forwardRef } from "react";
import type { PetAppearance } from "@/types/pet";
import type { Accessories, Species } from "@/config/characters";
import { PART } from "./parts";

/**
 * Original, recolorable pixel-inspired companion + themed accessory layers.
 * Rendered ONCE; every moving part carries a stable id (see `PART`) so the
 * animator drives it imperatively. Accessories are original archetype pieces
 * (cape, mask, katana, antenna, armor…) layered over the same rig, so all
 * animation works for every character. No animation logic lives here — this is
 * purely anatomy + costume.
 *
 * Three species share the rig. Only the parts that carry the silhouette differ
 * — ears, tail, muzzle and markings — and they keep the same ids, so a species
 * is a drawing change and never an animation change.
 */

interface Props {
  appearance: PetAppearance;
  accessories?: Accessories;
  /** Which animal to draw. Defaults to the cat the rig started as. */
  species?: Species;
  /** Ambient cosmic decor (stars + a stylized black hole) behind the pet. */
  decor?: boolean;
}

const HEART =
  "M0 1.2 C -1 -0.4 -3.4 0.2 -3.4 2 C -3.4 3.8 0 5.8 0 5.8 C 0 5.8 3.4 3.8 3.4 2 C 3.4 0.2 1 -0.4 0 1.2 Z";
const STAR = "M0 -3 L0.9 -0.9 L3 0 L0.9 0.9 L0 3 L-0.9 0.9 L-3 0 L-0.9 -0.9 Z";
const OUTLINE = "rgba(60,40,30,0.32)";

const originFeet = { transformBox: "fill-box", transformOrigin: "50% 100%" } as const;
const originCenter = { transformBox: "fill-box", transformOrigin: "center" } as const;
const originBase = { transformBox: "fill-box", transformOrigin: "0% 100%" } as const;

/** Anything outside Basic Latin needs the script-capable font + taller band. */
const isLatin = (s: string) => /^[\x20-\x7e]*$/.test(s);

export const PixelCat = forwardRef<SVGSVGElement, Props>(function PixelCat(
  { appearance: a, accessories: acc = {}, species = "cat", decor = false },
  ref
) {
  const badge = acc.headbandText ?? "OG";
  const teluguBadge = !isLatin(badge);
  const isCat = species === "cat";
  const isPanda = species === "panda";
  // On the panda, patternColor is the marking colour: ears, eye patches and
  // paws are all the same black, which is what makes the animal readable at
  // 100px on a wallpaper.
  const mark = isPanda ? a.patternColor : a.bodyColor;

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <radialGradient id="pp-sheen" cx="40%" cy="36%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pp-star-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="45%" stopColor="#cfe4ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#cfe4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pp-bh-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#05060a" />
          <stop offset="70%" stopColor="#120a24" />
          <stop offset="100%" stopColor="#241436" />
        </radialGradient>
        <radialGradient id="pp-bh-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7a5cff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#7a5cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pp-bh-ring" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="50%" stopColor="#ff5ca8" />
          <stop offset="100%" stopColor="#7a5cff" />
        </linearGradient>
      </defs>

      {/* -------- AMBIENT COSMIC DECOR (behind the pet) -------- */}
      {decor && (
        <g id="pp-decor">
          <g fill="url(#pp-star-glow)">
            <circle className="pp-star" cx="70" cy="18" r="3" />
            <circle className="pp-star pp-delay-1" cx="83" cy="30" r="2.2" />
            <circle className="pp-star pp-delay-2" cx="60" cy="11" r="1.7" />
            <circle className="pp-star pp-delay-1" cx="13" cy="47" r="2.4" />
            <circle className="pp-star" cx="89" cy="52" r="1.6" />
            <circle className="pp-star pp-delay-2" cx="31" cy="13" r="2" />
          </g>
          <g className="pp-bh" transform="translate(18 21)">
            <circle r="15" fill="url(#pp-bh-glow)" />
            <ellipse className="pp-bh-ring" rx="14" ry="5" fill="none" stroke="url(#pp-bh-ring)" strokeWidth="2.8" />
            <circle r="6" fill="url(#pp-bh-core)" />
          </g>
        </g>
      )}

      {/* -------- BODY (everything that squashes/stretches together) -------- */}
      <g id={PART.body} style={originFeet as React.CSSProperties}>
        {/* Cape (behind everything) */}
        {acc.cape && (
          <g>
            <path
              d="M33 42 C 18 60, 20 92, 30 96 L 50 90 L 70 96 C 80 92, 82 60, 67 42 C 58 50, 42 50, 33 42 Z"
              fill={acc.cape}
            />
            <path
              d="M42 46 C 36 62, 38 86, 44 92 L 50 88 L 56 92 C 62 86, 64 62, 58 46 C 54 50, 46 50, 42 46 Z"
              fill={acc.capeInner ?? acc.cape}
              opacity="0.55"
            />
          </g>
        )}

        {/* Sheathed katana, worn at the side (clearly visible left of the body) */}
        {acc.katana && (
          <g transform="rotate(-10 16 62)">
            <line x1="16" y1="40" x2="16" y2="86" stroke="#20232a" strokeWidth="4.8" strokeLinecap="round" />
            <line x1="16" y1="40" x2="16" y2="30" stroke="#7a5b34" strokeWidth="3.6" strokeLinecap="round" />
            <line x1="11" y1="40" x2="21" y2="40" stroke="#d9b45a" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="16" cy="29" r="1.8" fill="#c0392b" />
          </g>
        )}

        {/* Tail. The cat sweeps, the dog cocks up short, the panda has a stub. */}
        <g id={PART.tail} style={originBase as React.CSSProperties}>
          {species === "cat" && (
            <path
              d="M74 82 Q95 80 90 58 Q88 49 82 52 Q89 66 73 75 Z"
              fill={a.bodyColor}
              stroke={OUTLINE}
              strokeWidth={1}
            />
          )}
          {species === "dog" && (
            <path
              d="M73 80 Q86 79 86 67 Q86 60 80 62 Q84 72 72 75 Z"
              fill={a.bodyColor}
              stroke={OUTLINE}
              strokeWidth={1}
            />
          )}
          {isPanda && (
            // Tucked against the body, not beside it. The tail group is drawn
            // behind the torso, so this reads as a stub peeking out — at cx 77
            // it cleared the silhouette entirely and looked like a stray dot.
            <ellipse cx="73" cy="78" rx="5.5" ry="5" fill={a.bellyColor} stroke={OUTLINE} strokeWidth={1} />
          )}
        </g>

        {/* Ears. Same ids and same pivot, so the ear-flick animation is shared. */}
        <g id={PART.earL} style={originFeet as React.CSSProperties}>
          {species === "cat" && (
            <>
              <path d="M27 40 L45 37 L32 15 Z" fill={a.bodyColor} stroke={OUTLINE} strokeWidth={1} />
              <path d="M32 37 L41 35 L34 22 Z" fill={a.innerEarColor} />
            </>
          )}
          {species === "dog" && (
            <>
              {/* Anchored below the crown. Starting at the very top of the
                  head made both ears meet across it, which read as the brim of
                  a helmet rather than as ears set on the sides. */}
              <path
                d="M31 38 Q19 39 18 52 Q17 65 27 66 Q34 63 34 50 Q34 41 31 38 Z"
                fill={a.patternColor}
                stroke={OUTLINE}
                strokeWidth={1}
              />
              <path d="M30 43 Q24 45 23.5 53 Q23 61 28 62 Q31 59 31 51 Z" fill={a.innerEarColor} />
            </>
          )}
          {isPanda && (
            <>
              <circle cx="31" cy="28" r="9.5" fill={mark} stroke={OUTLINE} strokeWidth={1} />
              <circle cx="31" cy="28" r="4.6" fill={a.innerEarColor} />
            </>
          )}
        </g>
        <g id={PART.earR} style={originFeet as React.CSSProperties}>
          {species === "cat" && (
            <>
              <path d="M73 40 L55 37 L68 15 Z" fill={a.bodyColor} stroke={OUTLINE} strokeWidth={1} />
              <path d="M68 37 L59 35 L66 22 Z" fill={a.innerEarColor} />
            </>
          )}
          {species === "dog" && (
            <>
              <path
                d="M69 38 Q81 39 82 52 Q83 65 73 66 Q66 63 66 50 Q66 41 69 38 Z"
                fill={a.patternColor}
                stroke={OUTLINE}
                strokeWidth={1}
              />
              <path d="M70 43 Q76 45 76.5 53 Q77 61 72 62 Q69 59 69 51 Z" fill={a.innerEarColor} />
            </>
          )}
          {isPanda && (
            <>
              <circle cx="69" cy="28" r="9.5" fill={mark} stroke={OUTLINE} strokeWidth={1} />
              <circle cx="69" cy="28" r="4.6" fill={a.innerEarColor} />
            </>
          )}
        </g>

        {/* Robot antenna (on top of head) */}
        {acc.antenna && (
          <g>
            <line x1="50" y1="30" x2="50" y2="17" stroke="#7387a0" strokeWidth="2" />
            <circle cx="50" cy="14.5" r="3.2" fill={acc.antenna} />
          </g>
        )}

        {/* Torso / head blob */}
        <rect x="24" y="30" width="52" height="58" rx="22" fill={a.bodyColor} stroke={OUTLINE} strokeWidth={1} />
        <ellipse cx="50" cy="72" rx="15" ry="17" fill={a.bellyColor} />
        {/* Forehead tabby marks — a cat thing, and wrong on the other two. */}
        {isCat && (
          <>
            <rect x="47" y="31" width="6" height="3" rx="1.5" fill={a.patternColor} />
            <rect x="40.5" y="33" width="5" height="2.4" rx="1.2" fill={a.patternColor} />
            <rect x="54.5" y="33" width="5" height="2.4" rx="1.2" fill={a.patternColor} />
          </>
        )}
        {/* The panda's arms. Two shapes rather than one band across the body:
            the torso's bottom corners are rounded (rx 22), so a straight band
            overhung the silhouette on both sides and read as a black bar laid
            over the animal. These are inset to stay within the curve, and they
            run down into the paws so arm and hand read as one limb. */}
        {isPanda && (
          <g fill={mark}>
            <ellipse cx="35.5" cy="78" rx="6" ry="9" />
            <ellipse cx="64.5" cy="78" rx="6" ry="9" />
          </g>
        )}

        {/* Subtle shading */}
        <ellipse cx="45" cy="48" rx="22" ry="19" fill="url(#pp-sheen)" style={{ pointerEvents: "none" }} />
        <ellipse cx="50" cy="84" rx="23" ry="10" fill="#000000" opacity="0.06" />

        {/* Front paws (kneading-capable) */}
        <g id={PART.pawL} style={originCenter as React.CSSProperties}>
          <ellipse cx="39" cy="87" rx="6.5" ry="4" fill={mark} stroke={OUTLINE} strokeWidth={1} />
        </g>
        <g id={PART.pawR} style={originCenter as React.CSSProperties}>
          <ellipse cx="61" cy="87" rx="6.5" ry="4" fill={mark} stroke={OUTLINE} strokeWidth={1} />
        </g>

        {/* Robot belly screen */}
        {acc.bellyScreen && (
          <g>
            <rect x="40" y="66" width="20" height="14" rx="4" fill="#161d29" />
            <circle cx="46" cy="72" r="1.6" fill="#39d98a" />
            <circle cx="54" cy="72" r="1.6" fill="#39d98a" />
            <path d="M45 76 q5 3 10 0" stroke="#39d98a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </g>
        )}

        {/* Armored chest plate (tech) */}
        {acc.armor && (
          <path d="M37 71 Q50 67 63 71 L61 86 Q50 90 39 86 Z" fill={acc.armor} stroke={OUTLINE} strokeWidth={0.8} />
        )}

        {/* Chest light (tech) */}
        {acc.chestLight && (
          <g>
            <circle cx="50" cy="76" r="4.6" fill="#0d1b2a" />
            <circle cx="50" cy="76" r="3" fill={acc.chestLight} />
            <circle cx="50" cy="76" r="1.3" fill="#eaffff" />
          </g>
        )}

        {/* Chest emblem (hero) */}
        {acc.emblem === "star" && (
          <path d={STAR} transform="translate(50 74) scale(1.7)" fill={acc.emblemColor ?? "#ffd23f"} />
        )}

        {/* Samurai headband with its badge. Telugu script carries taller vowel
            signs than Latin, so it gets a deeper band and a script-capable font
            rather than being squeezed into the Latin metrics. */}
        {acc.headband && (
          <g>
            <path
              d={teluguBadge ? "M27 35.4 Q50 29.9 73 35.4 L73 44.2 Q50 39.6 27 44.2 Z" : "M27 38 Q50 33 73 38 L73 43 Q50 39 27 43 Z"}
              fill={acc.headband}
            />
            <path d="M27 40 l-9 -3 l3 6 l-8 2 l7 3 l-2 6 l8 -5 z" fill={acc.headband} />
            <text
              x="50"
              y={teluguBadge ? 42.1 : 41.9}
              fontSize={teluguBadge ? 6.2 : 4.6}
              fontWeight="900"
              textAnchor="middle"
              fill="#fff5e6"
              fontFamily={
                teluguBadge
                  ? '"Nirmala UI", Gautami, "Noto Sans Telugu", system-ui, sans-serif'
                  : "system-ui, sans-serif"
              }
              letterSpacing={teluguBadge ? 0 : 0.4}
            >
              {badge}
            </text>
          </g>
        )}

        {/* -------- FACE -------- */}
        {/* Domino mask (behind the eyes) */}
        {acc.mask && (
          <path
            d="M30 50 Q50 45 70 50 Q73 60 62 61 Q50 56 38 61 Q27 60 30 50 Z"
            fill={acc.mask}
          />
        )}

        {/* Whiskers — cat only. On a dog or a panda they read as a mistake. */}
        {isCat && (
          <g stroke="#ececef" strokeWidth="0.8" opacity="0.7" strokeLinecap="round">
            <line x1="30" y1="58" x2="15" y2="55" />
            <line x1="30" y1="61" x2="13" y2="61" />
            <line x1="30" y1="64" x2="15" y2="67" />
            <line x1="70" y1="58" x2="85" y2="55" />
            <line x1="70" y1="61" x2="87" y2="61" />
            <line x1="70" y1="64" x2="85" y2="67" />
          </g>
        )}

        {/* Panda eye patches, behind the eyes. Tilted outward, which is what
            separates a panda from a raccoon. */}
        {isPanda && (
          <g fill={mark}>
            <ellipse cx="37" cy="53" rx="9" ry="10.5" transform="rotate(-20 37 53)" />
            <ellipse cx="63" cy="53" rx="9" ry="10.5" transform="rotate(20 63 53)" />
          </g>
        )}

        {/* Eyes */}
        <g id={PART.eyeL} style={originCenter as React.CSSProperties}>
          <ellipse cx="38" cy="53" rx="6" ry="7" fill="#ffffff" stroke={OUTLINE} strokeWidth={0.6} />
          <g id={PART.pupilL} style={originCenter as React.CSSProperties}>
            <circle cx="38" cy="53.5" r="4.2" fill={a.eyeColor} />
            <circle cx="38" cy="54.5" r="2.3" fill="#23262c" />
            <circle cx="36.3" cy="51.5" r="1.2" fill="#ffffff" />
          </g>
        </g>
        <g id={PART.eyeR} style={originCenter as React.CSSProperties}>
          <ellipse cx="62" cy="53" rx="6" ry="7" fill="#ffffff" stroke={OUTLINE} strokeWidth={0.6} />
          <g id={PART.pupilR} style={originCenter as React.CSSProperties}>
            <circle cx="62" cy="53.5" r="4.2" fill={a.eyeColor} />
            <circle cx="62" cy="54.5" r="2.3" fill="#23262c" />
            <circle cx="60.3" cy="51.5" r="1.2" fill="#ffffff" />
          </g>
        </g>

        {/* Tech brow visor (above the eyes) */}
        {acc.visor && <rect x="31" y="44.5" width="38" height="4.5" rx="2.2" fill={acc.visor} />}

        {/* Blush */}
        <ellipse id={PART.blushL} cx="31" cy="60" rx="4" ry="2.4" fill="#ff9db0" opacity="0" />
        <ellipse id={PART.blushR} cx="69" cy="60" rx="4" ry="2.4" fill="#ff9db0" opacity="0" />

        {/* Muzzle — the dog's snout is the other half of its silhouette; the
            ears alone still read feline without it. */}
        {species === "dog" && (
          <ellipse cx="50" cy="66.5" rx="13" ry="7" fill={a.bellyColor} opacity="0.9" />
        )}

        {/* Nose. A cat's is a small triangle; the other two are rounded and
            noticeably bigger. */}
        {isCat ? (
          <path d="M47 61 L53 61 L50 65 Z" fill={a.noseColor} />
        ) : (
          <ellipse cx="50" cy="61.5" rx="4.4" ry="3.2" fill={a.noseColor} />
        )}

        {/* Mouths (only one shown at a time) */}
        <g id={PART.mouthNeutral} fill="none" stroke="#5a4636" strokeWidth="1.3" strokeLinecap="round">
          <path d="M50 65 L50 68" />
          <path d="M44 68 Q47 71 50 68" />
          <path d="M50 68 Q53 71 56 68" />
        </g>
        <g id={PART.mouthSmile} style={{ display: "none" }} fill="none" stroke="#5a4636" strokeWidth="1.3" strokeLinecap="round">
          <path d="M50 65 L50 67" />
          <path d="M43 66 Q50 74 57 66" />
        </g>
        <g id={PART.mouthOpen} style={{ display: "none" }}>
          <ellipse cx="50" cy="69" rx="3.4" ry="4" fill="#7a3b4a" />
          <ellipse cx="50" cy="71" rx="2.1" ry="1.7" fill="#ef7a90" />
        </g>
        <g id={PART.mouthFrown} style={{ display: "none" }} fill="none" stroke="#5a4636" strokeWidth="1.3" strokeLinecap="round">
          <path d="M50 65 L50 68" />
          <path d="M44 72 Q50 65 56 72" />
        </g>
      </g>

      {/* -------- FLOATING EFFECTS (not affected by body squash) -------- */}
      <g id={PART.fxHearts} style={{ opacity: 0 }}>
        <g transform="translate(66 30)"><path className="pp-heart" d={HEART} fill="#ff5c8a" /></g>
        <g transform="translate(74 22)"><path className="pp-heart pp-delay-1" d={HEART} fill="#ff7ba3" /></g>
        <g transform="translate(58 24)"><path className="pp-heart pp-delay-2" d={HEART} fill="#ff9db8" /></g>
      </g>

      <g id={PART.fxZzz} style={{ opacity: 0 }} fill="#8bb0d8" fontFamily="monospace" fontWeight="700">
        <text className="pp-zzz pp-delay-2" x="64" y="34" fontSize="6">z</text>
        <text className="pp-zzz pp-delay-1" x="69" y="28" fontSize="8">z</text>
        <text className="pp-zzz" x="75" y="21" fontSize="10">Z</text>
      </g>

      <g id={PART.fxSparkle} style={{ opacity: 0 }} fill="#ffe15c">
        <g transform="translate(24 28)"><path className="pp-sparkle" d={STAR} /></g>
        <g transform="translate(78 34)"><path className="pp-sparkle pp-delay-1" d={STAR} /></g>
        <g transform="translate(70 16)"><path className="pp-sparkle pp-delay-2" d={STAR} /></g>
      </g>

      <g id={PART.fxExclaim} style={{ opacity: 0 }}>
        <text className="pp-pop" x="50" y="16" fontSize="16" fontWeight="900" textAnchor="middle" fill="#ff5252">!</text>
      </g>
      <g id={PART.fxQuestion} style={{ opacity: 0 }}>
        <text className="pp-pop" x="50" y="16" fontSize="15" fontWeight="900" textAnchor="middle" fill="#4aa3ff">?</text>
      </g>

      <g id={PART.fxSweat} style={{ opacity: 0 }}>
        <path className="pp-sweat" d="M72 40 q3 5 0 7 q-3 -2 0 -7 Z" fill="#7fc4ff" />
      </g>

      <g id={PART.fxSteam} style={{ opacity: 0 }} fill="#e2eaf1">
        <g transform="translate(30 40)"><circle className="pp-steam" r="3" /></g>
        <g transform="translate(70 40)"><circle className="pp-steam pp-delay-1" r="3" /></g>
        <g transform="translate(50 28)"><circle className="pp-steam pp-delay-2" r="2.6" /></g>
      </g>
    </svg>
  );
});

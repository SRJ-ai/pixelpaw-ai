/**
 * The flourish a character makes when you switch to it.
 *
 * The samurai had one of these and nothing else did, which made switching to
 * anyone else feel like repainting a sprite. Rather than animate fourteen
 * sequences by hand, this keeps the samurai's five primitives — a dim, streaks,
 * puffs, a stroke of light and an impact ring — and varies which appear, their
 * colour and their geometry. Six recognisably different entrances out of one set
 * of CSS keyframes.
 *
 * Entirely original: no film footage, poster art, logo, likeness or dialogue.
 */
interface Props {
  active: boolean;
  kind?: EntranceKind;
  /** Accent for the streaks, stroke and ring. */
  color?: string;
  /** Shown at the end of the sequence. */
  caption?: string;
}

export type EntranceKind =
  /** Wind, smoke and a blade of light. The original. */
  | "slash"
  /** Electric zigzag, no smoke — machines don't billow. */
  | "spark"
  /** A ring that opens outward with motes rising through it. */
  | "bloom"
  /** Horizontal speed lines and no dim: arrival, not ceremony. */
  | "dash"
  /** Soft puffs only. For the animals that would not make an entrance. */
  | "puff"
  /** Concentric shockwaves. */
  | "roar";

const WIND = [18, 34, 47, 61, 76, 88];
const PUFFS = [
  { cx: 22, cy: 82, r: 15, d: "0s" },
  { cx: 50, cy: 88, r: 19, d: "0.15s" },
  { cx: 78, cy: 84, r: 16, d: "0.3s" },
];
const MOTES = [
  { cx: 30, cy: 74, d: "0s" },
  { cx: 50, cy: 80, d: "0.12s" },
  { cx: 68, cy: 72, d: "0.24s" },
  { cx: 41, cy: 68, d: "0.36s" },
];

export function Entrance({ active, kind = "puff", color = "#ffd23f", caption }: Props) {
  if (!active) return null;

  const dim = kind !== "dash" && kind !== "puff";
  const streaks = kind === "slash" || kind === "dash";
  const puffs = kind === "slash" || kind === "puff";
  const stroke = kind === "slash" || kind === "spark";
  const rings = kind === "roar" ? 3 : kind === "puff" ? 0 : 1;

  return (
    <div className={"pp-samurai pp-ent-" + kind} aria-hidden="true">
      {dim && <div className="pp-sam-dim" />}
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {streaks && (
          <g className="pp-sam-wind" stroke={color} strokeLinecap="round">
            {WIND.map((y, i) => (
              <line
                key={y}
                x1="-30"
                y1={y}
                x2={18 + (i % 3) * 12}
                y2={y}
                strokeWidth={i % 2 ? 0.7 : 1.1}
                opacity={0.5 + (i % 3) * 0.15}
              />
            ))}
          </g>
        )}

        {puffs && (
          <g className="pp-sam-smoke" fill="#cfd6de">
            {PUFFS.map((s) => (
              <circle key={s.cx} cx={s.cx} cy={s.cy} r={s.r} style={{ animationDelay: s.d }} />
            ))}
          </g>
        )}

        {kind === "bloom" && (
          <g className="pp-ent-motes" fill={color}>
            {MOTES.map((m) => (
              <circle key={m.cx} cx={m.cx} cy={m.cy} r="2.2" style={{ animationDelay: m.d }} />
            ))}
          </g>
        )}

        {stroke && (
          <path
            className="pp-sam-slash"
            // A blade is one clean diagonal; a spark forks.
            d={kind === "spark" ? "M14 12 L44 44 L30 50 L64 90" : "M8 88 L92 16"}
            fill="none"
            stroke={kind === "spark" ? color : "#fffbe8"}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {Array.from({ length: rings }, (_, i) => (
          <circle
            key={i}
            className="pp-sam-ring"
            cx="50"
            cy="62"
            r={12 + i * 6}
            fill="none"
            stroke={color}
            strokeWidth="2"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </svg>
      {caption && <div className="pp-sam-caption">{caption}</div>}
    </div>
  );
}

/**
 * OG Samurai entrance (§80) — a short, original cinematic flourish: the screen
 * dims, wind streaks blow past, smoke rolls in, and a slash of light crosses the
 * pet before it settles into its stance.
 *
 * Entirely original: no film footage, poster art, logo, likeness or dialogue —
 * just a stylised pixel-cat moment with a Telugu mass-cinema flavour (§78).
 * Pure CSS transforms + opacity, so it stays cheap.
 */
interface Props {
  active: boolean;
  /** Shown at the end of the sequence. */
  caption?: string;
}

const WIND = [18, 34, 47, 61, 76, 88];
const SMOKE = [
  { cx: 22, cy: 82, r: 15, d: "0s" },
  { cx: 50, cy: 88, r: 19, d: "0.15s" },
  { cx: 78, cy: 84, r: 16, d: "0.3s" },
];

export function SamuraiEntrance({ active, caption }: Props) {
  if (!active) return null;
  return (
    <div className="pp-samurai" aria-hidden="true">
      <div className="pp-sam-dim" />
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* Wind streaks */}
        <g className="pp-sam-wind" stroke="#ffe6b0" strokeLinecap="round">
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

        {/* Rolling smoke */}
        <g className="pp-sam-smoke" fill="#cfd6de">
          {SMOKE.map((s) => (
            <circle key={s.cx} cx={s.cx} cy={s.cy} r={s.r} style={{ animationDelay: s.d }} />
          ))}
        </g>

        {/* Blade slash of light */}
        <line className="pp-sam-slash" x1="8" y1="88" x2="92" y2="16" stroke="#fffbe8" strokeWidth="2.4" strokeLinecap="round" />

        {/* Impact ring as the stance lands */}
        <circle className="pp-sam-ring" cx="50" cy="62" r="12" fill="none" stroke="#ffd23f" strokeWidth="2" />
      </svg>
      {caption && <div className="pp-sam-caption">{caption}</div>}
    </div>
  );
}

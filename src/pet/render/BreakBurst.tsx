/**
 * A short "anime" flourish shown when a break reminder fires (§38): radiating
 * speed lines + an expanding flash ring. Pure CSS/SVG transforms + opacity, so
 * it's GPU-composited and cheap. Only mounted while active.
 */
interface Props {
  active: boolean;
}

const LINES = Array.from({ length: 14 }, (_, k) => (k * 360) / 14);

export function BreakBurst({ active }: Props) {
  if (!active) return null;
  return (
    <div className="pp-burst" aria-hidden="true">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g className="pp-burst-lines">
          {LINES.map((deg, i) => (
            <rect
              key={i}
              x="49"
              y="1"
              width="2"
              height="20"
              rx="1"
              fill={i % 2 ? "#ffd23f" : "#ff8f4a"}
              transform={`rotate(${deg} 50 50)`}
            />
          ))}
        </g>
        <circle className="pp-burst-ring" cx="50" cy="50" r="10" fill="none" stroke="#fff3b0" strokeWidth="3" />
      </svg>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/config/i18n";
import { PixelCat } from "@/pet/render/PixelCat";
import { characterById } from "@/config/characters";
import { loadSettings } from "@/config/settings";
import { award, loadProgress, saveProgress, bondLevel, levelFor, levelProgress } from "@/pet/progression";

/**
 * Mini-games (§55). Real, playable games that award XP and bond through the
 * shared progression module — the same store the pet reads, so wins show up on
 * the pet immediately.
 */
type GameId = "reaction" | "memory";

export default function Games() {
  const [settings] = useState(() => loadSettings());
  const [progress, setProgress] = useState(() => loadProgress());
  const [game, setGame] = useState<GameId>("reaction");
  const [toast, setToast] = useState<string | null>(null);
  const char = characterById(settings.characterId);

  const grant = useCallback((xp: number, bond: number) => {
    setProgress((cur) => {
      const { next, leveledUp, unlocked } = award(cur, xp, bond);
      saveProgress(next);
      if (unlocked.length > 0) setToast(`🏆 ${unlocked[0].title}`);
      else if (leveledUp) setToast(`Level ${levelFor(next.xp)}! 🎉`);
      else setToast(`+${xp} XP`);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const bond = bondLevel(progress.bond);

  return (
    <div className="games-root">
      <header className="games-header">
        <span className="games-avatar">
          <PixelCat appearance={settings.appearance} accessories={char.accessories} species={settings.appearance.species ?? char.species} shape={char.shape} />
        </span>
        <span className="games-stats">
          <strong>{settings.petName}</strong>
          <span className="games-sub">
            Lv. {levelFor(progress.xp)} · {bond.label}
          </span>
          {/* Scaled rather than width-animated: transform stays off the layout
              path, so the bar cannot thrash the header as XP ticks up. */}
          <span className="games-bar" title={`${progress.xp} XP`}>
            <i style={{ transform: `scaleX(${levelProgress(progress.xp).toFixed(4)})` }} />
          </span>
        </span>
      </header>

      <nav className="games-tabs">
        <button className={game === "reaction" ? "active" : ""} onClick={() => setGame("reaction")}>
          Reaction
        </button>
        <button className={game === "memory" ? "active" : ""} onClick={() => setGame("memory")}>
          Memory
        </button>
      </nav>

      <div className="games-stage">
        {game === "reaction" ? <Reaction onWin={grant} /> : <Memory onWin={grant} />}
      </div>

      {toast && <div className="games-toast">{toast}</div>}
    </div>
  );
}

/** Reaction test: wait for green, then click as fast as you can. */
function Reaction({ onWin }: { onWin: (xp: number, bond: number) => void }) {
  type Phase = "idle" | "waiting" | "ready" | "result" | "tooSoon";
  const [phase, setPhase] = useState<Phase>("idle");
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function begin() {
    setPhase("waiting");
    const delay = 900 + Math.random() * 2600;
    timer.current = window.setTimeout(() => {
      startedAt.current = performance.now();
      setPhase("ready");
    }, delay);
  }

  function hit() {
    if (phase === "idle" || phase === "result" || phase === "tooSoon") return begin();
    if (phase === "waiting") {
      window.clearTimeout(timer.current);
      setPhase("tooSoon");
      return;
    }
    const t = Math.round(performance.now() - startedAt.current);
    setMs(t);
    setBest((b) => (b === null || t < b ? t : b));
    setPhase("result");
    // Faster reactions earn a little more.
    onWin(t < 250 ? 12 : t < 400 ? 8 : 5, 2);
  }

  const label =
    phase === "idle"
      ? t("games.clickToStart")
      : phase === "waiting"
        ? t("games.waitForGreen")
        : phase === "ready"
          ? t("games.click")
          : phase === "tooSoon"
            ? t("games.tooSoon")
            : t("games.msAgain", { ms });

  return (
    <div className={`react-pad ${phase}`} onClick={hit} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === " " && hit()}>
      <strong>{label}</strong>
      {best !== null && <em>{t("games.best", { ms: best })}</em>}
    </div>
  );
}

/** Memory match: flip pairs of paw-print cards. */
const EMOJI = ["🐾", "🐟", "🧶", "⭐", "🍥", "🌙"];

function Memory({ onWin }: { onWin: (xp: number, bond: number) => void }) {
  const [deck, setDeck] = useState<string[]>(() => shuffle([...EMOJI, ...EMOJI]));
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    if (open.length !== 2) return;
    lock.current = true;
    const [a, b] = open;
    const match = deck[a] === deck[b];
    const t = window.setTimeout(() => {
      if (match) setDone((d) => [...d, a, b]);
      setOpen([]);
      lock.current = false;
    }, match ? 340 : 720);
    setMoves((m) => m + 1);
    return () => window.clearTimeout(t);
  }, [open, deck]);

  const complete = done.length === deck.length;
  useEffect(() => {
    if (!complete) return;
    // Fewer moves = bigger reward, with a floor so it's never punishing.
    onWin(Math.max(10, 40 - moves), 4);
  }, [complete]); // eslint-disable-line react-hooks/exhaustive-deps

  function flip(i: number) {
    if (lock.current || open.includes(i) || done.includes(i)) return;
    setOpen((o) => (o.length < 2 ? [...o, i] : o));
  }

  function reset() {
    setDeck(shuffle([...EMOJI, ...EMOJI]));
    setOpen([]);
    setDone([]);
    setMoves(0);
    lock.current = false;
  }

  return (
    <div className="memory">
      <div className="memory-grid">
        {deck.map((face, i) => {
          const shown = open.includes(i) || done.includes(i);
          return (
            <button
              key={i}
              className={`memory-card${shown ? " open" : ""}${done.includes(i) ? " done" : ""}`}
              onClick={() => flip(i)}
              aria-label={shown ? face : "hidden card"}
            >
              {shown ? face : "?"}
            </button>
          );
        })}
      </div>
      <div className="memory-foot">
        <span>{complete ? t("games.solved", { moves }) : t("games.moves", { moves })}</span>
        <button className="set-btn" onClick={reset}>
          {complete ? t("games.playAgain") : t("games.reset")}
        </button>
      </div>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

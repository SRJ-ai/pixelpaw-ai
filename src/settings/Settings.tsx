import { useEffect, useState } from "react";
import { PixelCat } from "@/pet/render/PixelCat";
import { BRANDING } from "@/config/branding";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Recurrence,
  type Settings as S,
} from "@/config/settings";
import { mediaControl, type MediaAction } from "@/platform/media";
import { PROVIDERS, providerInfo, setKey, hasKey, type ProviderId } from "@/ai/client";
import { PERSONALITIES, LANGUAGES, type LanguageId, type PersonalityId } from "@/ai/personality";
import { loadMemories, deleteMemory, clearMemories, MEMORY_LABELS, type MemoryEntry } from "@/ai/memory";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_APPEARANCE } from "@/types/pet";
import { CHARACTERS, characterById } from "@/config/characters";

/**
 * The Settings + customizer window (§58). Every control here is real and
 * persisted, and changes are broadcast so the running pet updates live.
 */
export default function Settings() {
  const [s, setS] = useState<S>(() => loadSettings());
  const [keyInput, setKeyInput] = useState("");
  const [keySaved, setKeySaved] = useState<boolean | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>(() => loadMemories());
  const [agentInfo, setAgentInfo] = useState<{ port: number; token: string } | null>(null);

  const aiProvider = s.ai.provider;
  useEffect(() => {
    setKeyInput("");
    hasKey(aiProvider).then(setKeySaved);
  }, [aiProvider]);

  useEffect(() => {
    invoke<{ port: number; token: string }>("agent_info")
      .then(setAgentInfo)
      .catch(() => setAgentInfo(null));
  }, []);

  function patch(mut: (draft: S) => void) {
    setS((prev) => {
      const next = structuredClone(prev);
      mut(next);
      void saveSettings(next);
      return next;
    });
  }

  const i = s.interactions;
  const g = s.general;
  const prod = s.productivity;

  return (
    <div className="settings-root">
      <header className="set-header">
        <div className="set-preview">
          <PixelCat appearance={s.appearance} accessories={characterById(s.characterId).accessories} />
        </div>
        <div>
          <h1>{BRANDING.appName}</h1>
          <p>{BRANDING.tagline}</p>
        </div>
      </header>

      <Section title="Character">
        <div className="set-chars">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={"set-char" + (c.id === s.characterId ? " active" : "")}
              title={c.blurb}
              onClick={() =>
                patch((d) => {
                  d.characterId = c.id;
                  d.appearance = { ...c.appearance };
                })
              }
            >
              <span className="set-char-preview">
                <PixelCat appearance={c.appearance} accessories={c.accessories} />
              </span>
              <span className="set-char-name">{c.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Pet">
        <Row label="Name">
          <input
            className="set-input"
            value={s.petName}
            maxLength={24}
            onChange={(e) => patch((d) => (d.petName = e.target.value))}
          />
        </Row>
      </Section>

      <Section title="Appearance">
        <ColorRow label="Body" value={s.appearance.bodyColor} onChange={(v) => patch((d) => (d.appearance.bodyColor = v))} />
        <ColorRow label="Belly" value={s.appearance.bellyColor} onChange={(v) => patch((d) => (d.appearance.bellyColor = v))} />
        <ColorRow label="Pattern" value={s.appearance.patternColor} onChange={(v) => patch((d) => (d.appearance.patternColor = v))} />
        <ColorRow label="Inner ear" value={s.appearance.innerEarColor} onChange={(v) => patch((d) => (d.appearance.innerEarColor = v))} />
        <ColorRow label="Eyes" value={s.appearance.eyeColor} onChange={(v) => patch((d) => (d.appearance.eyeColor = v))} />
        <ColorRow label="Nose" value={s.appearance.noseColor} onChange={(v) => patch((d) => (d.appearance.noseColor = v))} />
        <button className="set-btn" onClick={() => patch((d) => (d.appearance = { ...DEFAULT_APPEARANCE }))}>
          Reset colors
        </button>
      </Section>

      <Section title="General">
        <Toggle label="Always on top" checked={g.alwaysOnTop} onChange={(v) => patch((d) => (d.general.alwaysOnTop = v))} />
        <Slider label="Size" min={0.25} max={1.6} step={0.05} value={g.scale} onChange={(v) => patch((d) => (d.general.scale = v))} fmt={pct} />
        <Slider label="Opacity" min={0.3} max={1} step={0.05} value={g.opacity} onChange={(v) => patch((d) => (d.general.opacity = v))} fmt={pct} />
        <Toggle label="Cosmic decor (stars + black hole)" checked={g.cosmicDecor} onChange={(v) => patch((d) => (d.general.cosmicDecor = v))} />
        <Toggle label="Never sleep (pet stays awake)" checked={g.neverSleep} onChange={(v) => patch((d) => (d.general.neverSleep = v))} />
        <Toggle label="Reduced motion" checked={g.reducedMotion} onChange={(v) => patch((d) => (d.general.reducedMotion = v))} />
      </Section>

      <Section title="Breaks">
        <Toggle label="Break reminders" checked={prod.breakEnabled} onChange={(v) => patch((d) => (d.productivity.breakEnabled = v))} />
        {prod.breakEnabled && (
          <Slider
            label="Every"
            min={5}
            max={60}
            step={5}
            value={prod.breakIntervalMin}
            onChange={(v) => patch((d) => (d.productivity.breakIntervalMin = v))}
            fmt={(v) => `${v} min`}
            sub
          />
        )}
        <p className="set-note">The pet stretches and pops an anime-style reminder to take a short break.</p>
      </Section>

      <Section title="Water">
        <Toggle label="Water reminders" checked={prod.waterEnabled} onChange={(v) => patch((d) => (d.productivity.waterEnabled = v))} />
        {prod.waterEnabled && (
          <Slider label="Every" min={5} max={120} step={5} value={prod.waterIntervalMin} onChange={(v) => patch((d) => (d.productivity.waterIntervalMin = v))} fmt={(v) => `${v} min`} sub />
        )}
        <p className="set-note">The pet nudges you to sip water. Paused during Pomodoro focus.</p>
      </Section>

      <Section title="Pomodoro">
        <Slider label="Focus" min={10} max={60} step={5} value={prod.pomodoroFocusMin} onChange={(v) => patch((d) => (d.productivity.pomodoroFocusMin = v))} fmt={(v) => `${v} min`} />
        <Slider label="Break" min={3} max={15} step={1} value={prod.pomodoroBreakMin} onChange={(v) => patch((d) => (d.productivity.pomodoroBreakMin = v))} fmt={(v) => `${v} min`} />
        <p className="set-note">Start/stop from the tray. During focus the pet stays calm and quiet; on the break it stretches and plays.</p>
      </Section>

      <Section title="Interactions">
        <Toggle label="Eyes follow cursor" checked={i.gaze} onChange={(v) => patch((d) => (d.interactions.gaze = v))} />
        <Toggle label="Mouse hunting" checked={i.hunt} onChange={(v) => patch((d) => (d.interactions.hunt = v))} />
        {i.hunt && (
          <Slider label="Hunt sensitivity" min={0} max={1} step={0.05} value={i.huntSensitivity} onChange={(v) => patch((d) => (d.interactions.huntSensitivity = v))} fmt={pct} sub />
        )}
        <Toggle label="Petting" checked={i.petting} onChange={(v) => patch((d) => (d.interactions.petting = v))} />
        <Toggle label="Drag & fling" checked={i.drag} onChange={(v) => patch((d) => (d.interactions.drag = v))} />
        <Toggle label="Kneading while typing" checked={i.keyboard} onChange={(v) => patch((d) => (d.interactions.keyboard = v))} />
        <Toggle label="Overheat gag (fast typing)" checked={i.overheat} onChange={(v) => patch((d) => (d.interactions.overheat = v))} />
        {i.overheat && (
          <Slider label="Overheat sensitivity" min={0} max={1} step={0.05} value={i.overheatSensitivity} onChange={(v) => patch((d) => (d.interactions.overheatSensitivity = v))} fmt={pct} sub />
        )}
        <Toggle label="Scroll reactions" checked={i.scroll} onChange={(v) => patch((d) => (d.interactions.scroll = v))} />
      </Section>

      <Section title="Schedule reminders">
        {s.reminders.length === 0 && <p className="set-note">No reminders yet — add one below.</p>}
        {s.reminders.map((r) => (
          <div key={r.id} className="set-item">
            <input
              type="checkbox"
              checked={r.enabled}
              title="Enabled"
              onChange={(e) =>
                patch((d) => {
                  const t = d.reminders.find((x) => x.id === r.id);
                  if (t) t.enabled = e.target.checked;
                })
              }
            />
            <input
              className="set-input grow"
              value={r.title}
              placeholder="Reminder"
              onChange={(e) =>
                patch((d) => {
                  const t = d.reminders.find((x) => x.id === r.id);
                  if (t) t.title = e.target.value;
                })
              }
            />
            <input
              type="time"
              className="set-input time"
              value={r.time}
              onChange={(e) =>
                patch((d) => {
                  const t = d.reminders.find((x) => x.id === r.id);
                  if (t) t.time = e.target.value;
                })
              }
            />
            <select
              className="set-input sel"
              value={r.recurrence}
              onChange={(e) =>
                patch((d) => {
                  const t = d.reminders.find((x) => x.id === r.id);
                  if (t) t.recurrence = e.target.value as Recurrence;
                })
              }
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
            </select>
            <button className="set-x" title="Delete" onClick={() => patch((d) => (d.reminders = d.reminders.filter((x) => x.id !== r.id)))}>
              ×
            </button>
          </div>
        ))}
        <button
          className="set-btn"
          onClick={() =>
            patch((d) =>
              d.reminders.push({
                id: newId(),
                title: "New reminder",
                time: nextRoundTime(),
                recurrence: "daily",
                enabled: true,
              })
            )
          }
        >
          + Add reminder
        </button>
      </Section>

      <Section title="Tasks">
        {s.tasks.length === 0 && <p className="set-note">No tasks yet — add one below.</p>}
        {s.tasks.map((t) => (
          <div key={t.id} className="set-item">
            <input
              type="checkbox"
              checked={t.done}
              title="Done"
              onChange={(e) =>
                patch((d) => {
                  const x = d.tasks.find((y) => y.id === t.id);
                  if (x) x.done = e.target.checked;
                })
              }
            />
            <input
              className={"set-input grow" + (t.done ? " done" : "")}
              value={t.text}
              placeholder="Task"
              onChange={(e) =>
                patch((d) => {
                  const x = d.tasks.find((y) => y.id === t.id);
                  if (x) x.text = e.target.value;
                })
              }
            />
            <button className="set-x" title="Delete" onClick={() => patch((d) => (d.tasks = d.tasks.filter((y) => y.id !== t.id)))}>
              ×
            </button>
          </div>
        ))}
        <button className="set-btn" onClick={() => patch((d) => d.tasks.push({ id: newId(), text: "New task", done: false }))}>
          + Add task
        </button>
        <Toggle label="Nudge me about unfinished tasks" checked={prod.taskNudgeEnabled} onChange={(v) => patch((d) => (d.productivity.taskNudgeEnabled = v))} />
        {prod.taskNudgeEnabled && (
          <Slider label="Every" min={5} max={120} step={5} value={prod.taskNudgeMin} onChange={(v) => patch((d) => (d.productivity.taskNudgeMin = v))} fmt={(v) => `${v} min`} sub />
        )}
      </Section>

      <Section title="Music">
        <div className="set-media">
          <MediaBtn action="prev" label="⏮" title="Previous track" />
          <MediaBtn action="play_pause" label="⏯" title="Play / Pause" />
          <MediaBtn action="next" label="⏭" title="Next track" />
          <MediaBtn action="volume_down" label="🔉" title="Volume down" />
          <MediaBtn action="volume_up" label="🔊" title="Volume up" />
          <MediaBtn action="mute" label="🔇" title="Mute" />
        </div>
        <p className="set-note">
          Controls whichever player currently has playback (Spotify, a browser tab, a local
          player…) using the standard media keys. Also available from the tray menu.
        </p>
      </Section>

      <Section title="AI">
        <Toggle label="Enable AI companion" checked={s.ai.enabled} onChange={(v) => patch((d) => (d.ai.enabled = v))} />
        <Row label="Provider">
          <select
            className="set-input"
            value={s.ai.provider}
            onChange={(e) =>
              patch((d) => {
                d.ai.provider = e.target.value as ProviderId;
                d.ai.model = providerInfo(d.ai.provider).defaultModel;
                d.ai.baseUrl = "";
              })
            }
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Row>
        <p className="set-note">{providerInfo(s.ai.provider).hint}</p>

        <Row label="Model">
          <input
            className="set-input"
            value={s.ai.model}
            placeholder={providerInfo(s.ai.provider).defaultModel || "(provider default)"}
            onChange={(e) => patch((d) => (d.ai.model = e.target.value))}
          />
        </Row>

        {providerInfo(s.ai.provider).baseUrlLabel && (
          <Row label={providerInfo(s.ai.provider).baseUrlLabel!}>
            <input
              className="set-input"
              value={s.ai.baseUrl}
              placeholder={s.ai.provider === "ollama" ? "http://localhost:11434" : ""}
              onChange={(e) => patch((d) => (d.ai.baseUrl = e.target.value))}
            />
          </Row>
        )}

        {providerInfo(s.ai.provider).needsKey && (
          <>
            <Row label="API key">
              <input
                className="set-input"
                type="password"
                value={keyInput}
                placeholder={keySaved ? "•••••••• (saved)" : "paste key"}
                onChange={(e) => setKeyInput(e.target.value)}
              />
            </Row>
            <div className="set-item">
              <button
                className="set-btn"
                onClick={async () => {
                  await setKey(s.ai.provider, keyInput);
                  setKeyInput("");
                  setKeySaved(await hasKey(s.ai.provider));
                }}
              >
                {keyInput ? "Save key" : "Clear key"}
              </button>
              <span className="set-note" style={{ margin: 0 }}>
                Stored outside the web layer, never shown again.
              </span>
            </div>
          </>
        )}

        <Row label="Personality">
          <select className="set-input" value={s.ai.personality} onChange={(e) => patch((d) => (d.ai.personality = e.target.value as PersonalityId))}>
            {PERSONALITIES.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
          </select>
        </Row>
        <Row label="Language">
          <select className="set-input" value={s.ai.language} onChange={(e) => patch((d) => (d.ai.language = e.target.value as LanguageId))}>
            {LANGUAGES.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
          </select>
        </Row>
        <Row label="Your name">
          <input className="set-input" value={s.ai.userName} placeholder="(optional)" onChange={(e) => patch((d) => (d.ai.userName = e.target.value))} />
        </Row>
        <p className="set-note">Open the chat from the tray: <strong>Chat with pet…</strong></p>
      </Section>

      <Section title="Memory">
        {memories.length === 0 && <p className="set-note">Nothing remembered yet.</p>}
        {memories.map((m) => (
          <div key={m.id} className="set-item">
            <span className="set-mem-cat">{MEMORY_LABELS[m.category]}</span>
            <span className="set-input grow">{m.text}</span>
            <button className="set-x" title="Forget" onClick={() => setMemories(deleteMemory(m.id))}>×</button>
          </div>
        ))}
        {memories.length > 0 && (
          <button className="set-btn danger" onClick={() => { clearMemories(); setMemories([]); }}>
            Forget everything
          </button>
        )}
        <p className="set-note">Memories are stored locally and only sent to your chosen AI provider when you chat.</p>
      </Section>

      <Section title="Coding agents">
        <Toggle label="React to agent activity" checked={s.ai.agentReactions} onChange={(v) => patch((d) => (d.ai.agentReactions = v))} />
        <p className="set-note">
          The pet reacts when a coding agent (Claude Code, Codex, Cursor, a script…) reports what
          it's doing. Point your agent's hooks at this local endpoint — it only accepts connections
          from this machine:
        </p>
        {agentInfo ? (
          <pre className="set-code">{`POST http://127.0.0.1:${agentInfo.port}/agent/status
X-PixelPaw-Token: ${agentInfo.token}
{"agent":"claude-code","status":"working"}`}</pre>
        ) : (
          <p className="set-note">Endpoint unavailable (port in use).</p>
        )}
        <p className="set-note">Valid statuses: working, thinking, waiting, success, error, cancelled, idle.</p>
      </Section>

      <Section title="Privacy">
        <p className="set-note">
          PixelPaw is local-first. No telemetry, no keystroke logging, no screenshots, no network
          calls. Toggling an interaction off stops that monitoring entirely.
        </p>
        <PrivacyRow label="Mouse position" on={i.gaze || i.hunt || i.drag || i.petting} desc="Reacts to your cursor. Never recorded." />
        <PrivacyRow label="Keyboard activity" on={i.keyboard || i.overheat} desc="Only counts key-presses for timing. Never which keys." />
        <PrivacyRow label="Scroll wheel" on={i.scroll} desc="Only the wheel delta. Page content is never read." />
      </Section>

      <Section title="About">
        <p className="set-note">
          {BRANDING.appName} v{BRANDING.version} — an original desktop companion. Not affiliated with
          any existing product; all code, art, and animation are original.
        </p>
        <button className="set-btn danger" onClick={() => patch((d) => Object.assign(d, structuredClone(DEFAULT_SETTINGS)))}>
          Reset all to defaults
        </button>
      </Section>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Default a new reminder to the next round 5-minute mark. */
function nextRoundTime(): string {
  const d = new Date(Date.now() + 5 * 60000);
  const m = Math.ceil(d.getMinutes() / 5) * 5;
  d.setMinutes(m % 60, 0, 0);
  if (m >= 60) d.setHours(d.getHours() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function MediaBtn({ action, label, title }: { action: MediaAction; label: string; title: string }) {
  return (
    <button className="set-media-btn" title={title} onClick={() => void mediaControl(action)}>
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="set-section">
      <h2>{title}</h2>
      <div className="set-body">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="set-row">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="set-row set-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Slider({
  label, min, max, step, value, onChange, fmt, sub,
}: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; fmt: (v: number) => string; sub?: boolean;
}) {
  return (
    <label className={"set-row set-slider" + (sub ? " sub" : "")}>
      <span>{label}</span>
      <span className="set-slider-ctl">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
        <em>{fmt(value)}</em>
      </span>
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="set-row set-color">
      <span>{label}</span>
      <span className="set-color-ctl">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <code>{value}</code>
      </span>
    </label>
  );
}

function PrivacyRow({ label, on, desc }: { label: string; on: boolean; desc: string }) {
  return (
    <div className="set-privacy">
      <span className={"set-dot " + (on ? "on" : "off")} />
      <span className="set-privacy-label">{label}</span>
      <span className={"set-privacy-state " + (on ? "on" : "off")}>{on ? "Active" : "Off"}</span>
      <span className="set-privacy-desc">{desc}</span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { PixelCat } from "@/pet/render/PixelCat";
import { BRANDING } from "@/config/branding";
import {
  DEFAULT_SETTINGS,
  formatInterval,
  INTERVAL_PRESETS,
  loadSettings,
  POMODORO_PRESETS,
  saveSettings,
  type Recurrence,
  type Settings as S,
} from "@/config/settings";
import { mediaControl, type MediaAction } from "@/platform/media";
import { MEDIA_LABELS, MEDIA_ORDER, MediaIcon } from "@/ui/MediaIcons";
import { PROVIDERS, providerInfo, setKey, hasKey, type ProviderId } from "@/ai/client";
import { PERSONALITIES, LANGUAGES, type LanguageId, type PersonalityId } from "@/ai/personality";
import { loadMemories, deleteMemory, clearMemories, MEMORY_LABELS, type MemoryEntry } from "@/ai/memory";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_APPEARANCE } from "@/types/pet";
import { CHARACTERS, characterById } from "@/config/characters";
import { setUiLang, t, UI_LANGUAGES, type StringKey, type UiLang } from "@/config/i18n";
import { clearCrash, readCrash } from "@/ui/crashLog";
import { describeAge, readAgentContact } from "@/pet/behaviors/agentLog";
import { playCue, setSound } from "@/platform/sound";

type TabId = "pet" | "behavior" | "focus" | "ai" | "more";

/**
 * Five groups instead of sixteen stacked panels. All sixteen in one column ran
 * to roughly 3,400px in a 700px window, so finding anything meant scrolling
 * past everything; grouping is the difference between a settings screen you
 * scan and one you hunt through.
 */
const TABS: { id: TabId; label: StringKey }[] = [
  { id: "pet", label: "set.tab.pet" },
  { id: "behavior", label: "set.tab.behavior" },
  { id: "focus", label: "set.tab.focus" },
  { id: "ai", label: "set.tab.ai" },
  { id: "more", label: "set.tab.more" },
];

/**
 * The Settings + customizer window (§58). Every control here is real and
 * persisted, and changes are broadcast so the running pet updates live.
 */
export default function Settings() {
  const [tab, setTab] = useState<TabId>("pet");
  const [s, setS] = useState<S>(() => loadSettings());
  const [keyInput, setKeyInput] = useState("");
  const [keySaved, setKeySaved] = useState<boolean | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>(() => loadMemories());
  const [agentInfo, setAgentInfo] = useState<{ port: number; token: string; exe: string } | null>(null);

  const aiProvider = s.ai.provider;
  useEffect(() => {
    setKeyInput("");
    hasKey(aiProvider).then(setKeySaved);
  }, [aiProvider]);

  useEffect(() => {
    invoke<{ port: number; token: string; exe: string }>("agent_info")
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

  // Quoted so a path with spaces (the default install location has one) can be
  // pasted straight into a shell.
  const exePath = agentInfo ? `"${agentInfo.exe}"` : "pixelpaw-ai";

  const i = s.interactions;
  const g = s.general;
  const prod = s.productivity;

  return (
    <div className="settings-root">
      <header className="set-header">
        <div className="set-preview">
          <PixelCat
            appearance={s.appearance}
            accessories={characterById(s.characterId).accessories}
            species={characterById(s.characterId).species}
          />
        </div>
        <div>
          <h1>{BRANDING.appName}</h1>
          <p>{BRANDING.tagline}</p>
        </div>
      </header>

      {/* Sticky so the group you are in stays named while you scroll it. */}
      <nav className="set-tabs" role="tablist" aria-label={t("set.section.general")}>
        {TABS.map((x, idx) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`set-tab-${x.id}`}
            aria-controls="set-panel"
            aria-selected={tab === x.id}
            // Only the selected tab is a tab stop; arrows move within the set.
            // That is the expected keyboard model for a tablist.
            tabIndex={tab === x.id ? 0 : -1}
            className={"set-tab" + (tab === x.id ? " on" : "")}
            onClick={() => setTab(x.id)}
            onKeyDown={(e) => {
              const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              const next = TABS[(idx + dir + TABS.length) % TABS.length];
              setTab(next.id);
              document.getElementById(`set-tab-${next.id}`)?.focus();
            }}
          >
            {t(x.label)}
          </button>
        ))}
      </nav>

      <div id="set-panel" role="tabpanel" aria-labelledby={`set-tab-${tab}`}>
      {tab === "pet" && (
        <>
        <Section title={t("set.section.character")}>
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
                  <PixelCat appearance={c.appearance} accessories={c.accessories} species={c.species} />
                </span>
                <span className="set-char-name">{c.name}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("set.section.pet")}>
          <Row label={t("set.name")}>
            <input
              className="set-input"
              value={s.petName}
              maxLength={24}
              onChange={(e) => patch((d) => (d.petName = e.target.value))}
            />
          </Row>
          {/* Lives on `ai.userName` for storage reasons, but it belongs here:
              the pet uses it for breaks, water and Pomodoro lines whether or
              not the AI is switched on. Buried in the AI tab it went unset, so
              every named line silently fell back to the generic one. */}
          <Row label={t("set.yourName")}>
            <input
              className="set-input"
              value={s.ai.userName}
              maxLength={24}
              placeholder={t("set.optional")}
              onChange={(e) => patch((d) => (d.ai.userName = e.target.value))}
            />
          </Row>
          <p className="set-note">{t("set.note.yourName")}</p>
        </Section>

        <Section title={t("set.section.appearance")}>
          <ColorRow label={t("set.body")} value={s.appearance.bodyColor} onChange={(v) => patch((d) => (d.appearance.bodyColor = v))} />
          <ColorRow label={t("set.belly")} value={s.appearance.bellyColor} onChange={(v) => patch((d) => (d.appearance.bellyColor = v))} />
          <ColorRow label={t("set.pattern")} value={s.appearance.patternColor} onChange={(v) => patch((d) => (d.appearance.patternColor = v))} />
          <ColorRow label={t("set.innerEar")} value={s.appearance.innerEarColor} onChange={(v) => patch((d) => (d.appearance.innerEarColor = v))} />
          <ColorRow label={t("set.eyes")} value={s.appearance.eyeColor} onChange={(v) => patch((d) => (d.appearance.eyeColor = v))} />
          <ColorRow label={t("set.nose")} value={s.appearance.noseColor} onChange={(v) => patch((d) => (d.appearance.noseColor = v))} />
          <button className="set-btn" onClick={() => patch((d) => (d.appearance = { ...DEFAULT_APPEARANCE }))}>
            {t("set.resetColors")}
          </button>
        </Section>
        </>
      )}

      {tab === "behavior" && (
        <>
        <Section title={t("set.section.general")}>
          <Row label={t("set.language")}>
            <select
              className="set-input"
              value={g.uiLanguage}
              onChange={(e) => {
                const lang = e.target.value as UiLang;
                // Arm the translator before the state update so this render
                // already comes out in the new language.
                setUiLang(lang);
                patch((d) => (d.general.uiLanguage = lang));
              }}
            >
              {UI_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </Row>
          <Toggle label={t("set.alwaysOnTop")} checked={g.alwaysOnTop} onChange={(v) => patch((d) => (d.general.alwaysOnTop = v))} />
          <Slider label={t("set.size")} min={0.25} max={1.6} step={0.05} value={g.scale} onChange={(v) => patch((d) => (d.general.scale = v))} fmt={pct} />
          <Slider label={t("set.opacity")} min={0.3} max={1} step={0.05} value={g.opacity} onChange={(v) => patch((d) => (d.general.opacity = v))} fmt={pct} />
          <Row label={t("set.pinnedNote")}>
            <input
              className="set-input"
              value={g.pinnedNote}
              maxLength={80}
              placeholder={t("set.pinnedNotePlaceholder")}
              onChange={(e) => patch((d) => (d.general.pinnedNote = e.target.value))}
            />
          </Row>
          <Toggle label={t("set.cosmicDecor")} checked={g.cosmicDecor} onChange={(v) => patch((d) => (d.general.cosmicDecor = v))} />
          <Toggle label={t("set.neverSleep")} checked={g.neverSleep} onChange={(v) => patch((d) => (d.general.neverSleep = v))} />
          <Toggle label={t("set.reducedMotion")} checked={g.reducedMotion} onChange={(v) => patch((d) => (d.general.reducedMotion = v))} />
          <Toggle
            label={t("set.dockToAgent")}
            checked={g.dockToAgent}
            onChange={(v) => patch((d) => (d.general.dockToAgent = v))}
          />
          <Toggle label={t("set.sound")} checked={g.sound} onChange={(v) => patch((d) => (d.general.sound = v))} />
          {g.sound && (
            <Slider
              label={t("set.volume")}
              min={0}
              max={1}
              step={0.05}
              value={g.volume}
              sub
              fmt={pct}
              onChange={(v) => {
                patch((d) => (d.general.volume = v));
                // Arm this window's own audio and sound a cue as the handle
                // moves. Hearing the level while setting it beats a separate
                // "test" button, and it is the only honest preview.
                setSound(true, v);
                playCue("pop");
              }}
            />
          )}
          <p className="set-note">{t("set.note.pinned")}</p>
          <p className="set-note">{t("set.note.dock")}</p>
        </Section>

        <Section title={t("set.section.interactions")}>
          <Toggle label={t("set.gaze")} checked={i.gaze} onChange={(v) => patch((d) => (d.interactions.gaze = v))} />
          <Toggle label={t("set.hunt")} checked={i.hunt} onChange={(v) => patch((d) => (d.interactions.hunt = v))} />
          {i.hunt && (
            <Slider label={t("set.huntSensitivity")} min={0} max={1} step={0.05} value={i.huntSensitivity} onChange={(v) => patch((d) => (d.interactions.huntSensitivity = v))} fmt={pct} sub />
          )}
          <Toggle label={t("set.petting")} checked={i.petting} onChange={(v) => patch((d) => (d.interactions.petting = v))} />
          <Toggle label={t("set.drag")} checked={i.drag} onChange={(v) => patch((d) => (d.interactions.drag = v))} />
          <Toggle label={t("set.knead")} checked={i.keyboard} onChange={(v) => patch((d) => (d.interactions.keyboard = v))} />
          <Toggle label={t("set.overheat")} checked={i.overheat} onChange={(v) => patch((d) => (d.interactions.overheat = v))} />
          {i.overheat && (
            <Slider label={t("set.overheatSensitivity")} min={0} max={1} step={0.05} value={i.overheatSensitivity} onChange={(v) => patch((d) => (d.interactions.overheatSensitivity = v))} fmt={pct} sub />
          )}
          <Toggle label={t("set.scroll")} checked={i.scroll} onChange={(v) => patch((d) => (d.interactions.scroll = v))} />
        </Section>
        </>
      )}

      {tab === "focus" && (
        <>
        <Section title={t("set.section.breaks")}>
          <Toggle label={t("set.breakEnabled")} checked={prod.breakEnabled} onChange={(v) => patch((d) => (d.productivity.breakEnabled = v))} />
          {prod.breakEnabled && (
            <>
              <Presets
                label={t("set.every")}
                options={INTERVAL_PRESETS.map((m) => ({
                  label: formatInterval(m),
                  active: prod.breakIntervalMin === m,
                  apply: () => patch((d) => (d.productivity.breakIntervalMin = m)),
                }))}
              />
              <Slider
                label={t("set.custom")}
                min={5}
                max={120}
                step={5}
                value={prod.breakIntervalMin}
                onChange={(v) => patch((d) => (d.productivity.breakIntervalMin = v))}
                fmt={formatInterval}
                sub
              />
            </>
          )}
          <p className="set-note">{t("set.note.breaks")}</p>
        </Section>

        <Section title={t("set.section.water")}>
          <Toggle label={t("set.waterEnabled")} checked={prod.waterEnabled} onChange={(v) => patch((d) => (d.productivity.waterEnabled = v))} />
          {prod.waterEnabled && (
            <>
              <Presets
                label={t("set.every")}
                options={INTERVAL_PRESETS.map((m) => ({
                  label: formatInterval(m),
                  active: prod.waterIntervalMin === m,
                  apply: () => patch((d) => (d.productivity.waterIntervalMin = m)),
                }))}
              />
              <Slider label={t("set.custom")} min={5} max={180} step={5} value={prod.waterIntervalMin} onChange={(v) => patch((d) => (d.productivity.waterIntervalMin = v))} fmt={formatInterval} sub />
            </>
          )}
          <p className="set-note">{t("set.note.water")}</p>
        </Section>

        <Section title={t("set.section.pomodoro")}>
          <Presets
            label={t("set.preset")}
            options={POMODORO_PRESETS.map((p) => ({
              label: p.label,
              hint: p.hint,
              active: prod.pomodoroFocusMin === p.focus && prod.pomodoroBreakMin === p.brk,
              apply: () =>
                patch((d) => {
                  d.productivity.pomodoroFocusMin = p.focus;
                  d.productivity.pomodoroBreakMin = p.brk;
                }),
            }))}
          />
          <Slider label={t("set.focus")} min={10} max={120} step={5} value={prod.pomodoroFocusMin} onChange={(v) => patch((d) => (d.productivity.pomodoroFocusMin = v))} fmt={formatInterval} sub />
          <Slider label={t("set.break")} min={3} max={30} step={1} value={prod.pomodoroBreakMin} onChange={(v) => patch((d) => (d.productivity.pomodoroBreakMin = v))} fmt={formatInterval} sub />
          <p className="set-note">{t("set.note.pomodoro")}</p>
        </Section>

        <Section title={t("set.section.reminders")}>
          {s.reminders.length === 0 && <p className="set-note">{t("set.noReminders")}</p>}
          {s.reminders.map((r) => (
            <div key={r.id} className="set-item">
              <input
                type="checkbox"
                checked={r.enabled}
                title={t("set.enabled")}
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
                placeholder={t("set.reminderPlaceholder")}
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
                <option value="once">{t("set.once")}</option>
                <option value="daily">{t("set.daily")}</option>
                <option value="weekdays">{t("set.weekdays")}</option>
              </select>
              <button className="set-x" title={t("set.delete")} onClick={() => patch((d) => (d.reminders = d.reminders.filter((x) => x.id !== r.id)))}>
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
            {t("set.addReminder")}
          </button>
        </Section>

        <Section title={t("set.section.tasks")}>
          {s.tasks.length === 0 && <p className="set-note">{t("set.noTasks")}</p>}
          {s.tasks.map((task) => (
            <div key={task.id} className="set-item">
              <input
                type="checkbox"
                checked={task.done}
                title={t("set.done")}
                onChange={(e) =>
                  patch((d) => {
                    const x = d.tasks.find((y) => y.id === task.id);
                    if (x) x.done = e.target.checked;
                  })
                }
              />
              <input
                className={"set-input grow" + (task.done ? " done" : "")}
                value={task.text}
                placeholder={t("set.taskPlaceholder")}
                onChange={(e) =>
                  patch((d) => {
                    const x = d.tasks.find((y) => y.id === task.id);
                    if (x) x.text = e.target.value;
                  })
                }
              />
              <button className="set-x" title={t("set.delete")} onClick={() => patch((d) => (d.tasks = d.tasks.filter((y) => y.id !== task.id)))}>
                ×
              </button>
            </div>
          ))}
          <button className="set-btn" onClick={() => patch((d) => d.tasks.push({ id: newId(), text: "New task", done: false }))}>
            {t("set.addTask")}
          </button>
          <Toggle label={t("set.taskNudge")} checked={prod.taskNudgeEnabled} onChange={(v) => patch((d) => (d.productivity.taskNudgeEnabled = v))} />
          {prod.taskNudgeEnabled && (
            <Slider label={t("set.every")} min={5} max={120} step={5} value={prod.taskNudgeMin} onChange={(v) => patch((d) => (d.productivity.taskNudgeMin = v))} fmt={(v) => `${v} min`} sub />
          )}
        </Section>
        </>
      )}

      {tab === "ai" && (
        <>
        <Section title={t("set.section.ai")}>
          <Toggle label={t("set.aiEnabled")} checked={s.ai.enabled} onChange={(v) => patch((d) => (d.ai.enabled = v))} />
          <Row label={t("set.provider")}>
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

          <Row label={t("set.model")}>
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
              <Row label={t("set.apiKey")}>
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

          <Row label={t("set.personality")}>
            <select className="set-input" value={s.ai.personality} onChange={(e) => patch((d) => (d.ai.personality = e.target.value as PersonalityId))}>
              {PERSONALITIES.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
            </select>
          </Row>
          <Row label={t("set.replyLanguage")}>
            <select className="set-input" value={s.ai.language} onChange={(e) => patch((d) => (d.ai.language = e.target.value as LanguageId))}>
              {LANGUAGES.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
            </select>
          </Row>
          <p className="set-note">{t("set.note.openChat")}</p>
        </Section>

        <Section title={t("set.section.memory")}>
          {memories.length === 0 && <p className="set-note">{t("set.noMemories")}</p>}
          {memories.map((m) => (
            <div key={m.id} className="set-item">
              <span className="set-mem-cat">{MEMORY_LABELS[m.category]}</span>
              <span className="set-input grow">{m.text}</span>
              <button className="set-x" title={t("set.forget")} onClick={() => setMemories(deleteMemory(m.id))}>×</button>
            </div>
          ))}
          {memories.length > 0 && (
            <button className="set-btn danger" onClick={() => { clearMemories(); setMemories([]); }}>
              Forget everything
            </button>
          )}
          <p className="set-note">{t("set.note.memory")}</p>
        </Section>

        <Section title={t("set.section.agents")}>
          <Toggle label={t("set.agentReactions")} checked={s.ai.agentReactions} onChange={(v) => patch((d) => (d.ai.agentReactions = v))} />
          <AgentDetect exePath={exePath} />

          <p className="set-note">{t("set.note.agentIntro")}</p>
          <CopyBlock text={`${exePath} notify working --agent claude-code`} />
          <p className="set-note">{t("set.note.agentStatuses")}</p>

          <p className="set-note">{t("set.note.agentHook")}</p>
          <CopyBlock text={claudeCodeHook(exePath)} />

          <p className="set-note">{t("set.note.agentHttp")}</p>
          {agentInfo ? (
            <CopyBlock
              text={`POST http://127.0.0.1:${agentInfo.port}/agent/status
X-PixelPaw-Token: ${agentInfo.token}
{"agent":"claude-code","status":"working"}`}
            />
          ) : (
            <p className="set-note">{t("set.note.agentDown")}</p>
          )}
        </Section>
        </>
      )}

      {tab === "more" && (
        <>
        <Section title={t("set.section.music")}>
          <div className="set-media">
            {MEDIA_ORDER.map((action) => (
              <MediaBtn key={action} action={action} />
            ))}
          </div>
          <p className="set-note">{t("set.note.music")}</p>
        </Section>

        <Section title={t("set.section.privacy")}>
          <p className="set-note">{t("set.note.privacy")}</p>
          <PrivacyRow label={t("set.privacy.mouse")} on={i.gaze || i.hunt || i.drag || i.petting} desc={t("set.privacy.mouseDesc")} />
          <PrivacyRow label={t("set.privacy.keyboard")} on={i.keyboard || i.overheat} desc={t("set.privacy.keyboardDesc")} />
          <PrivacyRow label={t("set.privacy.scroll")} on={i.scroll} desc={t("set.privacy.scrollDesc")} />
        </Section>

        <Section title={t("set.section.diagnostics")}>
          <LastAgent />
          <LastCrash />
        </Section>

        <Section title={t("set.section.about")}>
          <p className="set-note">
            {t("set.about", { app: BRANDING.appName, version: BRANDING.version })}
          </p>
          <p className="set-note">
            {t("set.note.exit")}
          </p>
          <button className="set-btn danger" onClick={() => patch((d) => Object.assign(d, structuredClone(DEFAULT_SETTINGS)))}>
            {t("set.resetDefaults")}
          </button>
          <button className="set-btn danger" onClick={() => void invoke("quit_app")}>
            {t("set.quit", { app: BRANDING.appName })}
          </button>
        </Section>
        </>
      )}
      </div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * The last thing that broke, in plain sight.
 *
 * The pet's crash marker is small by necessity — it lives on the wallpaper.
 * This is where the whole record goes, so "why is there a red exclamation
 * mark?" has an answer that survives the marker being dismissed.
 */
/**
 * When an agent last reached the pet.
 *
 * A hook that silently does nothing looks exactly like an agent that has not
 * finished anything yet — the pet reacts for a few seconds either way and then
 * goes back to normal. This is the difference between "it's broken" and "it
 * hasn't happened yet", which is otherwise unanswerable.
 */
function LastAgent() {
  const [contact, setContact] = useState(() => readAgentContact());
  // Re-read on an interval: this window stays open while the user goes and
  // triggers their agent to see whether anything lands.
  useEffect(() => {
    const id = window.setInterval(() => setContact(readAgentContact()), 2000);
    return () => window.clearInterval(id);
  }, []);

  if (!contact) return <p className="set-note">{t("set.agentNever")}</p>;
  return (
    <p className="set-note">
      {t("set.agentLast", {
        who: contact.who,
        status: contact.status,
        ago: describeAge(contact.at),
      })}
    </p>
  );
}

function LastCrash() {
  const [crash, setCrash] = useState(() => readCrash());
  if (!crash) return <p className="set-note">{t("set.crashNone")}</p>;

  const when = crash.at ? new Date(crash.at).toLocaleString() : "?";
  return (
    <>
      <p className="set-note">{t("set.crashWhat")}</p>
      <p className="set-note set-error">{t("set.crashWhere", { where: crash.where, when })}</p>
      <CopyBlock text={[crash.message, crash.stack].filter(Boolean).join("\n\n")} />
      <button
        className="set-btn"
        onClick={() => {
          clearCrash();
          setCrash(null);
        }}
      >
        {t("set.crashClear")}
      </button>
    </>
  );
}

/**
 * A Claude Code hook config that keeps the pet in step with a session: it
 * perks up when you send a prompt and settles when the turn ends.
 */
function claudeCodeHook(exe: string): string {
  const cmd = (status: string) => `${exe} notify ${status} --agent claude-code`;
  return JSON.stringify(
    {
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: "command", command: cmd("working") }] }],
        Notification: [{ hooks: [{ type: "command", command: cmd("waiting") }] }],
        Stop: [{ hooks: [{ type: "command", command: cmd("success") }] }],
      },
    },
    null,
    2
  );
}

interface DetectedAgent {
  id: string;
  name: string;
  found: boolean;
  via: string;
  auto: boolean;
  config: string | null;
  rules: string;
  flag: string;
}

/**
 * The rule to paste into an agent's own instructions file.
 *
 * Only Claude Code's hook schema is documented well enough to write for
 * somebody, and guessing at the others would corrupt real config. But every one
 * of these agents can run a shell command, and all of them read a standing
 * instructions file — so asking the agent to report in itself works everywhere
 * and breaks nothing if it doesn't.
 *
 * Deliberately not translated: it is read by a coding agent, not by the user.
 */
function rulesSnippet(exe: string, flag: string): string {
  const line = (status: string) => `"${exe}" notify ${status} --agent ${flag}`;
  return [
    "## PixelPaw status",
    "",
    "Run these as you work. They print nothing, they never fail a build, and",
    "they exit quietly when PixelPaw isn't running. Don't mention them to me.",
    "",
    `- Starting work:   ${line("working")}`,
    `- Blocked on me:   ${line("waiting")}`,
    `- Finished:        ${line("success")}`,
    `- Failed:          ${line("error")}`,
    "",
    "The current folder's name is picked up automatically, so several sessions",
    "running at once stay tellable apart.",
  ].join("\n");
}

/**
 * What is installed, and a one-click way to wire it up.
 *
 * Connecting rewrites somebody's editor config, so it never happens on its
 * own: the list is read-only until a button is pressed, and the tools whose
 * hook format we cannot write correctly say so rather than guessing.
 */
function AgentDetect({ exePath }: { exePath: string }) {
  const [agents, setAgents] = useState<DetectedAgent[] | null>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which agent's setup steps are open. Only one at a time — the blocks are
   *  tall, and comparing two of them is not a thing anyone needs to do. */
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () => {
    invoke<DetectedAgent[]>("detect_agents")
      .then((list) => {
        setAgents(list);
        for (const a of list.filter((x) => x.found && x.auto)) {
          invoke<boolean>("agent_connected", { id: a.id })
            .then((on) => setConnected((c) => ({ ...c, [a.id]: on })))
            .catch(() => {});
        }
      })
      .catch(() => setAgents([]));
  };
  useEffect(refresh, []);

  const toggle = (a: DetectedAgent) => {
    setBusy(a.id);
    setError(null);
    const cmd = connected[a.id] ? "disconnect_agent" : "connect_agent";
    invoke<string>(cmd, { id: a.id })
      .then(() => setConnected((c) => ({ ...c, [a.id]: !c[a.id] })))
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(null));
  };

  if (!agents) return null;
  const found = agents.filter((a) => a.found);

  return (
    <>
      <p className="set-note">{t("set.detected")}</p>
      {found.length === 0 ? (
        <p className="set-note">{t("set.detectNone")}</p>
      ) : (
        <div className="set-agents">
          {found.map((a) => {
            const open = openId === a.id;
            return (
              <div key={a.id} className={"set-agent" + (open ? " open" : "")}>
                <div className="set-agent-row">
                  <span className={"set-dot " + (connected[a.id] ? "on" : "off")} />
                  <span className="set-agent-name">{a.name}</span>
                  {a.auto && (
                    <button
                      type="button"
                      className={"set-chip" + (connected[a.id] ? " on" : "")}
                      disabled={busy === a.id}
                      onClick={() => toggle(a)}
                    >
                      {connected[a.id] ? t("set.disconnect") : t("set.connect")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="set-chip ghost"
                    aria-expanded={open}
                    aria-controls={`agent-steps-${a.id}`}
                    onClick={() => setOpenId(open ? null : a.id)}
                  >
                    {open ? t("set.hideSteps") : t("set.showSteps")}
                  </button>
                </div>
                {open && (
                  <div className="set-agent-steps" id={`agent-steps-${a.id}`}>
                    {a.auto && <p className="set-note">{t("set.stepAlso")}</p>}
                    <p className="set-note">{t("set.stepPaste", { file: a.rules })}</p>
                    <CopyBlock text={rulesSnippet(exePath, a.flag)} />
                    <p className="set-note">{t("set.stepVerify")}</p>
                    <CopyBlock text={`"${exePath}" notify success --agent ${a.flag}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {found.some((a) => a.auto) && <p className="set-note">{t("set.note.connectWrites")}</p>}
      {error && <p className="set-note set-error">{error}</p>}
    </>
  );
}

/** A code block with a copy button, since every one of these is meant to be taken. */
function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <div className="set-copyblock">
      <pre className="set-code">{text}</pre>
      <button
        type="button"
        className="set-copy"
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => setCopied(true),
            () => setCopied(false)
          );
        }}
      >
        {copied ? t("set.copied") : t("set.copy")}
      </button>
    </div>
  );
}

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

function MediaBtn({ action }: { action: MediaAction }) {
  const label = MEDIA_LABELS[action];
  return (
    <button className="set-media-btn" title={label} aria-label={label} onClick={() => void mediaControl(action)}>
      <MediaIcon action={action} size={16} />
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

/**
 * Quick-pick chips. Each option sets one or more values at once, so the common
 * rhythms are a single click and the sliders below stay for anything else.
 */
function Presets({
  label,
  options,
}: {
  label: string;
  options: { label: string; hint?: string; active: boolean; apply: () => void }[];
}) {
  return (
    <div className="set-row set-presets">
      <span>{label}</span>
      <span className="set-chips">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            className={"set-chip" + (o.active ? " on" : "")}
            aria-pressed={o.active}
            title={o.hint}
            onClick={o.apply}
          >
            {o.label}
            {o.hint && <em>{o.hint}</em>}
          </button>
        ))}
      </span>
    </div>
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
      <span className={"set-privacy-state " + (on ? "on" : "off")}>
        {on ? t("set.privacy.active") : t("set.privacy.off")}
      </span>
      <span className="set-privacy-desc">{desc}</span>
    </div>
  );
}

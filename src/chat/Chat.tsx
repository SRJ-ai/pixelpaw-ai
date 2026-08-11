import { useEffect, useRef, useState } from "react";
import { PixelCat } from "@/pet/render/PixelCat";
import { characterById } from "@/config/characters";
import { t } from "@/config/i18n";
import { loadSettings } from "@/config/settings";
import { chat, providerInfo, type ChatMessage } from "@/ai/client";
import { memoryBlock } from "@/ai/memory";
import { systemPrompt } from "@/ai/personality";

interface Turn {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

/** Starter prompts for the empty state, so it shows the job rather than greeting. */
const SUGGESTIONS = ["chat.suggest1", "chat.suggest2", "chat.suggest3"] as const;

/**
 * Chat window (§29). Streams replies from whichever provider is configured.
 * If AI isn't set up yet it says so plainly rather than pretending to answer.
 */
export default function Chat() {
  const [settings] = useState(() => loadSettings());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<null | (() => void)>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ai = settings.ai;
  const char = characterById(settings.characterId);
  const info = providerInfo(ai.provider);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  /** `preset` lets an empty-state suggestion send without typing it first. */
  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    setInput("");
    const history: Turn[] = [...turns, { role: "user", content: text }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt({
          petName: settings.petName,
          userName: ai.userName || undefined,
          personality: ai.personality,
          language: ai.language,
          memory: memoryBlock(),
        }),
      },
      ...history.map((t) => ({ role: t.role, content: t.content }) as ChatMessage),
    ];

    const setLast = (fn: (prev: Turn) => Turn) =>
      setTurns((cur) => {
        const next = [...cur];
        next[next.length - 1] = fn(next[next.length - 1]);
        return next;
      });

    try {
      cancelRef.current = await chat(
        ai.provider,
        ai.model || info.defaultModel,
        messages,
        ai.baseUrl || undefined,
        {
          onChunk: (chunk) => setLast((p) => ({ ...p, content: p.content + chunk })),
          onDone: () => {
            setBusy(false);
            cancelRef.current = null;
          },
          onError: (msg) => {
            setLast((p) => ({ ...p, content: msg, error: true }));
            setBusy(false);
            cancelRef.current = null;
          },
        }
      );
    } catch (err) {
      // Setting up the stream can fail before any handler is wired. Without
      // this the turn sits on its typing dots and the button stays on Stop
      // with nothing to explain why.
      setLast((p) => ({ ...p, content: String(err), error: true }));
      setBusy(false);
      cancelRef.current = null;
    }
  }

  function stop() {
    cancelRef.current?.();
    cancelRef.current = null;
    setBusy(false);
  }

  return (
    <div className="chat-root">
      <header className="chat-header">
        <span className="chat-avatar">
          <PixelCat appearance={settings.appearance} accessories={char.accessories} />
        </span>
        <span>
          <strong>{settings.petName}</strong>
          <em className="chat-provider">{info.label}</em>
        </span>
        <button className="chat-clear" onClick={() => setTurns([])} title={t("chat.newTitle")}>
          {t("chat.new")}
        </button>
      </header>

      {!ai.enabled && (
        <div className="chat-notice">
          {t("chat.disabled")}
        </div>
      )}

      <div className="chat-log" ref={scrollRef}>
        {turns.length === 0 && (
          <div className="chat-empty">
            <p className="chat-empty-title">{t("chat.sayHello", { name: settings.petName })}</p>
            {ai.enabled && (
              <>
                <p className="chat-empty-hint">{t("chat.tryOne")}</p>
                <div className="chat-suggest">
                  {SUGGESTIONS.map((key) => (
                    <button key={key} type="button" className="set-chip" onClick={() => void send(t(key))}>
                      {t(key)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={`chat-turn ${turn.role}${turn.error ? " error" : ""}`}>
            {turn.content ||
              (busy && i === turns.length - 1 ? (
                <span className="chat-typing" role="status" aria-label={t("chat.thinking", { name: settings.petName })}>
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                ""
              ))}
          </div>
        ))}
      </div>

      <div className="chat-input">
        <textarea
          rows={2}
          value={input}
          placeholder={ai.enabled ? t("chat.placeholder") : t("chat.placeholderOff")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <button className="chat-send stop" onClick={stop}>
            {t("chat.stop")}
          </button>
        ) : (
          <button className="chat-send" onClick={() => void send()} disabled={!input.trim()}>
            {t("chat.send")}
          </button>
        )}
      </div>
    </div>
  );
}

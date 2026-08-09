import { useEffect, useRef, useState } from "react";
import { PixelCat } from "@/pet/render/PixelCat";
import { characterById } from "@/config/characters";
import { loadSettings } from "@/config/settings";
import { chat, providerInfo, type ChatMessage } from "@/ai/client";
import { memoryBlock } from "@/ai/memory";
import { systemPrompt } from "@/ai/personality";

interface Turn {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

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

  async function send() {
    const text = input.trim();
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
        <button className="chat-clear" onClick={() => setTurns([])} title="New conversation">
          New
        </button>
      </header>

      {!ai.enabled && (
        <div className="chat-notice">
          AI is turned off. Enable it in <strong>Settings → AI</strong> and pick a provider.
        </div>
      )}

      <div className="chat-log" ref={scrollRef}>
        {turns.length === 0 && (
          <p className="chat-empty">Say hello to {settings.petName} 🐾</p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`chat-turn ${t.role}${t.error ? " error" : ""}`}>
            {t.content || (busy && i === turns.length - 1 ? <span className="chat-dots">•••</span> : "")}
          </div>
        ))}
      </div>

      <div className="chat-input">
        <textarea
          rows={2}
          value={input}
          placeholder={ai.enabled ? "Message your pet…" : "Enable AI in Settings first"}
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
            Stop
          </button>
        ) : (
          <button className="chat-send" onClick={() => void send()} disabled={!input.trim()}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}

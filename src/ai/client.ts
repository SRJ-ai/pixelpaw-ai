/**
 * Front-end side of the AI layer. All network/process work happens in Rust
 * (src-tauri/src/ai.rs) — this module only sends a request and consumes the
 * streamed `ai:chunk` / `ai:done` / `ai:error` events. API keys never pass
 * through here.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type ProviderId =
  | "claude_code"
  | "anthropic"
  | "openai"
  | "gemini"
  | "openai_compatible"
  | "ollama";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Does this provider need an API key stored? */
  needsKey: boolean;
  /** Meaning of the optional `baseUrl` field, if any. */
  baseUrlLabel?: string;
  defaultModel: string;
  hint: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "claude_code",
    label: "Claude Code (CLI)",
    needsKey: false,
    baseUrlLabel: "Path to claude CLI (optional)",
    defaultModel: "",
    hint: "Uses your existing Claude Code login — no API key needed. Requires the Claude Code CLI (npm i -g @anthropic-ai/claude-code).",
  },
  {
    id: "anthropic",
    label: "Anthropic API",
    needsKey: true,
    defaultModel: "claude-sonnet-5",
    hint: "Get a key from console.anthropic.com.",
  },
  {
    id: "openai",
    label: "OpenAI",
    needsKey: true,
    defaultModel: "gpt-4o-mini",
    hint: "Get a key from platform.openai.com.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    needsKey: true,
    defaultModel: "gemini-2.0-flash",
    hint: "Get a key from aistudio.google.com.",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    needsKey: false,
    baseUrlLabel: "Ollama URL",
    defaultModel: "llama3.2",
    hint: "Runs fully offline. Install Ollama and pull a model first.",
  },
  {
    id: "openai_compatible",
    label: "OpenAI-compatible",
    needsKey: true,
    baseUrlLabel: "Base URL",
    defaultModel: "",
    hint: "LM Studio, vLLM, OpenRouter, etc. Point at the /v1 base URL.",
  },
];

export function providerInfo(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * Send a conversation and stream the reply. Returns a cancel function that
 * detaches the listeners (the request itself finishes in the background).
 */
export async function chat(
  provider: ProviderId,
  model: string,
  messages: ChatMessage[],
  baseUrl: string | undefined,
  handlers: StreamHandlers
): Promise<() => void> {
  const unlisten: UnlistenFn[] = [];
  let finished = false;

  const cleanup = () => {
    unlisten.forEach((u) => u());
    unlisten.length = 0;
  };
  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    cleanup();
    fn();
  };

  unlisten.push(await listen<string>("ai:chunk", (e) => handlers.onChunk(e.payload)));
  unlisten.push(await listen("ai:done", () => finish(handlers.onDone)));
  unlisten.push(
    await listen<string>("ai:error", (e) => finish(() => handlers.onError(e.payload)))
  );

  invoke("ai_chat", {
    req: { provider, model, messages, base_url: baseUrl || null },
  }).catch((err) => finish(() => handlers.onError(String(err))));

  return () => finish(() => {});
}

export async function setKey(provider: ProviderId, key: string): Promise<void> {
  await invoke("ai_set_key", { provider, key });
}

export async function hasKey(provider: ProviderId): Promise<boolean> {
  try {
    return await invoke<boolean>("ai_has_key", { provider });
  } catch {
    return false;
  }
}

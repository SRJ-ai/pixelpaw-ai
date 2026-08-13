//! AI provider layer (§27, §87).
//!
//! All provider HTTP happens here rather than in the webview, for two reasons:
//!   * API keys never enter the web layer — they're written to the app's local
//!     data dir and read only by this module (§64, §94).
//!   * The window keeps its strict `default-src 'self'` CSP; no remote origins
//!     are ever reachable from page scripts.
//!
//! Replies stream back to the UI as `ai:chunk` events, ending with `ai:done`
//! or `ai:error`.

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    /// "system" | "user" | "assistant"
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatRequest {
    /// "openai" | "anthropic" | "gemini" | "openai_compatible" | "ollama"
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    /// Base URL for the OpenAI-compatible / Ollama providers.
    #[serde(default)]
    pub base_url: Option<String>,
}

// ---------------------------------------------------------------- key storage

fn keys_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("no local data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("create data dir: {e}"))?;
    Ok(dir.join("keys.json"))
}

fn read_keys(app: &AppHandle) -> serde_json::Map<String, serde_json::Value> {
    keys_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn get_key(app: &AppHandle, provider: &str) -> Option<String> {
    read_keys(app)
        .get(provider)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

/// Store a provider's API key. The value is never read back out to the UI —
/// callers can only ask *whether* a key exists (`ai_has_key`).
#[tauri::command]
pub fn ai_set_key(app: AppHandle, provider: String, key: String) -> Result<(), String> {
    let mut keys = read_keys(&app);
    if key.is_empty() {
        keys.remove(&provider);
    } else {
        keys.insert(provider, serde_json::Value::String(key));
    }
    let path = keys_path(&app)?;
    fs::write(
        path,
        serde_json::to_string_pretty(&keys).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("write keys: {e}"))
}

#[tauri::command]
pub fn ai_has_key(app: AppHandle, provider: String) -> bool {
    get_key(&app, &provider).is_some()
}

// ------------------------------------------------------------------- chatting

/// Start a streaming chat completion. Chunks arrive as `ai:chunk` events.
#[tauri::command]
pub async fn ai_chat(app: AppHandle, req: ChatRequest) -> Result<(), String> {
    let result = run_chat(&app, req).await;
    match result {
        Ok(()) => {
            let _ = app.emit("ai:done", ());
            Ok(())
        }
        Err(e) => {
            let _ = app.emit("ai:error", e.clone());
            Err(e)
        }
    }
}

async fn run_chat(app: &AppHandle, req: ChatRequest) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("http client: {e}"))?;

    match req.provider.as_str() {
        "anthropic" => anthropic(app, &client, &req).await,
        "gemini" => gemini(app, &client, &req).await,
        "ollama" => ollama(app, &client, &req).await,
        "claude_code" => claude_code(app, &req).await,
        // OpenAI and any OpenAI-compatible endpoint share the same wire format.
        "openai" | "openai_compatible" => openai(app, &client, &req).await,
        other => Err(format!("unknown provider: {other}")),
    }
}

fn emit_chunk(app: &AppHandle, text: &str) {
    if !text.is_empty() {
        let _ = app.emit("ai:chunk", text.to_string());
    }
}

/// Consume an SSE body, handing each `data:` payload to `on_event`.
async fn stream_sse<F>(app: &AppHandle, resp: reqwest::Response, mut on_event: F) -> Result<(), String>
where
    F: FnMut(&AppHandle, &str),
{
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("{status}: {}", truncate(&body, 400)));
    }
    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("stream: {e}"))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        // SSE frames are separated by a blank line.
        while let Some(idx) = buf.find("\n\n") {
            let frame = buf[..idx].to_string();
            buf.drain(..idx + 2);
            for line in frame.lines() {
                if let Some(data) = line.strip_prefix("data:") {
                    let data = data.trim();
                    if data.is_empty() || data == "[DONE]" {
                        continue;
                    }
                    on_event(app, data);
                }
            }
        }
    }
    Ok(())
}

fn truncate(s: &str, n: usize) -> String {
    if s.len() <= n {
        s.to_string()
    } else {
        format!("{}…", &s[..n])
    }
}

// ----- OpenAI (and OpenAI-compatible: LM Studio, vLLM, OpenRouter, …) --------
async fn openai(app: &AppHandle, client: &reqwest::Client, req: &ChatRequest) -> Result<(), String> {
    let base = req
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));

    let mut request = client.post(url).json(&serde_json::json!({
        "model": req.model,
        "messages": req.messages,
        "stream": true,
    }));

    // A local OpenAI-compatible server usually needs no key.
    if let Some(key) = get_key(app, &req.provider) {
        request = request.bearer_auth(key);
    } else if req.provider == "openai" {
        return Err("No OpenAI API key set. Add one in Settings → AI.".into());
    }

    let resp = request.send().await.map_err(|e| format!("request: {e}"))?;
    stream_sse(app, resp, |app, data| {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
            if let Some(t) = v["choices"][0]["delta"]["content"].as_str() {
                emit_chunk(app, t);
            }
        }
    })
    .await
}

// ----- Anthropic ------------------------------------------------------------
async fn anthropic(app: &AppHandle, client: &reqwest::Client, req: &ChatRequest) -> Result<(), String> {
    let key = get_key(app, "anthropic")
        .ok_or("No Anthropic API key set. Add one in Settings → AI.")?;

    // Anthropic takes the system prompt as a top-level field.
    let system: String = req
        .messages
        .iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.clone())
        .collect::<Vec<_>>()
        .join("\n\n");
    let turns: Vec<&ChatMessage> = req.messages.iter().filter(|m| m.role != "system").collect();

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": req.model,
            "max_tokens": 1024,
            "system": system,
            "messages": turns,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;

    stream_sse(app, resp, |app, data| {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
            if v["type"] == "content_block_delta" {
                if let Some(t) = v["delta"]["text"].as_str() {
                    emit_chunk(app, t);
                }
            }
        }
    })
    .await
}

// ----- Gemini ---------------------------------------------------------------
async fn gemini(app: &AppHandle, client: &reqwest::Client, req: &ChatRequest) -> Result<(), String> {
    let key = get_key(app, "gemini").ok_or("No Gemini API key set. Add one in Settings → AI.")?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse",
        req.model
    );

    let system: String = req
        .messages
        .iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.clone())
        .collect::<Vec<_>>()
        .join("\n\n");
    let contents: Vec<serde_json::Value> = req
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": if m.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": m.content }],
            })
        })
        .collect();

    let mut body = serde_json::json!({ "contents": contents });
    if !system.is_empty() {
        body["systemInstruction"] = serde_json::json!({ "parts": [{ "text": system }] });
    }

    let resp = client
        .post(url)
        .header("x-goog-api-key", key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;

    stream_sse(app, resp, |app, data| {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
            if let Some(t) = v["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                emit_chunk(app, t);
            }
        }
    })
    .await
}

// ----- Claude Code CLI (uses the user's existing Claude Code auth) ----------
//
// Runs the CLI in non-interactive print mode with tools disabled — it answers as
// a chat model and cannot touch the filesystem or run commands from here.

/// Look for the Claude Code CLI on PATH and in the usual install locations.
fn find_claude_cli(explicit: Option<&str>) -> Option<PathBuf> {
    if let Some(p) = explicit.filter(|s| !s.is_empty()) {
        let path = PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(home) = std::env::var("USERPROFILE") {
        candidates.push(PathBuf::from(&home).join(".claude/local/claude.cmd"));
        candidates.push(PathBuf::from(&home).join(".claude/local/claude.exe"));
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        candidates.push(PathBuf::from(&appdata).join("npm/claude.cmd"));
    }
    // Honour a custom npm global prefix (npm config set prefix …).
    if let Ok(prefix) = std::env::var("NPM_CONFIG_PREFIX") {
        candidates.push(PathBuf::from(&prefix).join("claude.cmd"));
        candidates.push(PathBuf::from(&prefix).join("claude.exe"));
    }
    for c in candidates {
        if c.exists() {
            return Some(c);
        }
    }
    // Fall back to PATH resolution.
    which_on_path("claude")
}

fn which_on_path(bin: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let exts = [".cmd", ".exe", ""];
    for dir in std::env::split_paths(&path) {
        for ext in exts {
            let candidate = dir.join(format!("{bin}{ext}"));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

async fn claude_code(app: &AppHandle, req: &ChatRequest) -> Result<(), String> {
    let cli = find_claude_cli(req.base_url.as_deref()).ok_or(
        "Claude Code CLI not found. Install it with `npm i -g @anthropic-ai/claude-code`, \
         or set the full path in Settings → AI.",
    )?;

    // Flatten the conversation into a single prompt (print mode is stateless).
    let mut prompt = String::new();
    for m in &req.messages {
        match m.role.as_str() {
            "system" => prompt.push_str(&format!("{}\n\n", m.content)),
            "user" => prompt.push_str(&format!("User: {}\n", m.content)),
            "assistant" => prompt.push_str(&format!("You: {}\n", m.content)),
            _ => {}
        }
    }
    prompt.push_str("\nReply as the pet, briefly.");

    let cli_display = cli.display().to_string();
    let model = req.model.clone();
    // Blocking process I/O belongs off the async runtime's core threads.
    let output = tokio::task::spawn_blocking(move || {
        use std::io::Write;
        use std::process::Stdio;

        let mut cmd = std::process::Command::new(&cli);
        // The prompt goes in on stdin, never as an argument.
        //
        // npm installs the CLI as `claude.cmd` on Windows, and since Rust 1.77
        // (the fix for CVE-2024-24576) `Command` refuses to pass an argument to
        // a batch file that it cannot safely quote for cmd.exe. A chat prompt
        // has newlines in it, which cmd.exe has no escape for, so every message
        // failed with "batch file arguments are invalid" before it ever
        // launched. Piping also sidesteps cmd.exe's 8191-character command line,
        // which a few turns of conversation would have exceeded anyway.
        cmd.arg("-p");
        // No tool access: this is a chat companion, not an agent session, so it
        // must never read, write or run anything on the user's machine.
        cmd.arg("--disallowedTools");
        for tool in [
            "Bash",
            "Edit",
            "Write",
            "Read",
            "Glob",
            "Grep",
            "WebFetch",
            "WebSearch",
            "Task",
            "NotebookEdit",
        ] {
            cmd.arg(tool);
        }
        if !model.is_empty() {
            cmd.arg("--model").arg(&model);
        }
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }

        let mut child = cmd.spawn()?;
        // Dropping stdin closes the pipe, which is what tells the CLI the
        // prompt is complete; without it `claude -p` waits for EOF forever.
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(prompt.as_bytes())?;
        }
        child.wait_with_output()
    })
    .await
    .map_err(|e| format!("spawn: {e}"))?
    .map_err(|e| format!("running {cli_display}: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{} {}", err.trim(), out.trim());
        // The most common first-run failure deserves a plain-English fix.
        if combined.to_lowercase().contains("not logged in") || combined.contains("/login") {
            return Err(
                "Claude Code isn't logged in yet. Open a terminal, run `claude`, then use /login — \
                 after that this chat works with no API key."
                    .into(),
            );
        }
        return Err(format!(
            "Claude Code exited with {}: {}",
            output.status,
            truncate(combined.trim(), 400)
        ));
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Err("Claude Code returned no output.".into());
    }
    emit_chunk(app, &text);
    Ok(())
}

// ----- Ollama (local, no key needed) ---------------------------------------
async fn ollama(app: &AppHandle, client: &reqwest::Client, req: &ChatRequest) -> Result<(), String> {
    let base = req
        .base_url
        .clone()
        .unwrap_or_else(|| "http://localhost:11434".to_string());
    let url = format!("{}/api/chat", base.trim_end_matches('/'));

    let resp = client
        .post(url)
        .json(&serde_json::json!({
            "model": req.model,
            "messages": req.messages,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("request (is Ollama running?): {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("{status}: {}", truncate(&body, 400)));
    }

    // Ollama streams newline-delimited JSON rather than SSE.
    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("stream: {e}"))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(idx) = buf.find('\n') {
            let line = buf[..idx].trim().to_string();
            buf.drain(..idx + 1);
            if line.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(t) = v["message"]["content"].as_str() {
                    emit_chunk(app, t);
                }
            }
        }
    }
    Ok(())
}

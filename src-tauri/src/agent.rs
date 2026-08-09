//! Local agent-status API (§40–42).
//!
//! Any coding agent (Claude Code, Codex, Cursor, a script…) can tell the pet what
//! it's doing by POSTing to a tiny loopback endpoint:
//!
//! ```text
//! POST http://127.0.0.1:8787/agent/status
//! X-PixelPaw-Token: <token>
//! {"agent":"claude-code","status":"working"}
//! ```
//!
//! Security (§64, §94): binds to 127.0.0.1 only (never a public interface),
//! requires a token generated per install, caps the request body, and accepts a
//! fixed set of status strings. It executes nothing — it only forwards a status
//! to the UI as an `agent:status` event.

use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener, TcpStream};
use std::path::PathBuf;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

pub const PORT: u16 = 8787;
const MAX_BODY: usize = 4096;
const VALID: [&str; 7] = [
    "idle",
    "working",
    "thinking",
    "waiting",
    "success",
    "error",
    "cancelled",
];

#[derive(Clone, Serialize)]
struct AgentStatus {
    agent: String,
    status: String,
}

fn token_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_local_data_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("agent-token.txt"))
}

/// Read the install's token, generating one on first run.
pub fn token(app: &AppHandle) -> String {
    let path = match token_path(app) {
        Some(p) => p,
        None => return String::new(),
    };
    if let Ok(t) = fs::read_to_string(&path) {
        let t = t.trim().to_string();
        if !t.is_empty() {
            return t;
        }
    }
    // Good enough for a loopback-only handshake: time + address entropy, hashed.
    let seed = format!(
        "{:?}-{:p}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default(),
        &path
    );
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for b in seed.as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x1000_0000_01b3);
    }
    let tok = format!("{hash:016x}");
    let _ = fs::write(&path, &tok);
    tok
}

#[tauri::command]
pub fn agent_info(app: AppHandle) -> serde_json::Value {
    serde_json::json!({ "port": PORT, "token": token(&app) })
}

pub fn spawn(app: AppHandle) {
    thread::spawn(move || {
        let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, PORT);
        let listener = match TcpListener::bind(addr) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[PixelPaw] agent API disabled — port {PORT} unavailable: {e}");
                return;
            }
        };
        let expected = token(&app);
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            let expected = expected.clone();
            // Handle inline: traffic is a trickle of tiny local POSTs.
            if let Err(e) = handle(&app, stream, &expected) {
                eprintln!("[PixelPaw] agent request error: {e}");
            }
        }
    });
}

fn handle(app: &AppHandle, mut stream: TcpStream, expected: &str) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);

    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");

    let mut content_length = 0usize;
    let mut token_header = String::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 {
            break;
        }
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            break;
        }
        if let Some((k, v)) = trimmed.split_once(':') {
            let k = k.trim().to_ascii_lowercase();
            let v = v.trim();
            match k.as_str() {
                "content-length" => content_length = v.parse().unwrap_or(0),
                "x-pixelpaw-token" => token_header = v.to_string(),
                _ => {}
            }
        }
    }

    if method != "POST" || path != "/agent/status" {
        return respond(&mut stream, 404, r#"{"error":"not found"}"#);
    }
    if token_header != expected {
        return respond(&mut stream, 401, r#"{"error":"bad token"}"#);
    }
    if content_length > MAX_BODY {
        return respond(&mut stream, 413, r#"{"error":"body too large"}"#);
    }

    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body)?;

    let parsed: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return respond(&mut stream, 400, r#"{"error":"invalid json"}"#),
    };
    let status = parsed["status"].as_str().unwrap_or("").to_ascii_lowercase();
    if !VALID.contains(&status.as_str()) {
        return respond(&mut stream, 400, r#"{"error":"invalid status"}"#);
    }
    let agent = parsed["agent"]
        .as_str()
        .unwrap_or("agent")
        .chars()
        .take(40)
        .collect::<String>();

    let _ = app.emit("agent:status", AgentStatus { agent, status });
    respond(&mut stream, 200, r#"{"ok":true}"#)
}

fn respond(stream: &mut TcpStream, code: u16, body: &str) -> std::io::Result<()> {
    let reason = match code {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        413 => "Payload Too Large",
        _ => "Error",
    };
    write!(
        stream,
        "HTTP/1.1 {code} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )?;
    stream.flush()
}

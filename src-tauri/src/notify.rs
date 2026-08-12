//! `pixelpaw-ai.exe notify <status>` — the one-line way to drive the pet from a
//! coding agent, a build script, or a shell.
//!
//! The loopback API in `agent.rs` has always been able to do this, but using it
//! meant opening Settings, copying the per-install token, and hand-writing an
//! HTTP POST with the right header and JSON body. Almost nobody does that, so
//! the app's best developer feature went unused. This subcommand finds the
//! token itself and makes the request, which turns the whole thing into:
//!
//! ```text
//! pixelpaw-ai.exe notify working
//! pixelpaw-ai.exe notify success --agent claude-code
//! ```
//!
//! It runs before Tauri starts, so it never launches a second app. If the pet
//! is not running there is nothing to tell, and it exits 0 rather than failing
//! the build it was called from.

use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::path::PathBuf;
use std::time::Duration;

use crate::agent::PORT;

/// Matches the app identifier in tauri.conf.json, which is what Tauri uses for
/// the local data directory the token is written into.
const IDENTIFIER: &str = "com.pixelpaw.ai";
const TIMEOUT: Duration = Duration::from_millis(1500);

const USAGE: &str = "\
PixelPaw AI

  pixelpaw-ai notify <status> [--agent <name>]

Tells the running pet what your agent or build is doing.

Statuses
  working     started, or still going
  thinking    reasoning, no output yet
  waiting     blocked on you
  success     finished cleanly
  error       failed
  cancelled   interrupted
  idle        nothing in progress

Options
  --agent <name>   who is reporting (default: agent)

Exits 0 when the pet is not running, so it is safe in a build script.
";

/// The same directory `agent.rs` writes the token into.
fn local_data_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join(IDENTIFIER))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var_os("HOME")
            .map(|p| PathBuf::from(p).join("Library/Application Support").join(IDENTIFIER))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|p| PathBuf::from(p).join(".local/share")))
            .map(|p| p.join(IDENTIFIER))
    }
}

fn read_token() -> Option<String> {
    let path = local_data_dir()?.join("agent-token.txt");
    let tok = std::fs::read_to_string(path).ok()?.trim().to_string();
    if tok.is_empty() {
        None
    } else {
        Some(tok)
    }
}

fn post(status: &str, agent: &str, token: &str) -> std::io::Result<u16> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, PORT);
    let mut stream = TcpStream::connect_timeout(&addr.into(), TIMEOUT)?;
    stream.set_read_timeout(Some(TIMEOUT))?;
    stream.set_write_timeout(Some(TIMEOUT))?;

    let body = serde_json::json!({ "agent": agent, "status": status }).to_string();
    write!(
        stream,
        "POST /agent/status HTTP/1.1\r\n\
         Host: 127.0.0.1:{PORT}\r\n\
         Content-Type: application/json\r\n\
         X-PixelPaw-Token: {token}\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n{body}",
        body.len()
    )?;
    stream.flush()?;

    let mut response = String::new();
    let _ = stream.take(512).read_to_string(&mut response);
    Ok(response
        .split_whitespace()
        .nth(1)
        .and_then(|c| c.parse().ok())
        .unwrap_or(0))
}

/// Release builds link as a Windows GUI app so double-clicking the icon does
/// not flash a console. That also means a subcommand run from a terminal has
/// nowhere to print: output vanishes, or lands in the next command's window.
/// Borrowing the caller's console fixes both, and does nothing when there
/// isn't one (a hook launched from a service, say).
#[cfg(windows)]
fn attach_parent_console() {
    // ATTACH_PARENT_PROCESS
    const PARENT: u32 = 0xFFFF_FFFF;
    extern "system" {
        fn AttachConsole(dwProcessId: u32) -> i32;
    }
    unsafe {
        AttachConsole(PARENT);
    }
}

#[cfg(not(windows))]
fn attach_parent_console() {}

/// Handle a CLI subcommand if one was given. Returns the process exit code when
/// this invocation was a command rather than a request to launch the app.
pub fn handle_cli() -> Option<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let first = args.first()?.as_str();

    if !matches!(first, "notify" | "-h" | "--help" | "help") {
        return None;
    }
    attach_parent_console();

    if first != "notify" {
        print!("{USAGE}");
        let _ = std::io::stdout().flush();
        return Some(0);
    }

    let Some(status) = args.get(1).map(|s| s.to_ascii_lowercase()) else {
        eprint!("{USAGE}");
        let _ = std::io::stderr().flush();
        return Some(2);
    };

    let mut agent = "agent".to_string();
    let mut rest = args.iter().skip(2);
    while let Some(flag) = rest.next() {
        if flag == "--agent" {
            if let Some(name) = rest.next() {
                agent = name.clone();
            }
        }
    }

    let Some(token) = read_token() else {
        // No token means the app has never run on this machine. Not an error
        // worth failing a build over.
        eprintln!("pixelpaw: no token yet — start PixelPaw once first");
        return Some(0);
    };

    let code = match post(&status, &agent, &token) {
        Ok(200) => Some(0),
        Ok(400) => {
            eprintln!("pixelpaw: '{status}' is not a valid status (see --help)");
            Some(2)
        }
        Ok(401) => {
            eprintln!("pixelpaw: token rejected — reinstalling regenerates it");
            Some(2)
        }
        Ok(code) => {
            eprintln!("pixelpaw: unexpected response {code}");
            Some(2)
        }
        // Nothing listening: the pet is not running. Stay quiet and succeed.
        Err(_) => Some(0),
    };
    let _ = std::io::stderr().flush();
    code
}

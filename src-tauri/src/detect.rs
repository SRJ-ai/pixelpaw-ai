//! Finding the coding agents already installed, so connecting one is a click
//! rather than a copy-paste job.
//!
//! Two probes, because neither alone is enough: some tools put a launcher on
//! PATH, others only leave a config directory in the home folder. Antigravity,
//! for instance, installs as `~/.antigravity-ide` with nothing on PATH.
//!
//! This module only ever *reads*. Writing into a developer's tool config is
//! done by `connect`, and only when the user has clicked to allow it.

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
pub struct Detected {
    pub id: &'static str,
    pub name: &'static str,
    pub found: bool,
    /// "path" | "config" | "" — how we know, so the UI can be specific.
    pub via: &'static str,
    /// Whether we can write this tool's hook config ourselves. False means we
    /// show a snippet instead of guessing at a format we do not know.
    pub auto: bool,
    /// The config file we would touch, when we can write one.
    pub config: Option<String>,
    /// The file this tool reads standing instructions from, relative to the
    /// project. Every agent that can run a shell command can drive the pet if
    /// it is *told* to, so this is the answer for the tools whose hook format
    /// we will not guess at: paste a rule here instead.
    pub rules: &'static str,
    /// What to pass to `--agent`, so several tools running at once stay
    /// tellable apart in the pet's speech bubble.
    pub flag: &'static str,
}

struct Tool {
    id: &'static str,
    name: &'static str,
    bins: &'static [&'static str],
    /// Home-relative directories whose presence means the tool is installed.
    dirs: &'static [&'static str],
    auto: bool,
    rules: &'static str,
}

const TOOLS: &[Tool] = &[
    Tool {
        id: "claude-code",
        name: "Claude Code",
        bins: &["claude"],
        dirs: &[".claude"],
        // Its hook schema is documented and stable, so we can write it.
        auto: true,
        rules: "CLAUDE.md",
    },
    Tool {
        id: "codex",
        name: "Codex CLI",
        bins: &["codex"],
        dirs: &[".codex"],
        auto: false,
        rules: "AGENTS.md",
    },
    Tool {
        id: "cursor",
        name: "Cursor",
        bins: &["cursor"],
        dirs: &[".cursor"],
        auto: false,
        rules: ".cursor/rules/pixelpaw.mdc",
    },
    Tool {
        id: "antigravity",
        name: "Antigravity",
        bins: &["antigravity"],
        dirs: &[".antigravity", ".antigravity-ide"],
        auto: false,
        rules: "AGENTS.md",
    },
    Tool {
        id: "kiro",
        name: "Kiro",
        bins: &["kiro"],
        dirs: &[".kiro"],
        auto: false,
        rules: ".kiro/steering/pixelpaw.md",
    },
    Tool {
        id: "gemini",
        name: "Gemini CLI",
        bins: &["gemini"],
        dirs: &[".gemini"],
        auto: false,
        rules: "GEMINI.md",
    },
];

pub fn home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

/// A `which`, honouring PATHEXT on Windows — `claude` is commonly a .ps1 or
/// .cmd shim rather than an .exe, and a bare-name check would miss it.
fn on_path(bin: &str) -> bool {
    let Some(paths) = std::env::var_os("PATH") else {
        return false;
    };
    let exts: Vec<String> = if cfg!(windows) {
        std::env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.CMD;.BAT;.PS1".into())
            .split(';')
            .filter(|e| !e.is_empty())
            .map(|e| e.to_ascii_lowercase())
            .collect()
    } else {
        vec![String::new()]
    };
    std::env::split_paths(&paths).any(|dir| {
        if dir.join(bin).is_file() {
            return true;
        }
        exts.iter().any(|ext| dir.join(format!("{bin}{ext}")).is_file())
    })
}

fn claude_settings_path() -> Option<PathBuf> {
    Some(home()?.join(".claude").join("settings.json"))
}

#[tauri::command]
pub fn detect_agents() -> Vec<Detected> {
    let home = home();
    TOOLS
        .iter()
        .map(|t| {
            let by_path = t.bins.iter().any(|b| on_path(b));
            let by_dir = home
                .as_ref()
                .map(|h| t.dirs.iter().any(|d| h.join(d).is_dir()))
                .unwrap_or(false);
            Detected {
                id: t.id,
                name: t.name,
                found: by_path || by_dir,
                via: if by_path {
                    "path"
                } else if by_dir {
                    "config"
                } else {
                    ""
                },
                auto: t.auto,
                config: if t.id == "claude-code" {
                    claude_settings_path().map(|p| p.to_string_lossy().into_owned())
                } else {
                    None
                },
                rules: t.rules,
                flag: t.id,
            }
        })
        .collect()
}

/// Every hook command we write carries this, so `disconnect` can find exactly
/// what we added and leave everything else alone.
const MARKER: &str = "notify";

fn hook_entry(exe: &str, status: &str) -> serde_json::Value {
    serde_json::json!({
        "hooks": [{
            "type": "command",
            "command": format!("\"{exe}\" {MARKER} {status} --agent claude-code")
        }]
    })
}

fn is_ours(entry: &serde_json::Value, exe: &str) -> bool {
    entry["hooks"]
        .as_array()
        .map(|hooks| {
            hooks.iter().any(|h| {
                h["command"]
                    .as_str()
                    .map(|c| c.contains(exe) && c.contains(MARKER))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn read_json(path: &Path) -> serde_json::Value {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn write_json(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // Keep a copy of whatever was there first. This is somebody's editor
    // config; it should always be possible to put it back by hand.
    if path.is_file() {
        let backup = path.with_extension("json.pixelpaw-backup");
        let _ = std::fs::copy(path, backup);
    }
    let body = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(path, body).map_err(|e| e.to_string())
}

const EVENTS: [(&str, &str); 3] = [
    ("UserPromptSubmit", "working"),
    ("Notification", "waiting"),
    ("Stop", "success"),
];

/// Merge our hooks into an existing settings object. Pure, so the part that can
/// damage somebody's config is testable without touching a real file.
fn apply_hooks(mut root: serde_json::Value, exe: &str) -> serde_json::Value {
    for (event, status) in EVENTS {
        let list = root["hooks"][event]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            // Drop any previous entry of ours so reconnecting cannot stack up.
            .filter(|e| !is_ours(e, exe))
            .chain(std::iter::once(hook_entry(exe, status)))
            .collect::<Vec<_>>();
        root["hooks"][event] = serde_json::Value::Array(list);
    }
    root
}

/// Strip only our hooks back out, leaving every other entry in place.
fn remove_hooks(mut root: serde_json::Value, exe: &str) -> serde_json::Value {
    for (event, _) in EVENTS {
        let Some(list) = root["hooks"][event].as_array().cloned() else {
            continue;
        };
        let kept: Vec<_> = list.into_iter().filter(|e| !is_ours(e, exe)).collect();
        if kept.is_empty() {
            if let Some(hooks) = root["hooks"].as_object_mut() {
                hooks.remove(event);
            }
        } else {
            root["hooks"][event] = serde_json::Value::Array(kept);
        }
    }
    // Do not leave an empty "hooks": {} behind that we invented.
    if root["hooks"].as_object().map(|o| o.is_empty()).unwrap_or(false) {
        if let Some(obj) = root.as_object_mut() {
            obj.remove("hooks");
        }
    }
    root
}

/// Add our hooks to Claude Code's settings. Called only from an explicit click.
#[tauri::command]
pub fn connect_agent(id: String) -> Result<String, String> {
    if id != "claude-code" {
        return Err("this tool has to be connected by hand".into());
    }
    let path = claude_settings_path().ok_or("no home directory")?;
    let exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())?;

    let root = read_json(&path);
    if !root.is_object() {
        return Err("settings.json is not a JSON object".into());
    }
    write_json(&path, &apply_hooks(root, &exe))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Remove only the hooks we added, leaving the rest of the file untouched.
#[tauri::command]
pub fn disconnect_agent(id: String) -> Result<String, String> {
    if id != "claude-code" {
        return Err("this tool has to be disconnected by hand".into());
    }
    let path = claude_settings_path().ok_or("no home directory")?;
    if !path.is_file() {
        return Ok(path.to_string_lossy().into_owned());
    }
    let exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())?;

    let root = read_json(&path);
    write_json(&path, &remove_hooks(root, &exe))?;
    Ok(path.to_string_lossy().into_owned())
}

/// True when our hooks are currently present, so the UI can show the real
/// state instead of remembering what it did last.
#[tauri::command]
pub fn agent_connected(id: String) -> bool {
    if id != "claude-code" {
        return false;
    }
    let Some(path) = claude_settings_path() else {
        return false;
    };
    let Ok(exe) = std::env::current_exe().map(|p| p.to_string_lossy().into_owned()) else {
        return false;
    };
    let root = read_json(&path);
    EVENTS.iter().all(|(event, _)| {
        root["hooks"][event]
            .as_array()
            .map(|l| l.iter().any(|e| is_ours(e, &exe)))
            .unwrap_or(false)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXE: &str = "C:\\Apps\\PixelPaw\\pixelpaw-ai.exe";

    /// Someone else's hook, which must survive everything we do.
    fn foreign() -> serde_json::Value {
        serde_json::json!({ "hooks": [{ "type": "command", "command": "echo hi" }] })
    }

    #[test]
    fn adds_a_hook_for_every_event() {
        let out = apply_hooks(serde_json::json!({}), EXE);
        for (event, _) in EVENTS {
            let list = out["hooks"][event].as_array().expect("event present");
            assert_eq!(list.len(), 1);
            assert!(is_ours(&list[0], EXE));
        }
    }

    #[test]
    fn keeps_unrelated_settings_and_hooks() {
        let before = serde_json::json!({
            "model": "opus",
            "hooks": { "UserPromptSubmit": [foreign()] }
        });
        let out = apply_hooks(before, EXE);
        assert_eq!(out["model"], "opus");
        let list = out["hooks"]["UserPromptSubmit"].as_array().unwrap();
        assert_eq!(list.len(), 2, "the existing hook must still be there");
        assert_eq!(list[0], foreign());
    }

    #[test]
    fn connecting_twice_does_not_stack_up() {
        let once = apply_hooks(serde_json::json!({}), EXE);
        let twice = apply_hooks(once.clone(), EXE);
        assert_eq!(once, twice);
        assert_eq!(twice["hooks"]["Stop"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn disconnecting_removes_only_ours() {
        let before = serde_json::json!({
            "model": "opus",
            "hooks": { "UserPromptSubmit": [foreign()] }
        });
        let out = remove_hooks(apply_hooks(before.clone(), EXE), EXE);
        assert_eq!(out, before, "round trip must land back where it started");
    }

    #[test]
    fn disconnecting_leaves_no_empty_scaffolding() {
        let out = remove_hooks(apply_hooks(serde_json::json!({}), EXE), EXE);
        assert_eq!(out, serde_json::json!({}), "no orphan hooks object");
    }

    #[test]
    fn another_installs_hook_is_not_mistaken_for_ours() {
        let other = serde_json::json!({
            "hooks": [{ "type": "command", "command": "\"D:\\\\Other\\\\pixelpaw-ai.exe\" notify working" }]
        });
        assert!(!is_ours(&other, EXE));
        let kept = remove_hooks(
            serde_json::json!({ "hooks": { "Stop": [other.clone()] } }),
            EXE,
        );
        assert_eq!(kept["hooks"]["Stop"].as_array().unwrap()[0], other);
    }
}

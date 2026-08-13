//! Parking the pet beside the agent you are actually talking to.
//!
//! Watching a coding agent means watching the bottom of a terminal: you type,
//! it works, you wait. The pet living in the corner of the screen is the wrong
//! place for that — you have to look away from the thing you are waiting on to
//! see whether it is done. So when a window belonging to a coding agent takes
//! focus, the pet moves to sit just above its message pane, and goes back where
//! it was when you leave.
//!
//! This module only ever *decides*. It never moves the window: it publishes a
//! target and the engine applies it, because the engine is already the single
//! owner of the pet's position (drag, walk, peek all live there) and two owners
//! would fight every frame.

use serde::Serialize;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::window::PET_LABEL;

/// How often the foreground window is checked. Focus changes are a human-scale
/// event; polling faster buys nothing and costs a wakeup.
const POLL_MS: u64 = 400;

/// Roughly how tall an agent's input pane is, in physical pixels. The pet sits
/// above this so it never covers what you are typing.
const INPUT_PANE_PX: i32 = 130;

/// Gap between the pet and the right edge of the agent's window.
const EDGE_MARGIN_PX: i32 = 20;

#[derive(Clone, Serialize)]
pub struct DockTarget {
    x: i32,
    y: i32,
    /// Which tool we recognised, so the pet can name it.
    app: String,
}

/// Windows that host a coding agent.
///
/// Matched on the executable, because the agent itself is usually a process
/// inside a terminal and has no window of its own — `claude` running in Windows
/// Terminal *is* WindowsTerminal.exe.
const HOSTS: &[(&str, &str)] = &[
    ("windowsterminal.exe", "terminal"),
    ("wt.exe", "terminal"),
    ("powershell.exe", "terminal"),
    ("pwsh.exe", "terminal"),
    ("cmd.exe", "terminal"),
    ("alacritty.exe", "terminal"),
    ("wezterm-gui.exe", "terminal"),
    ("hyper.exe", "terminal"),
    ("code.exe", "VS Code"),
    ("cursor.exe", "Cursor"),
    ("windsurf.exe", "Windsurf"),
    ("antigravity.exe", "Antigravity"),
    ("kiro.exe", "Kiro"),
];

/// Titles that identify the agent outright, whatever it is running inside.
/// Checked first, so a terminal running Claude Code is named as Claude Code
/// rather than as a terminal.
const TITLE_HINTS: &[(&str, &str)] = &[
    ("claude", "Claude Code"),
    ("codex", "Codex"),
    ("gemini", "Gemini CLI"),
    ("antigravity", "Antigravity"),
    ("cursor", "Cursor"),
    ("kiro", "Kiro"),
];

/// Decide whether a foreground window is worth docking to, and what to call it.
///
/// Pure, and separated from every Windows call, because the interesting part is
/// the matching rather than the plumbing — and because getting it wrong means
/// the pet jumps onto a window the user never asked it to follow.
pub fn recognise(exe: &str, title: &str) -> Option<String> {
    let exe = exe.rsplit(['\\', '/']).next().unwrap_or(exe).to_ascii_lowercase();
    let title_lc = title.to_ascii_lowercase();

    let host = HOSTS.iter().find(|(bin, _)| *bin == exe);

    // A title hint only counts inside a window that could plausibly host an
    // agent. Without that guard, a browser tab reading the Claude docs — or
    // this project's own editor, whose title contains the word — would drag the
    // pet across the screen.
    if host.is_some() {
        if let Some((_, name)) = TITLE_HINTS.iter().find(|(k, _)| title_lc.contains(k)) {
            return Some((*name).to_string());
        }
    }

    match host {
        // A bare terminal with nothing recognisable in its title is just a
        // terminal. Following it would make the pet follow every shell.
        Some((_, "terminal")) => None,
        Some((_, name)) => Some((*name).to_string()),
        None => None,
    }
}

#[cfg(windows)]
mod sys {
    use std::os::windows::ffi::OsStringExt;

    /// The foreground window's executable path, title, and screen rectangle.
    pub fn foreground() -> Option<(String, String, (i32, i32, i32, i32))> {
        use winapi::um::handleapi::CloseHandle;
        use winapi::um::processthreadsapi::OpenProcess;
        use winapi::um::winbase::QueryFullProcessImageNameW;
        use winapi::um::winnt::PROCESS_QUERY_LIMITED_INFORMATION;
        use winapi::um::winuser::{
            GetForegroundWindow, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId,
        };

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }

            let mut rect = std::mem::zeroed();
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return None;
            }

            let mut title = [0u16; 512];
            let n = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
            let title = std::ffi::OsString::from_wide(&title[..n.max(0) as usize])
                .to_string_lossy()
                .into_owned();

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 {
                return None;
            }

            // LIMITED_INFORMATION is the least we can ask for and still read a
            // path; it works without elevation, which the full query does not.
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return None;
            }
            let mut buf = [0u16; 512];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut len);
            CloseHandle(handle);
            if ok == 0 {
                return None;
            }
            let exe = std::ffi::OsString::from_wide(&buf[..len as usize])
                .to_string_lossy()
                .into_owned();

            Some((
                exe,
                title,
                (rect.left, rect.top, rect.right, rect.bottom),
            ))
        }
    }
}

#[cfg(not(windows))]
mod sys {
    pub fn foreground() -> Option<(String, String, (i32, i32, i32, i32))> {
        None
    }
}

/// Where the pet should sit for a given agent window: hard against the right
/// edge, above the input pane. Clamped so a maximised or oddly-shaped window
/// cannot push the pet off its own screen.
fn target_for(rect: (i32, i32, i32, i32), pet_w: i32, pet_h: i32) -> (i32, i32) {
    let (left, top, right, bottom) = rect;
    let x = (right - pet_w - EDGE_MARGIN_PX).max(left);
    let y = (bottom - pet_h - INPUT_PANE_PX).max(top);
    (x, y)
}

pub fn spawn(app: AppHandle) {
    thread::spawn(move || {
        let mut docked: Option<String> = None;
        // What was last sent, so an unchanged target costs nothing. Focus
        // rarely changes, but this thread wakes 2.5 times a second.
        let mut last: Option<(i32, i32, String)> = None;

        loop {
            thread::sleep(Duration::from_millis(POLL_MS));

            if !super::window::dock_enabled() {
                if docked.take().is_some() {
                    last = None;
                    let _ = app.emit("dock:release", ());
                }
                continue;
            }

            let Some(win) = app.get_webview_window(PET_LABEL) else {
                continue;
            };
            let Ok(size) = win.outer_size() else { continue };

            let found = sys::foreground().and_then(|(exe, title, rect)| {
                recognise(&exe, &title).map(|name| (name, rect))
            });

            match found {
                Some((name, rect)) => {
                    let (x, y) = target_for(rect, size.width as i32, size.height as i32);
                    // Sent whenever it changes rather than only on focus: the
                    // agent's window can be moved or resized without focus ever
                    // changing, and the pet should travel with it.
                    let next = (x, y, name.clone());
                    if last.as_ref() != Some(&next) {
                        let _ = app.emit("dock:target", DockTarget { x, y, app: name.clone() });
                        last = Some(next);
                    }
                    docked = Some(name);
                }
                None => {
                    if docked.take().is_some() {
                        last = None;
                        let _ = app.emit("dock:release", ());
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_agent_from_the_terminal_title() {
        let got = recognise("C:\\Program Files\\WindowsTerminal.exe", "claude — pixelpaw-ai");
        assert_eq!(got.as_deref(), Some("Claude Code"));
    }

    #[test]
    fn a_plain_shell_is_not_an_agent() {
        assert_eq!(recognise("C:\\Windows\\System32\\cmd.exe", "C:\\Users\\me"), None);
        assert_eq!(recognise("pwsh.exe", "Windows PowerShell"), None);
    }

    #[test]
    fn an_editor_counts_on_its_own() {
        assert_eq!(recognise("D:\\apps\\Antigravity.exe", "main.rs"), Some("Antigravity".into()));
        assert_eq!(recognise("Cursor.exe", "untitled"), Some("Cursor".into()));
    }

    #[test]
    fn a_browser_reading_the_docs_is_left_alone() {
        // The exact case the title guard exists for.
        assert_eq!(recognise("chrome.exe", "Claude Code docs — Anthropic"), None);
        assert_eq!(recognise("explorer.exe", "codex"), None);
    }

    #[test]
    fn matching_ignores_case_and_path_shape() {
        assert_eq!(recognise("C:/Apps/CODE.EXE", "x"), Some("VS Code".into()));
    }

    #[test]
    fn the_pet_sits_inside_the_window_above_the_input() {
        let (x, y) = target_for((100, 100, 1000, 800), 300, 300);
        assert_eq!(x, 1000 - 300 - EDGE_MARGIN_PX);
        assert_eq!(y, 800 - 300 - INPUT_PANE_PX);
    }

    #[test]
    fn a_window_smaller_than_the_pet_never_pushes_it_outside() {
        let (x, y) = target_for((400, 400, 600, 600), 300, 300);
        assert_eq!((x, y), (400, 400), "clamped to the window's own corner");
    }
}

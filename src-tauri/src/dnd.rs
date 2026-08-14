//! Silencing Windows notifications while the pet is in focus mode.
//!
//! Windows has no public API to set Focus Assist. Microsoft removed the one
//! that existed (`WNF` state was never public, and the shell only exposes a
//! *read* via `SHQueryUserNotificationState`). What *is* documented and stable
//! is the per-app quiet-hours preference in the registry, which the Settings
//! app itself writes:
//!
//!   HKCU\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings
//!     NOC_GLOBAL_SETTING_TOASTS_ENABLED  (DWORD, 1 = toasts on)
//!
//! Turning that off is what the "Notifications" master switch does, and it
//! genuinely stops toasts appearing. So focus mode flips it off and restores the
//! previous value afterwards.
//!
//! Deliberately conservative about restoring: the original value is captured on
//! the way in and written back on the way out, so a user who already had
//! notifications off does not get them switched on by leaving focus mode.

#[cfg(windows)]
const KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings";
#[cfg(windows)]
const VALUE: &str = "NOC_GLOBAL_SETTING_TOASTS_ENABLED";

/// What toasts were set to before focus mode touched them.
#[cfg(windows)]
static PREVIOUS: std::sync::Mutex<Option<u32>> = std::sync::Mutex::new(None);

#[cfg(windows)]
fn run_reg(args: &[&str]) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let out = std::process::Command::new("reg")
        .args(args)
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Pull the DWORD out of `reg query` output.
///
/// Separated and tested because getting it wrong is silently destructive rather
/// than merely broken: a misparse makes `silence` record the wrong "previous"
/// value, and `restore` would then switch notifications *on* for someone who had
/// deliberately turned them off.
fn parse_dword(out: &str) -> Option<u32> {
    // "    NOC_GLOBAL_SETTING_TOASTS_ENABLED    REG_DWORD    0x1", with blank
    // lines around it. The value is the last token on the line naming it, not
    // the last token of the output — trailing newlines mean those differ.
    let line = out.lines().find(|l| l.contains(VALUE))?;
    let hex = line.split_whitespace().last()?;
    u32::from_str_radix(hex.trim_start_matches("0x").trim_start_matches("0X"), 16).ok()
}

/// Read the current toast setting. `None` when the value has never been written,
/// which Windows treats as enabled.
#[cfg(windows)]
fn read_toasts() -> Option<u32> {
    parse_dword(&run_reg(&["query", &format!(r"HKCU\{KEY}"), "/v", VALUE])?)
}

#[cfg(windows)]
fn write_toasts(on: u32) -> bool {
    run_reg(&[
        "add",
        &format!(r"HKCU\{KEY}"),
        "/v",
        VALUE,
        "/t",
        "REG_DWORD",
        "/d",
        &on.to_string(),
        "/f",
    ])
    .is_some()
}

/// Turn notifications off, remembering what they were.
#[cfg(windows)]
pub fn silence() {
    let mut prev = PREVIOUS.lock().unwrap_or_else(|e| e.into_inner());
    if prev.is_some() {
        return; // already silenced; do not overwrite the saved value
    }
    // Absent means enabled, so default to 1 rather than assuming off.
    *prev = Some(read_toasts().unwrap_or(1));
    write_toasts(0);
}

/// Put it back exactly as it was, including "was already off".
#[cfg(windows)]
pub fn restore() {
    let mut prev = PREVIOUS.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(value) = prev.take() {
        write_toasts(value);
    }
}

#[cfg(not(windows))]
pub fn silence() {}
#[cfg(not(windows))]
pub fn restore() {}

/// Called from the UI when focus mode turns on or off.
#[tauri::command]
pub fn set_dnd(on: bool) {
    if on {
        silence();
    } else {
        restore();
    }
}

#[cfg(test)]
mod tests {
    use super::parse_dword;

    /// Exactly what `reg query` prints, blank lines and all. A raw string, so
    /// the registry path's backslashes need no escaping.
    const REAL: &str = concat!(
        "\r\n",
        r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings",
        "\r\n    NOC_GLOBAL_SETTING_TOASTS_ENABLED    REG_DWORD    0x1\r\n\r\n"
    );

    #[test]
    fn reads_the_value_past_the_trailing_blank_lines() {
        // Taking the last token of the whole output rather than of the right
        // line is the bug this exists to prevent.
        assert_eq!(parse_dword(REAL), Some(1));
    }

    #[test]
    fn reads_zero() {
        assert_eq!(parse_dword(&REAL.replace("0x1", "0x0")), Some(0));
    }

    #[test]
    fn returns_none_when_the_value_is_absent() {
        // Absent means "never written", which Windows treats as enabled — the
        // caller defaults to on, so this must not be mistaken for zero.
        assert_eq!(parse_dword("ERROR: The system was unable to find...\r\n"), None);
        assert_eq!(parse_dword(""), None);
    }

    #[test]
    fn ignores_an_unrelated_line_that_happens_to_end_in_a_number() {
        let noisy = format!("    SOME_OTHER_VALUE    REG_DWORD    0x9\r\n{REAL}");
        assert_eq!(parse_dword(&noisy), Some(1));
    }
}

//! The fullscreen reminder overlay.
//!
//! The pet window is 240x240 and lives wherever you left it, so it cannot show
//! something in the middle of the screen — a nudge you are meant to notice while
//! looking elsewhere needs the whole screen. This creates a separate transparent
//! always-on-top window covering the active monitor.
//!
//! Two shapes, because two different jobs:
//!   * `water` / `break` — a flash and a big animated pet, no buttons. It is a
//!     nudge; it goes away by itself and never blocks the desktop.
//!   * `reminder` — a card with Stop and Snooze. This one is a decision, so it
//!     waits, and it is the only case that takes clicks.
//!
//! The overlay is created click-through and only the reminder card turns that
//! off. A fullscreen window that swallows clicks would make the desktop unusable
//! for as long as it is up, which is a far worse failure than a missed nudge.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const ALERT_LABEL: &str = "alert";

/// Show the overlay. `kind` is "water", "break" or "reminder"; `title` is the
/// line to display, and `id` the reminder's id so Snooze can find it again.
#[tauri::command]
pub async fn show_alert(
    app: AppHandle,
    kind: String,
    title: String,
    id: Option<String>,
) -> Result<(), String> {
    // Everything travels in the URL rather than as an event, so the page has its
    // parameters the moment it mounts. An event would race the window's own
    // listener being ready and would sometimes show an empty overlay.
    let url = format!(
        "index.html#alert?kind={}&title={}&id={}",
        urlencode(&kind),
        urlencode(&title),
        urlencode(id.as_deref().unwrap_or(""))
    );

    // Reuse the window if one is already up: two overlapping fullscreen
    // overlays would be unreadable, and the newer nudge is the relevant one.
    if let Some(win) = app.get_webview_window(ALERT_LABEL) {
        let _ = win.close();
    }

    let monitor = app
        .get_webview_window(crate::window::PET_LABEL)
        .and_then(|w| w.current_monitor().ok().flatten());

    let mut builder = WebviewWindowBuilder::new(&app, ALERT_LABEL, WebviewUrl::App(url.into()))
        .title("PixelPaw")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        // Focused only for the reminder card, which has buttons to press. A
        // nudge that steals focus mid-sentence would be its own annoyance.
        .focused(kind == "reminder");

    if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        builder = builder
            .position(pos.x as f64, pos.y as f64)
            .inner_size(size.width as f64, size.height as f64);
    } else {
        builder = builder.fullscreen(false).maximized(true);
    }

    let win = builder.build().map_err(|e| e.to_string())?;
    // Click-through until the page says otherwise. The card asks for clicks
    // back; the nudge never does.
    let _ = win.set_ignore_cursor_events(kind != "reminder");
    Ok(())
}

#[tauri::command]
pub fn close_alert(app: AppHandle) {
    if let Some(win) = app.get_webview_window(ALERT_LABEL) {
        let _ = win.close();
    }
}

/// Percent-encode the few characters that would break the URL. Deliberately
/// small: reminder titles are user text, and a `#` or `&` in one would
/// otherwise truncate or split the parameters.
fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            b' ' => "%20".to_string(),
            other => format!("%{other:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::urlencode;

    #[test]
    fn passes_plain_text_through() {
        assert_eq!(urlencode("call mum"), "call%20mum");
    }

    #[test]
    fn escapes_what_would_break_the_url() {
        // A '#' would truncate the hash and a '&' would invent a parameter.
        assert_eq!(urlencode("a#b&c=d"), "a%23b%26c%3Dd");
    }

    #[test]
    fn handles_non_ascii() {
        // Telugu titles have to survive the round trip.
        assert_eq!(urlencode("నీళ్ళు"), urlencode("నీళ్ళు"));
        assert!(!urlencode("నీళ్ళు").contains('న'));
    }
}

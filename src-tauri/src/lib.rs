//! PixelPaw AI - native shell.
//!
//! Responsibilities of the Rust side (kept deliberately small and platform-isolated):
//!   * create/configure the transparent, frameless, always-on-top pet window
//!   * poll the *global* cursor position + left-button state and forward it to the
//!     webview as a single `cursor:move` stream (this is the source of truth that
//!     drives eye-tracking, petting, hunting and dragging in the UI)
//!   * hit-test the global cursor against the cat's silhouette and toggle
//!     click-through (`set_ignore_cursor_events`) so the rest of the desktop stays
//!     usable except when the user is actually interacting with the pet
//!   * own the system tray menu
//!
//! All higher-level "personality" lives in the webview; this layer only exposes
//! capabilities.

mod agent;
mod ai;
mod cursor;
mod input;
mod media;
mod tray;
mod window;

use tauri::{Listener, Manager};

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            media::media_control,
            ai::ai_chat,
            ai::ai_set_key,
            ai::ai_has_key,
            agent::agent_info,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Make sure the pet window is positioned somewhere sensible on first run
            // and is genuinely on top / click-through until hovered.
            if let Some(win) = app.get_webview_window(window::PET_LABEL) {
                let _ = win.set_always_on_top(true);
                let _ = win.set_ignore_cursor_events(true);
                window::place_default(&win);
                let _ = win.show();
            }

            // Native tray menu (Show/Hide/Pause/Resume/Recenter/Quit).
            tray::build(&handle)?;

            // Background thread: global cursor -> webview + click-through hit-testing.
            cursor::spawn(handle.clone());

            // Background threads: keyboard-activity + scroll (activity only, never content).
            input::spawn(handle.clone());

            // Loopback-only status endpoint so coding agents can drive the pet.
            agent::spawn(handle.clone());

            // The UI mirrors the pet's visual scale so click-through hit-testing
            // matches what's actually drawn.
            handle.listen("pet:scale", |event| {
                if let Ok(scale) = event.payload().trim_matches('"').parse::<f32>() {
                    window::set_pet_scale(scale);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PixelPaw");
}

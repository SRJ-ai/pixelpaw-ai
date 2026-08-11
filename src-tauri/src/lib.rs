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
mod menu;
mod tray;
mod window;

use tauri::{Emitter, Listener, Manager};

pub fn run() {
    tauri::Builder::default()
        // Must be registered first. Without it, every click of the desktop
        // shortcut starts another process — another cat, another tray icon —
        // and the user ends up with a pile of pets they can't quit.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window(window::PET_LABEL) {
                let _ = win.show();
                let _ = win.set_always_on_top(true);
            }
            // Let the pet acknowledge the relaunch, so a second click of the
            // shortcut visibly does *something* instead of appearing to fail.
            let _ = app.emit("app:second-instance", ());
        }))
        .invoke_handler(tauri::generate_handler![
            media::media_control,
            ai::ai_chat,
            ai::ai_set_key,
            ai::ai_has_key,
            agent::agent_info,
            menu::open_pet_menu,
            menu::open_settings,
            menu::quit_app,
        ])
        // One handler for both sources: tray menu clicks and the pet's
        // right-click popup arrive here alike.
        .on_menu_event(|app, event| menu::handle(app, event.id().as_ref()))
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

            // Extra clickable region the UI wants (the media pill). Without it
            // the pill's buttons sit outside the pet's silhouette and clicks
            // pass straight through to the desktop.
            handle.listen("pet:uirect", |event| {
                if let Ok(rect) = serde_json::from_str::<window::UiRect>(event.payload()) {
                    window::set_ui_rect(&rect);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PixelPaw");
}

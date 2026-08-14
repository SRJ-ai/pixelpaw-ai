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
mod alert;
mod ai;
mod cursor;
mod detect;
mod dnd;
mod dock;
mod input;
mod media;
mod menu;
mod notify;
mod tray;
mod update;
mod window;

use tauri::{Emitter, Listener, Manager};

pub fn run() {
    // `notify` and `--help` are handled before Tauri starts, so calling the exe
    // from a build script talks to the running pet instead of launching a
    // second copy of the app.
    if let Some(code) = notify::handle_cli() {
        std::process::exit(code);
    }

    // The pet's sound cues are synthesised in the webview, and Chromium starts
    // an AudioContext suspended until a real user gesture. The pet window is
    // click-through and driven by the *global* cursor stream, so it may never
    // receive one — the cat would simply be mute. Read by the WebView2 loader,
    // so it has to be set before the webview exists.
    #[cfg(windows)]
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--autoplay-policy=no-user-gesture-required",
    );

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            media::media_control,
            ai::ai_chat,
            ai::ai_set_key,
            ai::ai_has_key,
            agent::agent_info,
            detect::detect_agents,
            detect::connect_agent,
            detect::disconnect_agent,
            detect::agent_connected,
            menu::open_pet_menu,
            menu::open_settings,
            menu::quit_app,
            update::check_for_update,
            alert::show_alert,
            alert::close_alert,
            dnd::set_dnd,
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

            // Watches which window has focus, so the pet can park beside the
            // agent you are actually talking to.
            dock::spawn(handle.clone());

            // Ask once, a little after launch, whether there is a newer build.
            update::spawn(handle.clone());

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

            // The focus watcher runs off-thread and cannot read settings, so
            // the UI mirrors this one across.
            handle.listen("pet:dock", |event| {
                window::set_dock_enabled(event.payload().trim() != "false");
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PixelPaw");
}

//! The one action menu, shared by the tray icon and the pet's own right-click.
//!
//! Windows files brand-new notification icons into the hidden overflow flyout,
//! so a tray icon cannot be the only route to Settings and Quit — most users
//! never see it. Right-clicking the pet pops this same menu, which keeps the
//! app quittable and configurable without hunting through the taskbar.

use tauri::{
    menu::{ContextMenu, Menu, MenuItem, PredefinedMenuItem},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window,
};

use crate::window::{self, PET_LABEL};

/// Open (or focus) a secondary window (settings / chat / games). Created lazily.
fn open_window(app: &AppHandle, label: &str, title: &str, w: f64, h: f64) {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::App(format!("index.html#{label}").into()),
    )
    .title(title)
    .inner_size(w, h)
    .min_inner_size(380.0, 440.0)
    .resizable(true)
    .decorations(true)
    .transparent(false)
    .always_on_top(false)
    .skip_taskbar(false)
    .center()
    .build();

    match built {
        Ok(win) => {
            let _ = win.show();
            let _ = win.set_focus();
        }
        // Silence here is how "Settings does nothing" happens; say it out loud.
        Err(err) => eprintln!("[PixelPaw] could not open the '{label}' window: {err}"),
    }
}

/// Build a fresh menu. Cheap enough to rebuild per popup, which keeps the tray
/// and the pet's context menu from sharing mutable state.
pub fn build(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let show = MenuItem::with_id(app, "show", "Show Pet", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide Pet", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause", true, None::<&str>)?;
    let resume = MenuItem::with_id(app, "resume", "Resume", true, None::<&str>)?;
    let recenter = MenuItem::with_id(app, "recenter", "Recenter", true, None::<&str>)?;
    let peek = MenuItem::with_id(app, "peek", "Peek Mode (toggle)", true, None::<&str>)?;
    let pomodoro = MenuItem::with_id(app, "pomodoro", "Pomodoro (toggle)", true, None::<&str>)?;
    let take_break = MenuItem::with_id(app, "take_break", "Take a break", true, None::<&str>)?;
    let water = MenuItem::with_id(app, "water", "Drink water", true, None::<&str>)?;
    let sep_media = PredefinedMenuItem::separator(app)?;
    let media_prev = MenuItem::with_id(app, "media_prev", "⏮  Previous track", true, None::<&str>)?;
    let media_play = MenuItem::with_id(app, "media_play_pause", "⏯  Play / Pause", true, None::<&str>)?;
    let media_next = MenuItem::with_id(app, "media_next", "⏭  Next track", true, None::<&str>)?;
    let vol_down = MenuItem::with_id(app, "media_volume_down", "🔉  Volume down", true, None::<&str>)?;
    let vol_up = MenuItem::with_id(app, "media_volume_up", "🔊  Volume up", true, None::<&str>)?;
    let vol_mute = MenuItem::with_id(app, "media_mute", "🔇  Mute", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let chat = MenuItem::with_id(app, "chat", "Chat with pet…", true, None::<&str>)?;
    let games = MenuItem::with_id(app, "games", "Play a game…", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    // Names the state rather than the action when something is waiting, so the
    // item answers "is there an update?" without having to be clicked.
    let update_label = if crate::update::update_pending() {
        "Install update…"
    } else {
        "Check for updates"
    };
    let update = MenuItem::with_id(app, "update", update_label, true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit PixelPaw", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &show, &hide, &pause, &resume, &recenter, &peek, &pomodoro, &take_break, &water,
            &sep_media, &media_prev, &media_play, &media_next, &vol_down, &vol_up, &vol_mute, &sep,
            &chat, &games, &settings, &update, &sep2, &quit,
        ],
    )
}

/// Run a menu item. Every item performs a real action (per the "no dead
/// buttons" rule): Show/Hide/Recenter act on the window directly; Pause/Resume
/// emit events the webview listens for to gate its behavior loop.
pub fn handle(app: &AppHandle, id: &str) {
    match id {
        "show" => {
            if let Some(w) = app.get_webview_window(PET_LABEL) {
                let _ = w.show();
                let _ = w.set_always_on_top(true);
            }
        }
        "hide" => {
            if let Some(w) = app.get_webview_window(PET_LABEL) {
                let _ = w.hide();
            }
        }
        "pause" => {
            let _ = app.emit("tray:pause", ());
        }
        "resume" => {
            let _ = app.emit("tray:resume", ());
        }
        "recenter" => window::recenter(app),
        "peek" => {
            let _ = app.emit("tray:peek", ());
        }
        "pomodoro" => {
            let _ = app.emit("tray:pomodoro", ());
        }
        "take_break" => {
            let _ = app.emit("tray:break", ());
        }
        "water" => {
            let _ = app.emit("tray:water", ());
        }
        id if id.starts_with("media_") => {
            let action = id.trim_start_matches("media_");
            if let Some(a) = crate::media::MediaAction::from_str(action) {
                crate::media::send(a);
            }
        }
        "update" => {
            // Downloading blocks; the menu handler runs on the main thread.
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                if crate::update::update_pending() {
                    if let Err(e) = crate::update::install(app.clone()).await {
                        eprintln!("[PixelPaw] update failed: {e}");
                        let _ = app.emit("update:failed", e);
                    }
                } else if crate::update::check_for_update(app.clone()).await == Ok(None) {
                    let _ = app.emit("update:none", ());
                }
            });
        }
        "settings" => open_window(app, "settings", "PixelPaw Settings", 520.0, 700.0),
        "chat" => open_window(app, "chat", "Chat with PixelPaw", 460.0, 620.0),
        "games" => open_window(app, "games", "PixelPaw Games", 460.0, 560.0),
        "quit" => app.exit(0),
        _ => {}
    }
}

/// Right-click on the pet pops the same menu the tray has. This is the primary
/// way in — the tray icon is a bonus, not the contract.
///
/// Deliberately `async`: `popup` hands the work to the main thread and blocks
/// until the menu is dismissed, so it must not itself run on the main thread.
#[tauri::command]
pub async fn open_pet_menu(app: AppHandle, window: Window) -> Result<(), String> {
    let menu = build(&app).map_err(|e| e.to_string())?;
    // The pet window is created unfocused; a popup needs focus to dismiss
    // cleanly when the user clicks elsewhere.
    let _ = window.set_focus();
    menu.popup(window).map_err(|e| e.to_string())
}

/// Quit from inside a normal window (the Settings "Quit PixelPaw" button), so
/// exiting never depends on finding the tray icon.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Open Settings from the webview (used by the Chat/Games windows and the
/// pet's fallback UI).
#[tauri::command]
pub fn open_settings(app: AppHandle) {
    handle(&app, "settings");
}

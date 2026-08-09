//! System tray menu. Every item performs a real action (per the "no dead
//! buttons" rule): Show/Hide/Recenter act on the window directly; Pause/Resume
//! emit events the webview listens for to gate its behavior loop.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

use crate::window::{self, PET_LABEL};

/// Open (or focus) a secondary window (settings / chat). Created lazily.
fn open_window(app: &AppHandle, label: &str, title: &str, w: f64, h: f64) {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(
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
    .build();
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
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
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit PixelPaw", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show, &hide, &pause, &resume, &recenter, &peek, &pomodoro, &take_break, &water,
            &sep_media, &media_prev, &media_play, &media_next, &vol_down, &vol_up, &vol_mute, &sep,
            &chat, &games, &settings, &sep2, &quit,
        ],
    )?;

    let _tray = TrayIconBuilder::with_id("pixelpaw-tray")
        .icon(app.default_window_icon().cloned().expect("default window icon"))
        .tooltip("PixelPaw AI")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
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
            "settings" => open_window(app, "settings", "PixelPaw Settings", 520.0, 700.0),
            "chat" => open_window(app, "chat", "Chat with PixelPaw", 460.0, 620.0),
            "games" => open_window(app, "games", "PixelPaw Games", 460.0, 560.0),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

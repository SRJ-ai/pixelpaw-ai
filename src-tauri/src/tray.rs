//! System tray icon. The menu itself lives in `menu.rs` because the pet's
//! right-click uses the same one — Windows hides new tray icons in the
//! notification overflow, so the tray is a convenience, not the only way in.

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::window::PET_LABEL;

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let menu = crate::menu::build(app)?;

    let _tray = TrayIconBuilder::with_id("pixelpaw-tray")
        .icon(app.default_window_icon().cloned().expect("default window icon"))
        .tooltip("PixelPaw AI — right-click the pet for the menu")
        .menu(&menu)
        .show_menu_on_left_click(true)
        // A plain left-click also brings the pet back, in case it was hidden.
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(w) = tray.app_handle().get_webview_window(PET_LABEL) {
                    let _ = w.show();
                    let _ = w.set_always_on_top(true);
                }
            }
        })
        .build(app)?;

    Ok(())
}

//! Global cursor bridge.
//!
//! A single lightweight background thread polls the OS cursor + left-button state
//! and forwards it to the webview as `cursor:move`. It only does work (and only
//! touches the window across threads) when something actually changed, so an idle
//! desktop costs almost nothing.

use device_query::{DeviceQuery, DeviceState};
use serde::Serialize;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::window::{self, PET_LABEL};

#[derive(Clone, Serialize)]
struct CursorEvent {
    /// Absolute cursor position, physical screen pixels.
    x: i32,
    y: i32,
    /// Whether the left mouse button is currently pressed.
    left: bool,
    /// Cursor relative to the pet window's top-left, physical pixels.
    rel_x: i32,
    rel_y: i32,
    /// Pet window outer size (physical px) so the UI can reason in DPI-safe fractions.
    win_w: i32,
    win_h: i32,
}

pub fn spawn(app: AppHandle) {
    thread::spawn(move || {
        let ds = DeviceState::new();
        let mut last_x = i32::MIN;
        let mut last_y = i32::MIN;
        let mut last_left = false;
        let mut last_interactive: Option<bool> = None;

        loop {
            let mouse = ds.get_mouse();
            let (x, y) = mouse.coords;
            // device_query button vector is 1-indexed; index 1 is the left button.
            let left = *mouse.button_pressed.get(1).unwrap_or(&false);

            if x != last_x || y != last_y || left != last_left {
                last_x = x;
                last_y = y;
                last_left = left;

                if let Some(win) = app.get_webview_window(PET_LABEL) {
                    let pos = win.outer_position().ok();
                    let size = win.outer_size().ok();

                    let (rel_x, rel_y, win_w, win_h) = match (pos, size) {
                        (Some(p), Some(s)) => (x - p.x, y - p.y, s.width as i32, s.height as i32),
                        _ => (0, 0, 0, 0),
                    };

                    if win_w > 0 && win_h > 0 {
                        let interactive = window::is_over_pet(rel_x, rel_y, win_w, win_h);
                        if last_interactive != Some(interactive) {
                            let _ = win.set_ignore_cursor_events(!interactive);
                            last_interactive = Some(interactive);
                        }
                    }

                    let _ = app.emit(
                        "cursor:move",
                        CursorEvent { x, y, left, rel_x, rel_y, win_w, win_h },
                    );
                }
            }

            thread::sleep(Duration::from_millis(16));
        }
    });
}

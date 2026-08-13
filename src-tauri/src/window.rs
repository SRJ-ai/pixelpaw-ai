//! Pet window helpers: placement and cursor hit-testing.

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

pub const PET_LABEL: &str = "pet";

/// Visual scale of the cat (as scale * 1000), mirrored from the UI so the
/// click-through hit box tracks the *rendered* size. Without this a small pet
/// would still swallow desktop clicks across the whole window.
static PET_SCALE_MILLI: AtomicU32 = AtomicU32::new(1000);

pub fn set_pet_scale(scale: f32) {
    let clamped = scale.clamp(0.1, 2.0);
    PET_SCALE_MILLI.store((clamped * 1000.0) as u32, Ordering::Relaxed);
}

fn pet_scale() -> f32 {
    PET_SCALE_MILLI.load(Ordering::Relaxed) as f32 / 1000.0
}

/// Whether the pet should park beside a focused coding-agent window (see
/// `dock.rs`). Mirrored from settings, because the watcher runs on its own
/// thread and must not touch the webview to ask.
static DOCK_ENABLED: AtomicBool = AtomicBool::new(true);

pub fn set_dock_enabled(on: bool) {
    DOCK_ENABLED.store(on, Ordering::Relaxed);
}

pub fn dock_enabled() -> bool {
    DOCK_ENABLED.load(Ordering::Relaxed)
}

/// An extra interactive rectangle the webview asks to be clickable, in
/// thousandths of the window (left, top, right, bottom). The media pill sits
/// well above the cat's silhouette, so without this its buttons would fall
/// through to the desktop. All zeroes means "nothing extra".
static UI_RECT_MILLI: [AtomicU32; 4] = [
    AtomicU32::new(0),
    AtomicU32::new(0),
    AtomicU32::new(0),
    AtomicU32::new(0),
];

/// A rectangle in fractions of the window, as the UI reports it.
#[derive(serde::Deserialize)]
pub struct UiRect {
    pub l: f32,
    pub t: f32,
    pub r: f32,
    pub b: f32,
}

pub fn set_ui_rect(rect: &UiRect) {
    let to_milli = |v: f32| (v.clamp(0.0, 1.0) * 1000.0) as u32;
    UI_RECT_MILLI[0].store(to_milli(rect.l), Ordering::Relaxed);
    UI_RECT_MILLI[1].store(to_milli(rect.t), Ordering::Relaxed);
    UI_RECT_MILLI[2].store(to_milli(rect.r), Ordering::Relaxed);
    UI_RECT_MILLI[3].store(to_milli(rect.b), Ordering::Relaxed);
}

fn over_ui_rect(rel_x: i32, rel_y: i32, w: i32, h: i32) -> bool {
    let f = |i: usize| UI_RECT_MILLI[i].load(Ordering::Relaxed) as f32 / 1000.0;
    let (l, t, r, b) = (f(0), f(1), f(2), f(3));
    if r <= l || b <= t {
        return false; // nothing published
    }
    let x = rel_x as f32 / w as f32;
    let y = rel_y as f32 / h as f32;
    x >= l && x <= r && y >= t && y <= b
}

/// Approximate the cat's silhouette as a box centred on the character, sized
/// from the current visual scale (the art is anchored at the bottom of the
/// stage, so the box grows upward from the feet).
pub fn is_over_pet(rel_x: i32, rel_y: i32, w: i32, h: i32) -> bool {
    if over_ui_rect(rel_x, rel_y, w, h) {
        return true;
    }
    let s = pet_scale();
    let wf = w as f32;
    let hf = h as f32;

    // Character occupies ~72% of the stage width and ~84% of its height at
    // scale 1.0, anchored to the bottom (transform-origin: center bottom).
    let half_w = wf * 0.36 * s;
    let body_h = hf * 0.84 * s;
    let bottom = hf * 0.96; // small ground margin
    let top = bottom - body_h;
    let left = wf * 0.5 - half_w;
    let right = wf * 0.5 + half_w;

    let x = rel_x as f32;
    let y = rel_y as f32;
    x >= left && x <= right && y >= top && y <= bottom
}

/// Place the window near the bottom-right of the primary monitor.
///
/// The margins are logical pixels scaled to the monitor, not physical ones. A
/// taskbar is about 48 logical pixels tall whatever the display is doing, so a
/// fixed physical figure tucked the pet under the taskbar on a 200% screen and
/// left it floating well above it on a 100% one.
pub fn place_default(win: &WebviewWindow) {
    if let Ok(Some(monitor)) = win.primary_monitor() {
        let m_pos = monitor.position();
        let m_size = monitor.size();
        let scale = monitor.scale_factor();
        let w_size = win
            .outer_size()
            .unwrap_or(PhysicalSize { width: 240, height: 240 });
        let margin = (24.0 * scale).round() as i32;
        let taskbar = (48.0 * scale).round() as i32;
        let x = m_pos.x + m_size.width as i32 - w_size.width as i32 - margin;
        let y = m_pos.y + m_size.height as i32 - w_size.height as i32 - margin - taskbar;
        let _ = win.set_position(PhysicalPosition::new(x, y));
    }
}

/// Recenter helper used by the tray "Recenter" item.
pub fn recenter(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(PET_LABEL) {
        place_default(&win);
        let _ = win.show();
        let _ = win.set_always_on_top(true);
    }
}

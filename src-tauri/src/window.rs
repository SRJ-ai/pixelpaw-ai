//! Pet window helpers: placement and cursor hit-testing.

use std::sync::atomic::{AtomicU32, Ordering};
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

/// Approximate the cat's silhouette as a box centred on the character, sized
/// from the current visual scale (the art is anchored at the bottom of the
/// stage, so the box grows upward from the feet).
pub fn is_over_pet(rel_x: i32, rel_y: i32, w: i32, h: i32) -> bool {
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
pub fn place_default(win: &WebviewWindow) {
    if let Ok(Some(monitor)) = win.primary_monitor() {
        let m_pos = monitor.position();
        let m_size = monitor.size();
        let w_size = win
            .outer_size()
            .unwrap_or(PhysicalSize { width: 240, height: 240 });
        let margin = 24i32;
        let taskbar = 56i32;
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

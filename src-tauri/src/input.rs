//! Keyboard-activity + scroll bridge.
//!
//! PRIVACY (§48): this module never captures *what* you type. It only derives an
//! activity signal — the number of new key-presses since the last tick — and a
//! scroll-wheel delta. No key identity is ever emitted, logged, stored, or sent
//! anywhere. The pressed-key set is compared transiently only to count new
//! presses, then discarded.

use device_query::{DeviceQuery, DeviceState};
use serde::Serialize;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct KeyEvent {
    /// How many keys transitioned to "down" this tick. No identity, ever.
    presses: u32,
}

#[derive(Clone, Serialize)]
struct ScrollEvent {
    /// Signed wheel delta accumulated since the last tick (sign = direction).
    delta: i32,
}

pub fn spawn(app: AppHandle) {
    #[cfg(windows)]
    scroll_hook::install();

    thread::spawn(move || {
        let ds = DeviceState::new();
        let mut prev = ds.get_keys();

        loop {
            let keys = ds.get_keys();
            let mut presses = 0u32;
            for k in &keys {
                if !prev.contains(k) {
                    presses += 1;
                }
            }
            if presses > 0 {
                let _ = app.emit("input:key", KeyEvent { presses });
            }
            prev = keys;

            #[cfg(windows)]
            {
                let d = scroll_hook::take();
                if d != 0 {
                    let _ = app.emit("input:scroll", ScrollEvent { delta: d });
                }
            }

            thread::sleep(Duration::from_millis(30));
        }
    });
}

/// Windows low-level mouse hook: the only reliable way to see scroll globally.
/// The callback does the minimum (accumulate the wheel delta) and passes the
/// event straight on, so it never interferes with normal scrolling.
#[cfg(windows)]
mod scroll_hook {
    use std::ptr::null_mut;
    use std::sync::atomic::{AtomicI32, Ordering};
    use std::thread;
    use winapi::shared::minwindef::{LPARAM, LRESULT, WPARAM};
    use winapi::shared::windef::HHOOK;
    use winapi::um::winuser::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
        UnhookWindowsHookEx, MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL, WM_MOUSEWHEEL,
    };

    static SCROLL_ACC: AtomicI32 = AtomicI32::new(0);

    /// Read and reset the accumulated scroll delta.
    pub fn take() -> i32 {
        SCROLL_ACC.swap(0, Ordering::Relaxed)
    }

    unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 && wparam as u32 == WM_MOUSEWHEEL {
            let info = &*(lparam as *const MSLLHOOKSTRUCT);
            // High word of mouseData holds the signed wheel delta.
            let delta = ((info.mouseData >> 16) & 0xffff) as u16 as i16;
            SCROLL_ACC.fetch_add(delta as i32, Ordering::Relaxed);
        }
        CallNextHookEx(null_mut(), code, wparam, lparam)
    }

    pub fn install() {
        thread::spawn(|| unsafe {
            let hook: HHOOK = SetWindowsHookExW(WH_MOUSE_LL, Some(hook_proc), null_mut(), 0);
            if hook.is_null() {
                return;
            }
            // A low-level hook only fires while its installing thread pumps messages.
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            UnhookWindowsHookEx(hook);
        });
    }
}

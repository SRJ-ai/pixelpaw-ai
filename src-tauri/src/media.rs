//! Media transport controls.
//!
//! Sends the standard Windows media virtual-keys, which whatever app currently
//! owns media playback (Spotify, a browser tab, a local player…) picks up. We
//! only synthesize these specific transport keys — never text, and never
//! arbitrary input.

/// Actions the UI/tray may request.
#[derive(Debug, Clone, Copy)]
pub enum MediaAction {
    PlayPause,
    Next,
    Prev,
    VolumeUp,
    VolumeDown,
    Mute,
}

impl MediaAction {
    pub fn from_str(s: &str) -> Option<Self> {
        Some(match s {
            "play_pause" => Self::PlayPause,
            "next" => Self::Next,
            "prev" => Self::Prev,
            "volume_up" => Self::VolumeUp,
            "volume_down" => Self::VolumeDown,
            "mute" => Self::Mute,
            _ => return None,
        })
    }

    #[cfg(windows)]
    fn vk(self) -> u8 {
        match self {
            Self::PlayPause => 0xB3,  // VK_MEDIA_PLAY_PAUSE
            Self::Next => 0xB0,       // VK_MEDIA_NEXT_TRACK
            Self::Prev => 0xB1,       // VK_MEDIA_PREV_TRACK
            Self::VolumeUp => 0xAF,   // VK_VOLUME_UP
            Self::VolumeDown => 0xAE, // VK_VOLUME_DOWN
            Self::Mute => 0xAD,       // VK_VOLUME_MUTE
        }
    }
}

#[cfg(windows)]
pub fn send(action: MediaAction) {
    use winapi::um::winuser::{keybd_event, KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP};
    let vk = action.vk();
    unsafe {
        keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, 0);
        keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
    }
}

#[cfg(not(windows))]
pub fn send(_action: MediaAction) {
    // Other platforms get their own implementation when they're supported.
}

/// Command invoked from the UI: `invoke("media_control", { action: "next" })`.
#[tauri::command]
pub fn media_control(action: String) -> Result<(), String> {
    match MediaAction::from_str(&action) {
        Some(a) => {
            send(a);
            Ok(())
        }
        None => Err(format!("unknown media action: {action}")),
    }
}

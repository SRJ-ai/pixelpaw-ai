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

/// Windows routes these two ways, and different players listen on different
/// ones:
///
///   * the shell hands the key to whichever app owns the current media session
///     (Spotify, a browser tab) — that path only needs the key to arrive;
///   * players with their own global hotkeys (VLC, foobar2000, MusicBee) sit on
///     a low-level keyboard hook and inspect the event before deciding.
///
/// The second group is why this uses `SendInput` with a real scan code from
/// `MapVirtualKeyW` rather than the older `keybd_event` with a scan code of 0.
/// A hook sees `KBDLLHOOKSTRUCT.scanCode`, and a zero there marks the event as
/// synthetic in a way some players filter out — so "next track" reached Spotify
/// but not VLC. With the mapped scan code the event is shaped exactly like a
/// press of the key on a real keyboard.
#[cfg(windows)]
pub fn send(action: MediaAction) {
    use winapi::um::winuser::{
        MapVirtualKeyW, SendInput, INPUT, INPUT_KEYBOARD, KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP,
        MAPVK_VK_TO_VSC,
    };

    let vk = action.vk() as u16;
    // Media keys live on the extended half of the keyboard, so the scan code
    // travels with KEYEVENTF_EXTENDEDKEY set.
    let scan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) } as u16;

    let event = |flags: u32| -> INPUT {
        let mut input: INPUT = unsafe { std::mem::zeroed() };
        input.type_ = INPUT_KEYBOARD;
        unsafe {
            let ki = input.u.ki_mut();
            ki.wVk = vk;
            ki.wScan = scan;
            ki.dwFlags = flags | KEYEVENTF_EXTENDEDKEY;
        }
        input
    };

    // Down and up in one call, so nothing can interleave between them.
    let mut inputs = [event(0), event(KEYEVENTF_KEYUP)];
    unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_mut_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        );
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

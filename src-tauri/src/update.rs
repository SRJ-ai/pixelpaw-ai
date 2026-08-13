//! Getting a new version to people who already have an old one.
//!
//! Every release before this one reached only the people who happened to
//! revisit the download page. That is the difference between publishing a build
//! and shipping a product, so the app now asks.
//!
//! Deliberately all in Rust. The check, the download and the install never
//! touch the webview, which means no new JavaScript capability and no path by
//! which page script could trigger an install. The UI's only involvement is
//! being told that an update exists, and the user's only involvement is the
//! menu item that starts it.
//!
//! The manifest is signed with a key that never leaves the maintainer's
//! machine; `pubkey` in tauri.conf.json is the matching public half, and the
//! plugin refuses anything that does not verify against it. A compromised
//! GitHub Pages would therefore still not be able to push a binary.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

/// Set once an update has been found, so the menu item can say so and the
/// startup check does not nag twice in one run.
static PENDING: AtomicBool = AtomicBool::new(false);

/// Wait this long after launch before looking. Starting a network request in
/// the same breath as the first paint makes the pet late to appear, and there
/// is no hurry — the user has just opened the app they already have.
const STARTUP_DELAY_SECS: u64 = 20;

#[derive(Clone, serde::Serialize)]
struct UpdateFound {
    version: String,
}

pub fn update_pending() -> bool {
    PENDING.load(Ordering::Relaxed)
}

/// Look for a newer version. Returns its version string when one exists.
///
/// Every failure here is silent by design: no network, a captive portal, a
/// GitHub outage, a malformed manifest. None of that is the user's problem and
/// none of it should interrupt a desktop pet.
async fn check(app: &AppHandle) -> Option<String> {
    let updater = app.updater().ok()?;
    let update = updater.check().await.ok()??;
    let version = update.version.clone();
    PENDING.store(true, Ordering::Relaxed);
    let _ = app.emit("update:available", UpdateFound { version: version.clone() });
    Some(version)
}

/// Check once, shortly after launch.
pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(STARTUP_DELAY_SECS)).await;
        check(&app).await;
    });
}

/// Download and install, then restart into the new version.
///
/// Only ever reached from an explicit menu click. `install` hands off to the
/// NSIS installer in passive mode, so the user sees a progress window rather
/// than the app vanishing and reappearing with no explanation.
pub async fn install(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("already up to date")?;

    let _ = app.emit("update:installing", ());
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

/// Menu handler: check now, and install if something is waiting.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<String>, String> {
    Ok(check(&app).await)
}

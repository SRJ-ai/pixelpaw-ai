# PixelPaw AI 🐾

An original, intelligent **desktop companion** — a tiny hand-drawn pet that genuinely lives on your
desktop, reacts to your mouse and activity, and (in later phases) grows an optional AI brain,
productivity tools, and personality.

**[⬇ Download for Windows](https://github.com/SRJ-ai/pixelpaw-ai/releases/download/v0.2.2/PixelPaw.AI_0.2.2_x64-setup.exe)** · Windows 10/11 · [changelog](CHANGELOG.md)
Updates install themselves from here on. The build carries no Authenticode certificate, so
SmartScreen will flag the publisher on first install — choose *More info → Run anyway* if you're
happy to proceed. (Updates *are* cryptographically signed, and the app refuses any that don't
verify; that's a separate mechanism from the Windows publisher certificate.)

> **Originality:** PixelPaw AI is an original product. It is *not* affiliated with, and copies no
> code, art, sound, branding, or assets from, any existing desktop-pet product. Only the general
> product *category* (desktop pet, mouse-following eyes, petting, reminders, etc.) is used as
> inspiration. The name "PixelPaw AI" is a working name and the branding is intentionally modular
> (see `src/config/branding.ts`).

---

## Status — Phases 1–6 (runnable)

What works today, for real (no mocks):

**Desktop presence**
- **Transparent, frameless, always-on-top window** that floats over your desktop.
- **Smart click-through:** the desktop stays fully usable — the window only captures the mouse when
  your cursor is actually over the cat (Rust hit-tests the global cursor every frame).
- **Remembers where you put it** — drop it anywhere and it stays, across restarts.
- **System tray:** Show / Hide / Pause / Resume / Recenter / Peek Mode / Pomodoro / Take a break /
  Settings / Quit — every item does something real.

**Interaction**
- **Eye + gaze tracking:** pupils follow your cursor anywhere on screen, with a subtle body lean.
- **Drag with squash/stretch:** grab and it stretches like mochi with a springy release bounce;
  shake it and it gets dizzy. Handle it *gently* and it smiles; yank it and it looks startled.
- **Tap it → "ow!"** recoil; keep poking and it gets dazed.
- **Petting:** stroke its head back and forth → happy squint, blush, floating hearts, purring.
- **Mouse hunting** (opt-in): dart the cursor and it crouches and chases. Off by default so the pet
  stays put.
- **Keyboard kneading:** while you type it kneads its paws and looks engaged.
- **Overheat gag:** type *very* fast and it flushes red, steams, sweats and yelps "Whoa! Slow down!"
- **Scroll reactions:** gentle scroll → curious; fast scroll → startled.

**Life & looks**
- **Idle life:** weighted, non-repeating behaviors — blink, look around, groom, wiggle, sit, stretch,
  yawn, stroll, and doze off after inactivity (waking when you return).
- **Procedural animation engine:** state machine (priority / interruptibility / cooldowns) driving a
  procedural animator (breathing, blinking, tail sway, ear twitch, expressions) — no sprite assets.
- **Three species, eight characters:** a cat, a dog (Biscuit) and a panda (Bamboo), each with its
  own ears, tail, muzzle and markings rather than a recolour — all on the same rig, so every
  animation drives all three. Plus five cat costumes: Bolt (robot), Captain Paw (caped hero),
  Web-Whiskers (masked acrobat), Iron Paw (armored tech), OG Ronin (samurai, "OG" headband + katana).
- **A voice:** seven short synthesised cues — one instrument, so the pet sounds like one creature
  rather than a drawer of beeps. Nothing is shipped as audio; it's a few hundred bytes of Web Audio.
- **Two ways of speaking:** chatter gets a speech bubble; anything worth knowing while you're looking
  elsewhere unrolls on a little paper scroll, so the difference reads without reading.
- **Cosmic decor:** an ambient stylized black hole + twinkling stars behind the pet (toggleable).

**Productivity**
- **Break reminders:** every 15 min (configurable) the pet stretches with an anime speed-line burst.
- **Water reminders:** a separate 15-min nudge to drink water.
- **Pomodoro:** focus/break phases (default 25/5). During focus the pet stays calm and quiet; the
  break gets a stretch + flourish; completing the cycle gets a celebration.
- **Scheduled reminders:** title + time + recurrence (once / daily / weekdays); the pet announces
  them and one-shot reminders switch themselves off.
- **Tasks:** a checklist the pet periodically nudges you about.
- **Peek Mode:** tuck the pet to the screen edge so it peeks in — for fullscreen video/games.
- **Music controls:** play/pause, next, previous, volume and mute from the tray or Settings —
  drives whatever player owns playback, via the standard media keys.

**AI companion** (optional)
- **Chat window** with streaming replies, opened from the tray.
- **Providers:** Claude Code CLI (uses your existing login, *no API key*), Anthropic, OpenAI,
  Gemini, any OpenAI-compatible endpoint, and Ollama for fully-offline local models.
- **Keys never touch the web layer** — all provider HTTP runs in Rust and keys are stored outside
  the webview; the window keeps its strict `default-src 'self'` CSP.
- **Personality + language:** 8 personalities; replies in English, Telugu, Telugu+English mix, or
  Hindi.
- **Memory:** explicit, inspectable entries you can read, delete or wipe; only sent when you chat.

**Coding-agent reactions**
- A **loopback-only status API** (`127.0.0.1:8787`) lets Claude Code, Codex, Cursor or any script
  tell the pet what it's doing. It reacts live: curious while working, celebrating on success,
  concerned on error. Token-authenticated, validates every field, and executes nothing.
- **One-line CLI** so you never have to hand-write that request:
  ```bash
  pixelpaw-ai notify success --agent claude-code
  ```
  It finds the token itself, exits 0 when the pet isn't running (safe in a build script), and picks
  up the current folder's name — so several sessions at once stay tellable apart in the bubble.
- **Setup for the tool you actually use.** Settings detects what's installed. Claude Code connects
  in one click (hooks written into its own `settings.json`, original backed up beside it).
  Antigravity, Cursor, Kiro, Codex and Gemini CLI each get a *How* panel: the rule to paste into
  that tool's own instructions file, plus a command to check it works.
- **The pet parks beside the agent.** When one of those windows takes focus, the pet moves above its
  input box, and goes back where it was when you leave.

**Settings & privacy**
- Full **Settings + customizer window**: character picker, pet name, recolor (6 colors, live
  preview), size/opacity/always-on-top/reduced-motion, sound + volume, agent docking, a pinned note,
  per-interaction toggles + sensitivities, water/break/Pomodoro config, reminders, tasks, music, AI,
  memory, a **privacy dashboard**, and **diagnostics** holding the last crash. Everything persists
  and applies live.

**Games & progression**
- **Mini-games** from the tray: a reaction test and a memory match, both awarding XP and bond.
- **XP, levels, bond tiers** (Stranger → Special bond) and **8 achievements**, earned from ordinary
  use — petting, finishing Pomodoros, completing tasks, agent successes. Rewards are cosmetic /
  behavioural only; nothing real is ever locked behind them.

**Tests**
- **108 tests** — 95 TypeScript (`npm test`) and 13 Rust (`cargo test`) — covering the animation
  state machine (priority, cooldowns, interruptibility), the idle director, settings
  persistence/migration, reminder scheduling and catch-up, progression maths, prompt construction,
  the sound cue table, the crash log, agent-window recognition, and a byte-for-byte round trip on
  the hook config we write into somebody else's editor settings.

Everything above runs **fully offline**. The architecture is laid out so later phases (AI chat,
memory, voice, AI-agent reactions, games, full OG Samurai cinematic, Telugu support,
installer/updater) slot in without rework — see the roadmap below.

---

## Tech stack

- **Tauri v2** (Rust) — native window, tray, global cursor bridge, click-through.
- **React + TypeScript + Vite** — the character and the behavior engine.
- **SVG** — original, recolorable pixel-inspired art with individually addressable parts.
- **SQLite** — planned for persistence (Phase 8+).

## Architecture

```
src/                        # Frontend (the pet's body + brain)
  config/branding.ts        # Rename / reskin in one place (§2)
  types/pet.ts              # PetCharacter, RenderState, species-agnostic model (§6)
  events/eventBus.ts        # Typed pub/sub the whole app talks through (§43)
  platform/cursorBridge.ts  # Normalizes the native cursor stream (only Tauri-input touchpoint)
  pet/
    render/PixelCat.tsx     # Original SVG character (anatomy only)
    render/parts.ts         # Binds parts + applies a RenderState each frame (hot path, no re-render)
    animation/states.ts     # State table: priority, cooldown, dwell, interruptibility (§8/§44/§45)
    animation/stateMachine.ts
    animation/animator.ts   # Procedural per-state expression + easing
    behaviors/idle.ts       # Weighted idle-life director (§9)
    engine.ts               # The heartbeat: input → interactions → state → movement → render
  App.tsx / main.tsx / styles.css

src-tauri/                  # Native shell (kept small + platform-isolated)
  src/lib.rs                # App setup, window config, wiring
  src/window.rs             # Placement + cursor hit-testing (click-through silhouette)
  src/cursor.rs             # Global cursor/button poll → `cursor:move` events (event-driven)
  src/tray.rs               # System tray menu
  tauri.conf.json           # Transparent/frameless/always-on-top window + bundle config
  capabilities/default.json # Least-privilege permissions for the pet window
```

Design note: **all pet interaction is driven from a single native cursor stream** (position +
button + window-relative coords). This is DPI-safe and avoids fragile WebView pointer events, and it
means the character animation runs entirely by mutating SVG transforms (no React re-render in the
60 fps path).

---

## Prerequisites

- Windows 10/11
- **Node.js** (LTS) and **Rust** (stable, MSVC toolchain)
- **Microsoft C++ Build Tools** (VCTools workload) + WebView2 runtime

> On this machine the toolchain is installed under **`D:\dev`** (portable Node, `CARGO_HOME`,
> `RUSTUP_HOME`, npm cache) so the dev footprint stays on D:. Only the MSVC compiler/SDK and the
> WebView2 system runtime live on C: (Windows requires that).

## Run it

```bash
npm install
npm run tauri dev
```

Or build a standalone debug/release binary:

```bash
npm run build          # type-check + bundle the frontend to dist/
npm run tauri build    # produces an NSIS installer + exe
```

The debug binary is at `src-tauri/target/debug/PixelPaw AI.exe` after a `cargo build`.

## Releasing

Installed copies check `docs/latest.json` on GitHub Pages and refuse any build that
doesn't verify against the public key compiled into them, so a release has to be signed
or nobody can install it.

The private key lives at `~/.pixelpaw/updater.key` and is **not in this repo**. Back it up:
losing it means no existing install can ever be updated again, because the public half is
baked into every copy already out there.

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.pixelpaw/updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build      # produces the installer + a .sig beside it
npm run manifest         # writes docs/latest.json from that .sig
```

Then upload the installer to a `v<version>` GitHub release as
`PixelPaw.AI_<version>_x64-setup.exe` (dots, not spaces — GitHub percent-encodes spaces
and the updater URL has to be clean), and push `docs/` so Pages serves the new manifest.
`npm run manifest` refuses to write anything if the build wasn't signed, which is the
guard against shipping a release nobody can install.

## Controls

- **Move your mouse** — the cat watches your cursor.
- **Hover the cat** — the window becomes interactive (elsewhere it's click-through).
- **Click-drag the cat** — pick it up (squash/stretch); release to bounce; shake for dizzy.
- **Stroke its head** (move back and forth over it) — petting / purring.
- **Dart the cursor** past it — it hunts.
- **Tray icon** — Show / Hide / Pause / Resume / Recenter / Quit.

## Privacy (§48)

- No telemetry. No keystroke logging. No screenshots. No network calls in the MVP.
- The native layer only reads the **global cursor position + left-button state** to make the pet
  react. Nothing is stored or transmitted.

---

## Roadmap (spec phases)

| Phase | Area | Status |
|------:|------|--------|
| 1–2 | Desktop shell + original pixel pet | ✅ |
| 3 | Animation engine (state machine + procedural) | ✅ |
| 4 | Mouse interactions (gaze, hunt, drag, petting) | ✅ |
| 5 | Keyboard / scroll reactions (kneading, overheat) | ✅ |
| 6 | Reminders / water / Pomodoro / Peek Mode | ✅ |
| 7–8 | AI chat, memory, personality, multi-provider | ✅ |
| 9 | Voice (STT/TTS) | ⏳ |
| 10 | AI-agent status reactions + local API | ✅ |
| 11 | Customization (characters, colours, sizing) | ✅ |
| 12 | Progression (XP/bond/achievements) ✅ · mini-games ✅ · pet room | ◐ |
| 13 | OG Samurai character + cinematic entrance ✅ · UI Telugu i18n ✅ | ✅ |
| 14 | Tests (98) ✅ · perf/security hardening | ◐ |
| 15 | Installer (NSIS) ✅ · auto-update | ◐ |
| 16 | Sound ✅ · paper-scroll announcements ✅ · dog + panda species ✅ | ✅ |

Legend: ✅ done · ◐ partly done · ⏳ not started

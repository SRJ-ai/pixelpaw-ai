# Changelog

All notable changes to PixelPaw AI. Dates are the release date; versions follow
[semantic versioning](https://semver.org/).

## 0.2.0 — 13 August 2026

### Added

- **Two more animals.** Biscuit (dog) and Bamboo (panda) join the roster as real
  species rather than recolours — floppy ears and a snout, round black ears and
  eye patches. They share the animation rig, so every existing behaviour drives
  all three unchanged.
- **A voice.** Short synthesised cues on the moments worth hearing: a session
  finishing, a focus block ending, a reminder coming due, something failing.
  One instrument across all seven cues, so the pet sounds like one creature.
  Off in one click, with a volume slider that plays as you drag it.
- **Announcements unroll on paper.** Chatter still uses the speech bubble;
  anything worth knowing while you're looking elsewhere — a reminder, a finished
  session, a Pomodoro ending — unrolls on a little scroll instead. The
  difference is readable without reading.
- **The pet parks beside your coding agent.** When a Claude Code, Codex or
  editor window takes focus, the pet moves above its input box and goes back
  when you leave. Toggle in Settings.
- **Setup instructions for every agent, not just Claude Code.** Each detected
  tool gets a *How* panel with the rule to paste into its own instructions file
  — `AGENTS.md`, `.cursor/rules`, `.kiro/steering`, `GEMINI.md` — plus a command
  to check the connection works. Covers Antigravity, Cursor, Kiro, Codex and
  Gemini CLI.
- **Diagnostics.** Settings → More now keeps the last crash, with the message
  and where it happened.

### Fixed

- **Chat with the Claude Code CLI failed on every message** with `batch file
  arguments are invalid`. npm installs the CLI as `claude.cmd`, and since Rust
  1.77 `Command` refuses to pass an argument to a batch file it cannot safely
  quote for `cmd.exe` — a chat prompt contains newlines, which have no escape.
  The prompt now goes in on stdin, which also sidesteps `cmd.exe`'s
  8191-character command line.
- **Next / previous track reached some players and not others.** The media keys
  were sent with a scan code of 0, which marks the event as synthetic to the
  low-level hooks that players like VLC use for their global hotkeys. They now
  carry a real scan code from `MapVirtualKeyW`, so a synthetic press is shaped
  exactly like a press on your keyboard.
  *(VLC also needs its own **Global** hotkeys bound — they are separate from its
  normal ones.)*
- **The crash marker was a mute red dot** on the wallpaper with no way to find
  out what it meant. It now carries its own message, and the full record is kept
  in Settings.

## 0.1.1 — 11 August 2026

### Fixed

- **No way to quit or reach Settings.** Windows files new tray icons into the
  hidden notification overflow, and the tray was the app's only affordance.
  Right-clicking the pet now opens the same menu.
- **Launching the shortcut cloned the pet.** Every click started another
  process. It now surfaces the running one.
- **Reminders never fired.** They were scheduled off the render loop, which
  WebView2 suspends whenever the window is hidden or covered. They run on a
  wall clock now, and catch up if the machine was asleep.
- **Settings wouldn't scroll.**

### Added

- Pomodoro and reminder-interval presets.
- A media pill above the pet with transport controls.
- Telugu throughout the interface, not only in the pet's lines.

## 0.1.0 — 9 August 2026

First release.

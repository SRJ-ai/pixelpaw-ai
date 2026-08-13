# Changelog

All notable changes to PixelPaw AI. Dates are the release date; versions follow
[semantic versioning](https://semver.org/).

## 0.2.5 — 13 August 2026

### Fixed

- **The "needs you" badge floated away from the pet.** It was pinned to the top
  of the pet's window, which sounds right and isn't: the cat only fills the
  bottom 45% of that window at the default size, so the badge sat roughly 113
  pixels clear of the animal. On a desktop that reads as a stray label
  belonging to nothing rather than as the pet asking for you. It now sits just
  above the head, where the eye already goes.

  Beside the body was the obvious alternative and it does not work — that
  leaves about 80 pixels of clear width, too narrow for a label worth reading.
  Three things now want that strip above the head, so they queue: the badge
  steps up when a bubble or scroll passes through, and higher again when the
  media pill is out. The badge is the standing one, so the passing things go in
  front.

## 0.2.4 — 13 August 2026

### Added

- **"Needs you" now stays up.** When a coding agent blocks on you, the pet used
  to say so for under three seconds and then look exactly as it does when
  nothing is happening. An agent asks for you precisely when you have looked
  away, so the one message most worth catching was the one most likely to be
  missed. A small amber badge now sits beside the pet until the agent moves on
  or you touch the pet — no dismiss button, because anyone reaching for the cat
  has already noticed the cat.

- **Diagnostics say when an agent last called.** A hook that silently does
  nothing — wrong path, moved executable, a tool that never runs them — looks
  identical to an agent that simply has not finished anything yet. Settings →
  More now shows who last reached the pet, what they said, and how long ago, so
  "is this working?" has an answer.

135 tests, up from 126.

## 0.2.3 — 13 August 2026

### Fixed

- **Unplugging a monitor could lose the pet for good.** It remembers where you
  left it, which is right until the screen it was left on stops existing.
  Undock a laptop, unplug a second display or change a resolution, and the saved
  position could put the window entirely outside the visible desktop — where,
  being transparent, frameless and absent from the taskbar, it is invisible and
  unclickable. Both routes back needed you to find it first, so there was no way
  back at all. A remembered position is now checked against the screens that
  actually exist, and a position nobody could reach is replaced rather than
  honoured.

- **Docking sat on the input box on scaled displays.** The offsets that put the
  pet above a coding agent's message pane were fixed physical pixels, so on a
  200% display they were half the intended clearance — worst on exactly the
  machines where the text is largest. They are logical pixels now, scaled from
  the DPI of the monitor that window is on, so a mixed-DPI setup gets it right
  per screen rather than per system.

- **Same fault in the pet's first-run position**, which used a fixed 56px
  taskbar allowance: tucked under the taskbar at 200%, floating well above it
  at 100%.

126 tests, up from 108.

## 0.2.2 — 13 August 2026

### Added

- **The pet introduces itself.** A new install used to drop a cat on the desktop
  and stop there: everything the app does sits behind a right-click nothing
  announces, and the other route is the tray icon Windows hides in the overflow
  flyout. On a first run the pet now says where the menu is, once, and never
  again. If a coding agent is already installed it mentions that too.

  Not a welcome dialog — a modal on first launch is something to dismiss before
  you have any reason to care, and it teaches nothing about where things live
  afterwards. Saying it *from the pet* puts the instruction on the thing the
  instruction is about.

- 108 tests, up from 98.

## 0.2.1 — 13 August 2026

### Added

- **Updates.** Every release before this one only reached people who happened to
  revisit the download page. The app now checks shortly after launch, the pet
  says so if there's a newer version, and the right-click menu changes from
  *Check for updates* to *Install update…* when one is waiting.

  The check, the download and the install all happen in Rust — the webview is
  never involved, so no page script can start one. Builds are signed with a key
  that never leaves the maintainer's machine, and the app refuses anything that
  doesn't verify against the public half compiled into it. A compromised host
  still could not push a binary.

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

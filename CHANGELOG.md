# Changelog

All notable changes to PixelPaw AI. Dates are the release date; versions follow
[semantic versioning](https://semver.org/).

## 0.2.9 — 13 August 2026

### Fixed

- **The reminder overlay could unmount itself.** `getCurrentWindow()` reads
  `window.__TAURI_INTERNALS__.metadata` and throws *synchronously* when that is
  absent, so the `.catch()` on the promise it returns never saw it. The throw
  escaped the effect and took the whole overlay down — the same shape as the bug
  that once unmounted the pet and left a bare red marker on the wallpaper.

  The packaged app was never affected, because `__TAURI_INTERNALS__` always
  exists there. Released anyway so the published build matches the source: 0.2.8's
  binary was cut minutes before this fix, and a version that quietly means two
  different things is worse than an extra tag.

## 0.2.8 — 13 August 2026

### Added

- **Reminders take the whole screen.** The pet is 240×240 and sits wherever you
  left it, so it could not show anything in the middle of the screen. There is a
  separate fullscreen overlay now, in two shapes because they are two jobs.

  *Water and break* are information: the screen flashes, an enlarged pet does the
  thing being asked of you, and it leaves on its own after five seconds. The
  drinking animation is CSS on the shared rig, so every character and every
  species performs it without its own artwork.

  *A scheduled reminder* is a decision: a centred card with **Snooze 10 min** and
  **Got it**, which waits. Snooze re-arms the same reminder rather than adding a
  second one, and clears the fired-today mark so it can fire again. Escape closes
  it.

  The overlay is click-through for nudges and only accepts clicks for the card. A
  fullscreen window that swallowed clicks would make the desktop unusable for as
  long as it was up, which is a far worse failure than a missed nudge.

- **Focus mode silences Windows notifications.** Quieting the pet while every
  other toast still arrived was half a focus mode. Windows exposes no public API
  for Focus Assist — only a way to read it — so this writes the notification
  master switch the Settings app itself uses, records the previous value on the
  way in and restores it on the way out. Anyone who already had notifications off
  does not get them switched on by leaving focus mode.

- **Schedules from the pet's own menu.** Right-click gives *Break reminder*,
  *Water reminder* and *Remind me…* with intervals, instead of a trip to
  Settings. "Remind me…" is relative because a menu can offer a duration but not
  a title and a clock time; absolute reminders come from the chat window.

- **Every character has an entrance.** The samurai had a cinematic and nobody
  else did. Six flourishes now — a blade of light, forked lightning, speed lines,
  an opening sigil, concentric shockwaves, and soft puffs for the animals that
  would not make an entrance — built from one set of keyframes. Each character
  also says a line of its own when you switch to it.

- **Every character has its own outline.** Eight of the fourteen were the same
  cat in different colours with a prop on it, and the four dragons were one
  silhouette in four palettes. Shape now carries build, ears, tail, horns, wings
  and a frill, and each character sets one.

- **The body is separable from the costume.** Settings → Appearance → Body picks
  cat, dog, panda or dragon for any character, so four bodies combine with the
  six colour controls that already existed.

*(0.2.7 was built and signed but never published; its contents are above.)*

## 0.2.6 — 13 August 2026

### Added

- **Talk to the pet instead of filling in a form.** Reminders already worked but
  the only way to add one was Settings → Reminders → Add → three fields, which
  nobody does mid-task. In the chat window:

  ```
  remind me at 5pm to call mum
  remind me at 7am to stretch every day
  what reminders do I have
  my name is Vamsi
  dance / sleep / sit / stretch / wake up
  ```

  These run *before* the AI, not through it — the AI is off by default and needs
  a key or a CLI, so routing them through it would mean the most useful thing in
  that window only worked for people who had configured something else. They
  cost nothing and cannot hallucinate a time. A phrase with no readable time
  creates nothing rather than guessing an hour.

- **Reminders address you by name:** `⏰ Hey Vamsi — call mum`.

- **Three more characters.** Emberling, a small dragon with horns, wings and a
  spined tail — the fourth species on the shared rig. Umbra, a shadow-summoner
  in dark plate under a turning sigil. Hexpaw, a hooded mage with a staff.

  All original archetypes. Requests for Pokémon and Solo Leveling characters
  were declined: both are actively enforced IP, and copying them would
  contradict the originality claim this project is built on.

### Fixed

- **Focus mode had no switch.** `focusMode` was only ever set by starting a
  Pomodoro, so a documented feature could not be turned on. Now in the
  right-click menu with a chip showing when it's active. It declines during a
  Pomodoro rather than desyncing.

- **Your name was unreachable.** It lived only in the AI tab, but the pet uses
  it for breaks, water and Pomodoro lines whether or not AI is on — so anyone
  who never opened that tab got the generic line forever. Moved to the Pet tab.

- **The water nudge now tells the time:** `3:45 pm — sip some water 💧`.

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

# What got built, and what is still unproven

A record of the 0.2.x run: ten releases, 0.2.0 through 0.2.9. Written to be
useful later rather than congratulatory, so the last section — the things nobody
has watched work — matters as much as the first.

**State at the end:** 0.2.9 released and installed · 165 tests (143 TypeScript,
22 Rust) · Apache-2.0 · self-updating with signed builds.

---

## Releases

| Version | What it was for |
|---|---|
| 0.2.0 | Dog and panda as real species, a voice, paper-scroll announcements, agent docking |
| 0.2.1 | The app can update itself |
| 0.2.2 | The pet introduces itself on a first run |
| 0.2.3 | Stop losing the pet when a monitor goes away; two DPI faults |
| 0.2.4 | Hold "needs you" until it has been seen |
| 0.2.5 | Bring the attention badge back to the cat |
| 0.2.6 | Reminders by typing instead of filling in a form |
| 0.2.7 | *Built and signed, never published — folded into 0.2.8* |
| 0.2.8 | Fullscreen reminder overlay; focus mode silences Windows notifications |
| 0.2.9 | Match the published build to the source |

---

## Bugs fixed, and what caused them

The useful part of this list is the causes. Most were not where the symptom was.

**Chat failed on every message** with `batch file arguments are invalid`. npm
installs the Claude Code CLI as `claude.cmd`, and since Rust 1.77 (the
CVE-2024-24576 fix) `Command` refuses to pass an argument to a batch file it
cannot safely quote for `cmd.exe`. A chat prompt contains newlines, which have no
escape. The prompt goes in on stdin now, which also sidesteps `cmd.exe`'s
8191-character limit that a few turns would have exceeded anyway.

**Unplugging a monitor could lose the pet permanently.** It remembers where you
left it, which is right until that screen stops existing. The window is
transparent, frameless and absent from the taskbar, so off-screen meant invisible
*and* unclickable — and both routes back needed you to find it first. A remembered
position is now checked against the screens that exist.

**Docking sat on the input box on scaled displays.** The offsets were fixed
physical pixels, so at 200% they came out at half the intended clearance — worst
on the machines where text is largest. Verified fixed on a 125% display: 33px
higher, 5px further left, exactly the scaling.

**"Needs you" expired after 2.8 seconds.** An agent blocks on you precisely when
you have looked away, so the one message most worth catching was the one most
likely to be missed. It is a held state now, cleared when the agent moves on or
you touch the pet.

**Focus mode had no switch.** `focusMode` was only ever set by starting a
Pomodoro, so a documented feature could not be turned on. The machinery was all
wired; only the control was missing.

**Your name was unreachable.** It lived in the AI tab, but the pet uses it for
breaks, water and Pomodoro lines whether or not the AI is on. Anyone who never
opened that tab got the generic line forever.

**Media keys reached some players and not others.** They carried a scan code of 0,
which marks the event as synthetic to the low-level hooks players use for global
hotkeys. They carry a real scan code now.

**The engine did not know its own window position on a first run** until the
cursor stream filled it in, so docking silently did nothing and would record
`0,0` as home — flinging the pet into the corner on undock.

**The crash marker was a mute red dot.** It carries its own message now, and the
full record is kept in Settings → Diagnostics.

---

## Findings worth keeping

Things learned that outlive the fix.

**The media report had three separate causes, none of them the app.** Measured on
one machine: `RegisterHotKey` succeeded for all four media keys, so nothing had
claimed them and the shell routed them to the only registered session, Chrome.
VLC 3.0.23 predates media-session support entirely. And Chrome reports
`IsNextEnabled: false` on a single video — so "next" had nowhere to go. The real
fix is per-session control, so a button that cannot act *looks* like it cannot.

**Recolouring is cheap and it shows.** Eight of fourteen characters were the same
cat in different colours with a prop on it, and four "elemental dragons" were one
silhouette in four palettes. You recognise a creature by its shape first. `Shape`
now carries build, ears, tail, horns, wings and a frill.

**Two silhouette features were invisible when first drawn.** A frill and a dorsal
fin were both sized to the torso they were drawn *behind*, so the torso painted
over them — silhouette features that changed no silhouette. Both compiled fine.

**Windows has no public API for Focus Assist.** Microsoft only ever exposed a
read (`SHQueryUserNotificationState`). What is stable is the notification master
switch the Settings app itself writes.

**Attribution does not grant copyright permission.** Requests for Pokémon, Solo
Leveling and Harry Potter characters, and for famous anime dialogue, were
declined — crediting a rights-holder is not a licence. The creature *types*
(dragons, phoenixes, griffins) are folklore and open; the named characters are
not. Everything shipped is an original archetype, which is also what the NOTICE
file claims.

---

## Verification: what was actually watched work

Proven with evidence, not inference:

- **The updater found a newer version by itself.** An installed 0.2.1 detected
  0.2.2 on GitHub Pages and announced it. Screenshotted.
- **Docking moved the pet and returned it.** To the agent window, then back to its
  exact home pixel, `1654,696`.
- **The attention badge outlives its old timer.** Present at 12s where the old
  bubble was gone at 2.8, across three cold starts, each naming its own session.
- **Snooze re-arms correctly.** Clicked at 19:07, the reminder moved to 19:17 —
  exactly +10 — `lastFired` cleared, no duplicate created.
- **The overlay renders and dismisses.** Flash, enlarged pet, drinking animation,
  gone at 5.2s. The card waits and does not.
- **VLC claims the media keys** after its global hotkeys were bound: free before
  launch, claimed after.
- **Every published asset matches its local build** by SHA-256, and every manifest
  signature matches its binary.

---

## Not proven

Listed because "compiled" is not "works". Two silhouette features earlier
compiled perfectly while being completely invisible.

- **The in-app update install.** Check → announce is proven; download → verify →
  install → restart has never been watched. Synthetic input cannot reach the
  interactive desktop from the shell used here, so it needs one human click:
  right-click the pet → *Install update…*.
- **Whether Windows honours the DND write.** The registry round-trip and the
  parse are both tested; that toasts actually stop is not.
- **The six character entrances.** They compile and the components render; nobody
  has watched all six play.

---

## Known gaps

- **No Authenticode certificate**, so SmartScreen flags the publisher on a first
  install. This is separate from update signing, which is in place. Routes and
  current prices are in the README; [SignPath
  Foundation](https://signpath.org/) is free for open-source projects and the
  Apache-2.0 licence now satisfies its one blocking criterion.
- **Per-session media control** is designed and filed, not built.
- **Distribution.** Ten releases and roughly single-digit downloads, most of them
  from verification. The constraint is not features.

---

## The signing key

`~/.pixelpaw/updater.key`, gitignored, never in the repository. **Back it up.**
The public half is compiled into every copy already shipped, so losing it means
no existing install can ever be updated again.

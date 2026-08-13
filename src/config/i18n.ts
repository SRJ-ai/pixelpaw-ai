/**
 * User-interface language (§88). Distinct from `ai.language`, which controls
 * what language the *AI replies* in — this one is the app's own chrome: the
 * pet's spoken lines, Settings, Chat and Games.
 *
 * The table is keyed by a stable id with English written out in full, so the
 * source stays readable and a missing translation degrades to English rather
 * than to a key name.
 */

export type UiLang = "en" | "te";

export const UI_LANGUAGES: { id: UiLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "te", label: "తెలుగు (Telugu)" },
];

type Phrase = { en: string; te: string };

const STRINGS = {
  // ---------------------------------------------------------- pet speech
  "pet.break": { en: "Break time! Stretch a bit 🐾", te: "విరామం! కాసేపు ఒళ్ళు విరుచుకో 🐾" },
  "pet.water": { en: "Water break! Sip some water 💧", te: "నీళ్ళ విరామం! కాస్త నీళ్ళు తాగు 💧" },
  // Named variants, used when the user has told the pet their name. Written as
  // separate phrases rather than a prefix so each language can put the name
  // where it actually belongs in the sentence.
  "pet.breakNamed": {
    en: "{name}, break time! Stretch a bit 🐾",
    te: "{name}, విరామం! కాసేపు ఒళ్ళు విరుచుకో 🐾",
  },
  "pet.waterNamed": {
    en: "{name}, sip some water 💧",
    te: "{name}, కాస్త నీళ్ళు తాగు 💧",
  },
  "pet.focusStartNamed": {
    en: "Focus time, {name} — let's go 🐾",
    te: "ఫోకస్ టైమ్, {name} — పద! 🐾",
  },
  "pet.pomodoroDoneNamed": {
    en: "Pomodoro complete, {name} — great work! 🎉",
    te: "పొమొడోరో పూర్తి, {name} — భలే పని! 🎉",
  },
  "pet.overheat": { en: "Whoa! Slow down! 🐾", te: "అబ్బా! కాస్త నెమ్మది! 🐾" },
  "pet.focusStart": { en: "Focus time — let's go 🐾", te: "ఫోకస్ టైమ్ — పద! 🐾" },
  "pet.pomodoroStopped": { en: "Pomodoro stopped", te: "పొమొడోరో ఆపేశా" },
  "pet.focusDone": { en: "Focus done! Break time 🎉", te: "ఫోకస్ అయిపోయింది! ఇక విరామం 🎉" },
  "pet.pomodoroDone": {
    en: "Pomodoro complete — great work! 🎉",
    te: "పొమొడోరో పూర్తి — భలే పని! 🎉",
  },
  "pet.agentWorking": { en: "{who} is working…", te: "{who} పని చేస్తోంది…" },
  "pet.agentThinking": { en: "{who} is thinking…", te: "{who} ఆలోచిస్తోంది…" },
  // Naming the session matters once more than one is running: "done" on its own
  // does not say which of them finished.
  "pet.agentDone": {
    en: "{who} done — waiting for you 🎉",
    te: "{who} అయిపోయింది — మీ కోసం ఎదురుచూస్తోంది 🎉",
  },
  "pet.agentWaiting": { en: "{who} needs you 👀", te: "{who}కి మీరు కావాలి 👀" },
  "pet.levelUp": { en: "Level {n}! 🎉", te: "లెవెల్ {n}! 🎉" },
  "pet.agentError": {
    en: "{who} failed — let's retry 🐾",
    te: "{who} ఫెయిల్ అయ్యింది — మళ్ళీ ట్రై చేద్దాం 🐾",
  },
  "pet.alreadyHere": {
    en: "I'm already here! Right-click me 🐾",
    te: "నేను ఇక్కడే ఉన్నా! రైట్-క్లిక్ చెయ్యి 🐾",
  },
  // Escalating irritation at repeated taps, worst last.
  // Short on purpose: the timer chip is narrow and sits beside the pet.
  "pet.timerFocus": { en: "FOCUS", te: "ఫోకస్" },
  "pet.timerBreak": { en: "BREAK", te: "విరామం" },

  "set.pinnedNote": { en: "Pinned note", te: "పిన్ చేసిన నోట్" },
  "set.pinnedNotePlaceholder": { en: "Keep this in sight…", te: "ఇది కంటిముందు ఉంచు…" },
  "set.note.pinned": {
    en: "Stays above the pet until you clear it. Good for the one thing you keep forgetting.",
    te: "మీరు తీసేసే వరకు పెంపుడు పైన ఉంటుంది. మర్చిపోతున్న ఒక్క విషయానికి బాగుంటుంది.",
  },

  "pet.poke1": { en: "Ow! 🐾", te: "అబ్బా! 🐾" },
  "pet.poke2": { en: "Hey — that tickles!", te: "ఏయ్ — చక్కిలిగింతలు!" },
  "pet.poke3": { en: "Ouch, easy there…", te: "అయ్యో, మెల్లగా…" },
  "pet.poke4": { en: "Please stop 😿", te: "ప్లీజ్ ఆపు 😿" },

  // ------------------------------------------------------- settings window
  "set.section.character": { en: "Character", te: "పాత్ర" },
  "set.section.pet": { en: "Pet", te: "పెంపుడు" },
  "set.section.appearance": { en: "Appearance", te: "రూపం" },
  "set.section.general": { en: "General", te: "సాధారణం" },
  "set.section.breaks": { en: "Breaks", te: "విరామాలు" },
  "set.section.water": { en: "Water", te: "నీళ్ళు" },
  "set.section.pomodoro": { en: "Pomodoro", te: "పొమొడోరో" },
  "set.section.interactions": { en: "Interactions", te: "పరస్పర చర్యలు" },
  "set.section.reminders": { en: "Schedule reminders", te: "గుర్తుచేసేవి" },
  "set.section.tasks": { en: "Tasks", te: "పనులు" },
  "set.section.music": { en: "Music", te: "సంగీతం" },
  "set.section.ai": { en: "AI", te: "AI" },
  "set.section.memory": { en: "Memory", te: "జ్ఞాపకాలు" },
  "set.section.agents": { en: "Coding agents", te: "కోడింగ్ ఏజెంట్లు" },
  "set.section.privacy": { en: "Privacy", te: "గోప్యత" },
  "set.section.about": { en: "About", te: "గురించి" },

  // Group tabs. Short on purpose: five have to fit the 380px minimum width.
  "set.tab.pet": { en: "Pet", te: "పెంపుడు" },
  "set.tab.behavior": { en: "Behavior", te: "ప్రవర్తన" },
  "set.tab.focus": { en: "Focus", te: "ఫోకస్" },
  "set.tab.ai": { en: "AI", te: "AI" },
  "set.tab.more": { en: "More", te: "ఇతర" },

  "set.language": { en: "Language", te: "భాష" },
  "set.alwaysOnTop": { en: "Always on top", te: "ఎప్పుడూ పైన" },
  "set.size": { en: "Size", te: "పరిమాణం" },
  "set.opacity": { en: "Opacity", te: "పారదర్శకత" },
  "set.cosmicDecor": { en: "Cosmic decor (stars + black hole)", te: "కాస్మిక్ అలంకరణ (నక్షత్రాలు + కృష్ణబిలం)" },
  "set.neverSleep": { en: "Never sleep (pet stays awake)", te: "నిద్రపోదు (మెలకువగా ఉంటుంది)" },
  "set.reducedMotion": { en: "Reduced motion", te: "కదలిక తగ్గించు" },

  "set.breakEnabled": { en: "Break reminders", te: "విరామ గుర్తులు" },
  "set.waterEnabled": { en: "Water reminders", te: "నీళ్ళ గుర్తులు" },
  "set.every": { en: "Every", te: "ప్రతి" },
  "set.custom": { en: "Custom", te: "మీ ఇష్టం" },
  "set.preset": { en: "Preset", te: "సిద్ధం" },
  "set.focus": { en: "Focus", te: "ఫోకస్" },
  "set.break": { en: "Break", te: "విరామం" },

  "set.note.breaks": {
    en: "The pet stretches and pops an anime-style reminder to take a short break.",
    te: "పెంపుడు ఒళ్ళు విరుచుకుని, కాసేపు విరామం తీసుకోమని గుర్తు చేస్తుంది.",
  },
  "set.note.water": {
    en: "The pet nudges you to sip water. Paused during Pomodoro focus.",
    te: "నీళ్ళు తాగమని గుర్తు చేస్తుంది. పొమొడోరో ఫోకస్‌లో ఆగిపోతుంది.",
  },
  "set.note.pomodoro": {
    en: "Start/stop from the pet's right-click menu. During focus the pet stays calm and quiet; on the break it stretches and plays.",
    te: "పెంపుడుపై రైట్-క్లిక్ మెనూ నుండి మొదలుపెట్టు/ఆపు. ఫోకస్‌లో ప్రశాంతంగా ఉంటుంది; విరామంలో ఆడుకుంటుంది.",
  },
  "set.note.exit": {
    en: "Right-click the pet at any time for this window, chat, games and quit. The tray icon has the same menu, but Windows often tucks new tray icons behind the ^ arrow in the taskbar.",
    te: "ఈ విండో, చాట్, ఆటలు, నిష్క్రమణ కోసం ఎప్పుడైనా పెంపుడుపై రైట్-క్లిక్ చెయ్యి. ట్రే ఐకాన్‌లోనూ ఇదే మెనూ ఉంటుంది, కానీ విండోస్ కొత్త ట్రే ఐకాన్‌లను టాస్క్‌బార్‌లోని ^ బాణం వెనుక దాచేస్తుంది.",
  },
  "set.name": { en: "Name", te: "పేరు" },
  "set.resetColors": { en: "Reset colors", te: "రంగులు మొదటికి" },
  "set.body": { en: "Body", te: "శరీరం" },
  "set.belly": { en: "Belly", te: "పొట్ట" },
  "set.pattern": { en: "Pattern", te: "నమూనా" },
  "set.innerEar": { en: "Inner ear", te: "చెవి లోపల" },
  "set.eyes": { en: "Eyes", te: "కళ్ళు" },
  "set.nose": { en: "Nose", te: "ముక్కు" },

  "set.gaze": { en: "Eyes follow cursor", te: "కళ్ళు కర్సర్‌ను చూస్తాయి" },
  "set.hunt": { en: "Mouse hunting", te: "మౌస్ వేట" },
  "set.huntSensitivity": { en: "Hunt sensitivity", te: "వేట సున్నితత్వం" },
  "set.petting": { en: "Petting", te: "నిమరడం" },
  "set.drag": { en: "Drag & fling", te: "లాగడం & విసరడం" },
  "set.knead": { en: "Kneading while typing", te: "టైప్ చేస్తున్నప్పుడు పిసకడం" },
  "set.overheat": { en: "Overheat gag (fast typing)", te: "వేడెక్కే గమ్మత్తు (వేగంగా టైపింగ్)" },
  "set.overheatSensitivity": { en: "Overheat sensitivity", te: "వేడెక్కే సున్నితత్వం" },
  "set.scroll": { en: "Scroll reactions", te: "స్క్రోల్ ప్రతిస్పందనలు" },
  "set.taskNudge": { en: "Nudge me about unfinished tasks", te: "పూర్తికాని పనుల గురించి గుర్తు చెయ్యి" },

  "set.aiEnabled": { en: "Enable AI companion", te: "AI తోడును ఆన్ చెయ్యి" },
  "set.provider": { en: "Provider", te: "ప్రొవైడర్" },
  "set.model": { en: "Model", te: "మోడల్" },
  "set.apiKey": { en: "API key", te: "API కీ" },
  "set.personality": { en: "Personality", te: "వ్యక్తిత్వం" },
  "set.replyLanguage": { en: "Reply language", te: "జవాబు భాష" },
  "set.yourName": { en: "Your name", te: "మీ పేరు" },
  "set.agentReactions": { en: "React to agent activity", te: "ఏజెంట్ పనికి స్పందించు" },

  "set.privacy.mouse": { en: "Mouse position", te: "మౌస్ స్థానం" },
  "set.privacy.keyboard": { en: "Keyboard activity", te: "కీబోర్డ్ కదలిక" },
  "set.privacy.scroll": { en: "Scroll wheel", te: "స్క్రోల్ వీల్" },

  "set.noReminders": { en: "No reminders yet — add one below.", te: "ఇంకా గుర్తులు లేవు — కింద ఒకటి చేర్చు." },
  "set.addReminder": { en: "+ Add reminder", te: "+ గుర్తు చేర్చు" },
  "set.reminderPlaceholder": { en: "Reminder", te: "గుర్తు" },
  "set.once": { en: "Once", te: "ఒకసారి" },
  "set.daily": { en: "Daily", te: "ప్రతిరోజూ" },
  "set.weekdays": { en: "Weekdays", te: "వారం రోజుల్లో" },
  "set.enabled": { en: "Enabled", te: "ఆన్" },
  "set.delete": { en: "Delete", te: "తొలగించు" },
  "set.done": { en: "Done", te: "పూర్తి" },
  "set.noTasks": { en: "No tasks yet — add one below.", te: "ఇంకా పనులు లేవు — కింద ఒకటి చేర్చు." },
  "set.addTask": { en: "+ Add task", te: "+ పని చేర్చు" },
  "set.taskPlaceholder": { en: "Task", te: "పని" },
  "set.optional": { en: "(optional)", te: "(ఐచ్ఛికం)" },
  "set.forget": { en: "Forget", te: "మరచిపో" },
  "set.noMemories": { en: "Nothing remembered yet.", te: "ఇంకా ఏమీ గుర్తు లేదు." },
  "set.note.memory": {
    en: "Memories are stored locally and only sent to your chosen AI provider when you chat.",
    te: "జ్ఞాపకాలు మీ కంప్యూటర్‌లోనే ఉంటాయి; మీరు చాట్ చేసినప్పుడు మాత్రమే మీరు ఎంచుకున్న AI ప్రొవైడర్‌కు వెళ్తాయి.",
  },
  "set.note.privacy": {
    en: "PixelPaw is local-first. No telemetry, no keystroke logging, no screenshots, no network calls. Toggling an interaction off stops that monitoring entirely.",
    te: "PixelPaw ముందుగా మీ కంప్యూటర్‌లోనే పనిచేస్తుంది. టెలిమెట్రీ లేదు, కీస్ట్రోక్ లాగింగ్ లేదు, స్క్రీన్‌షాట్లు లేవు, నెట్‌వర్క్ కాల్స్ లేవు. ఒక పరస్పర చర్యను ఆఫ్ చేస్తే ఆ పర్యవేక్షణ పూర్తిగా ఆగిపోతుంది.",
  },
  "set.privacy.mouseDesc": {
    en: "Reacts to your cursor. Never recorded.",
    te: "మీ కర్సర్‌కు స్పందిస్తుంది. ఎప్పుడూ రికార్డ్ కాదు.",
  },
  "set.privacy.keyboardDesc": {
    en: "Only counts key-presses for timing. Never which keys.",
    te: "టైమింగ్ కోసం కీల సంఖ్య మాత్రమే. ఏ కీ అనేది ఎప్పుడూ కాదు.",
  },
  "set.privacy.scrollDesc": {
    en: "Only the wheel delta. Page content is never read.",
    te: "వీల్ కదలిక మాత్రమే. పేజీ కంటెంట్ ఎప్పుడూ చదవదు.",
  },
  "set.privacy.active": { en: "Active", te: "ఆన్" },
  "set.privacy.off": { en: "Off", te: "ఆఫ్" },
  "set.about": {
    en: "{app} v{version} — an original desktop companion. Not affiliated with any existing product; all code, art, and animation are original.",
    te: "{app} v{version} — ఒక సొంత డెస్క్‌టాప్ తోడు. ఏ ఇతర ఉత్పత్తితోనూ సంబంధం లేదు; కోడ్, బొమ్మలు, యానిమేషన్ అన్నీ సొంతమే.",
  },

  // ----------------------------------------------------------- chat window
  "chat.new": { en: "New", te: "కొత్తది" },
  "chat.newTitle": { en: "New conversation", te: "కొత్త సంభాషణ" },
  "chat.disabled": {
    en: "AI is turned off. Enable it in Settings → AI and pick a provider.",
    te: "AI ఆఫ్‌లో ఉంది. సెట్టింగ్స్ → AI లో ఆన్ చేసి ప్రొవైడర్ ఎంచుకో.",
  },
  "chat.sayHello": { en: "Say hello to {name} 🐾", te: "{name}కి హాయ్ చెప్పు 🐾" },
  "chat.placeholder": { en: "Message your pet…", te: "నీ పెంపుడుకి రాయి…" },
  "chat.placeholderOff": { en: "Enable AI in Settings first", te: "ముందు సెట్టింగ్స్‌లో AI ఆన్ చెయ్యి" },
  "chat.send": { en: "Send", te: "పంపు" },
  "chat.stop": { en: "Stop", te: "ఆపు" },
  "chat.thinking": { en: "{name} is thinking", te: "{name} ఆలోచిస్తోంది" },
  // An empty chat should show what it can do, not just greet.
  "chat.tryOne": { en: "Try one of these", te: "వీటిలో ఒకటి ప్రయత్నించు" },
  "chat.suggest1": { en: "What should I focus on?", te: "నేను ఏమి మీద ఫోకస్ చెయ్యాలి?" },
  "chat.suggest2": { en: "Plan my next hour", te: "నా తర్వాతి గంట ప్లాన్ చెయ్యి" },
  "chat.suggest3": { en: "Explain this error to me", te: "ఈ ఎర్రర్ నాకు వివరించు" },

  // ---------------------------------------------------------- games window
  "games.clickToStart": { en: "Click to start", te: "మొదలుపెట్టడానికి క్లిక్" },
  "games.waitForGreen": { en: "Wait for green…", te: "ఆకుపచ్చ కోసం ఆగు…" },
  "games.click": { en: "CLICK!", te: "క్లిక్!" },
  "games.tooSoon": { en: "Too soon! Click to retry", te: "తొందరపడ్డావ్! మళ్ళీ క్లిక్" },
  "games.msAgain": { en: "{ms} ms — click to play again", te: "{ms} ms — మళ్ళీ ఆడటానికి క్లిక్" },
  "games.best": { en: "best {ms} ms", te: "బెస్ట్ {ms} ms" },
  "games.solved": { en: "Solved in {moves} moves! 🎉", te: "{moves} ఎత్తుల్లో పూర్తి! 🎉" },
  "games.moves": { en: "Moves: {moves}", te: "ఎత్తులు: {moves}" },
  "games.playAgain": { en: "Play again", te: "మళ్ళీ ఆడు" },
  "games.reset": { en: "Reset", te: "మొదటికి" },

  "set.note.openChat": {
    en: "Right-click the pet and choose “Chat with pet…” to start a conversation.",
    te: "సంభాషణ మొదలుపెట్టడానికి పెంపుడుపై రైట్-క్లిక్ చేసి “Chat with pet…” ఎంచుకో.",
  },
  "set.detected": { en: "Found on this machine", te: "ఈ మెషీన్‌లో దొరికినవి" },
  "set.detectNone": {
    en: "No coding agents found. Install one, or use the command below by hand.",
    te: "కోడింగ్ ఏజెంట్లు ఏవీ దొరకలేదు. ఒకటి ఇన్‌స్టాల్ చెయ్యి, లేదా కింది కమాండ్‌ను చేతితో వాడు.",
  },
  "set.connect": { en: "Connect", te: "కలుపు" },
  "set.disconnect": { en: "Disconnect", te: "తీసివేయి" },
  "set.connected": { en: "Connected", te: "కలిపి ఉంది" },
  "set.manualOnly": { en: "Set up by hand", te: "చేతితో సెటప్" },
  "set.note.connectWrites": {
    en: "Connecting edits that tool's own config file. A copy of the original is kept beside it, and disconnecting removes only what was added.",
    te: "కలిపితే ఆ టూల్ కాన్ఫిగ్ ఫైల్ మారుతుంది. అసలు ఫైల్ కాపీ పక్కనే ఉంచుతాం; తీసివేస్తే మేము చేర్చినది మాత్రమే పోతుంది.",
  },

  "set.note.agentIntro": {
    en: "The pet reacts when a coding agent (Claude Code, Codex, Cursor, a script) reports what it is doing. The quickest way is the bundled command, which finds your token for you and stays quiet when the pet is not running:",
    te: "కోడింగ్ ఏజెంట్ (Claude Code, Codex, Cursor, స్క్రిప్ట్) తాను ఏం చేస్తుందో చెప్పినప్పుడు పెంపుడు స్పందిస్తుంది. సులభమైన మార్గం ఈ కమాండ్ — ఇది మీ టోకెన్‌ను తానే కనుక్కుంటుంది, పెంపుడు నడవకపోతే మౌనంగా ఉంటుంది:",
  },
  "set.note.agentHook": {
    en: "Drop this into your Claude Code settings.json to have the pet follow every session automatically.",
    te: "ప్రతి సెషన్‌ను పెంపుడు వాటంతట అదే గమనించాలంటే, దీన్ని మీ Claude Code settings.json లో పెట్టు.",
  },
  "set.note.agentHttp": {
    en: "Prefer to call it directly? The same loopback endpoint is still there, and it only accepts connections from this machine.",
    te: "నేరుగా పిలవాలనుకుంటే? అదే లూప్‌బ్యాక్ ఎండ్‌పాయింట్ ఉంది, ఇది ఈ మెషీన్ నుండి మాత్రమే కనెక్షన్లు స్వీకరిస్తుంది.",
  },
  "set.copy": { en: "Copy", te: "కాపీ" },
  "set.copied": { en: "Copied", te: "కాపీ అయ్యింది" },

  "set.note.agentDown": {
    en: "Endpoint unavailable (port in use).",
    te: "ఎండ్‌పాయింట్ అందుబాటులో లేదు (పోర్ట్ వాడుకలో ఉంది).",
  },
  "set.note.agentStatuses": {
    en: "Valid statuses: working, thinking, waiting, success, error, cancelled, idle.",
    te: "చెల్లుబాటు అయ్యే స్థితులు: working, thinking, waiting, success, error, cancelled, idle.",
  },

  "set.note.music": {
    en: "Controls whichever player currently has playback (Spotify, a browser tab, a local player) using the standard media keys. Also on the pet's right-click menu, and on the pill above the pet.",
    te: "ఇప్పుడు ప్లే అవుతున్న ప్లేయర్‌ను (Spotify, బ్రౌజర్ ట్యాబ్, లోకల్ ప్లేయర్) స్టాండర్డ్ మీడియా కీలతో నియంత్రిస్తుంది. పెంపుడు రైట్-క్లిక్ మెనూలోనూ, పెంపుడు పైన ఉన్న పిల్‌లోనూ ఉంటుంది.",
  },

  "set.resetDefaults": { en: "Reset all to defaults", te: "అన్నీ మొదటికి మార్చు" },
  "set.quit": { en: "Quit {app}", te: "{app} మూసివేయి" },
} as const satisfies Record<string, Phrase>;

export type StringKey = keyof typeof STRINGS;

let current: UiLang = "en";

/** Set the language every later `t()` call resolves against. */
export function setUiLang(lang: UiLang): void {
  current = lang;
}

export function getUiLang(): UiLang {
  return current;
}

/**
 * Look up a phrase in the active language. `vars` are substituted for
 * `{name}` placeholders, so word order can differ between languages.
 */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const phrase = STRINGS[key] as Phrase;
  let out = phrase[current] || phrase.en;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

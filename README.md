# SpeechFlow

SpeechFlow is a browser-based visual thinking workspace with voice capture, draggable bubbles, directed connections, and playback.

## Version
`v0.1`

## What's New
- Introduced modular architecture under `core/` for state, camera, node, edge, graph, playback, persistence, UI, speech, and layout concerns.
- Upgraded data schema to `schemaVersion: 2` with richer node and directed-edge models.
- Added migration handling for legacy snapshots so older saved maps remain loadable.
- Switched playback sequencing to a mode-based generator foundation.
- Added collision resolution on drag-end and cluster-aware zoom-to-fit support in snap-center flows.

## Update Report
- [speechflow-v0.1-updates.md](./speechflow-v0.1-updates.md)

## Run Locally
Open `index.html` in a modern Chromium-based browser, or serve the directory:

```bash
python3 -m http.server 8080
```

## Install SpeechFlow on your phone or tablet

Open SpeechFlow over HTTPS in your mobile browser and tap **Install SpeechFlow**
in the workspace header.

- **Android (Chrome)** — Confirm the install prompt. If the button shows
  instructions, open Chrome's menu (⋮), choose **Add to Home screen** or
  **Install app**, and follow the prompts.
- **iPhone or iPad (Safari)** — Open Safari's **Share** menu and choose
  **Add to Home Screen**. Turn on **Open as Web App** if shown, then tap **Add**.

Tap the SpeechFlow icon on your Home Screen to open the web app in its own
window. For native Android and iOS builds, see [MOBILE.md](./MOBILE.md).

## Workspace

- **Explore** keeps the editing tools and searchable thought list available. Drag thoughts, use the connector handles, or choose the connect tool to link them. Double-click a thought to edit it.
- **Capture** clears away the editing panels so you can keep adding thoughts.
- **Present** hides editing controls and follows directed connections from your chosen starting thought. Notes appear as captions. Use the arrows to move through the story; press Escape to return. Cycles and disconnected branches are each visited once. Voice dictation and editing shortcuts are blocked during presentation.

The capture bar accepts text and commands. **Smart input** understands both; **Dictation only** treats everything as a thought, including phrases like “clear map”; **Commands only** rejects unknown commands instead of creating thoughts. The microphone is off by default. Enable it explicitly, then grant browser permission. Voice settings also support a wake phrase and push-to-talk.

Use **Commands** or Ctrl/Cmd+K to search and run commands. Try `task Ship the MVP`, `connect bubble one to bubble two`, `zoom in`, `fit map`, `arrange map`, or `present mode`. Destructive commands ask for confirmation. Numbering follows the thought list.

Connect mode pauses all bubble creation until you say `end connected mode` or use the explicit End connect mode button. Say `connect bubbles 1 and 2` to draw a connection and remain in connect mode.

The sidebar keeps **Add thought**, search, and your thought list in view. **More tools & settings** contains advanced selection actions, map files, voice settings, and playback.

Select a thought to open its **inspector** on the right: edit text, type, and notes; choose the presentation starting point; and label its connections. Apply changes to save an undoable edit. Selecting a connection opens its label editor. On a small screen, tap a thought or use Inspect selection to open its bottom-sheet inspector. Unsaved inspector drafts survive changing screen sizes.

Starter templates create an editable project plan, decision map, or brainstorm. Choose **Grid**, **Flowchart**, **Mind map**, or **Timeline** beside Arrange (inside More on mobile). Flowchart uses directed layers, Mind map spreads thoughts around a starting point, and Timeline follows story order. Layouts preserve locked positions and support undo. Fit changes only the camera. Image export captures the entire map, including labeled directed connections, as a PNG (up to 4096 pixels per side). Thoughts and map history stay in browser storage on the current device; export JSON to keep a portable backup.

## Mobile and presentation controls

On mobile, the bottom toolbar provides **Capture**, **Connect / End connect**, **Search**, and **More**. Search opens the thought drawer; selecting an entry opens its details. More includes Commands, Backups, the guided tour, layouts, and advanced tools.

Ctrl/Cmd+K toggles Commands and replaces the More menu rather than stacking dialogs. Escape closes menus and returns focus to a visible control, including after resizing. Closed mobile drawers are excluded from keyboard navigation.

Canvas buttons have descriptive hover and keyboard-focus tooltips. Thought cards include type badges and two-digit numbering; focus a card and press Enter to inspect it. Presentation dims surrounding thoughts, shows notes as captions, and includes progress. Escape returns to editing.

## Voice feedback and corrections

The single activity area beside the capture input shows **Heard** for recognized speech (or **Entered** for typed input), followed by the actual outcome. Failed targets, duplicate connections, cancelled confirmations, and incomplete corrections give feedback without creating unwanted thoughts. Expand Recent activity for the latest 12 outcomes; notifications and transcripts no longer overlap the canvas.

- `rename bubble two to NASA Launch Plan`
- `change bubble three to a task`
- `label connection one to two as Depends on`
- `start presentation at bubble one`
- `flowchart layout`, `mind map layout`, or `timeline layout`
- `undo that`

Corrections preserve capitalization. End connected mode before editing thoughts or arranging layouts.

## Backups and recovery

**Backups** in the header (or More on mobile) offers JSON downloads, imports, and recent recovery points. The save indicator recommends a download and flags when your downloaded backup is out of date. Recovery points are created after edits and before deleting or replacing a map; the latest 24 are retained across maps. **Restore a copy** preserves the current map and opens a new recovered map.

Recovery points are stored in the same browser, so they do not replace an external backup. Keep a downloaded JSON file somewhere independent. If browser storage is full or unavailable, the app reports that changes are not saved and keeps downloads available. If session history is damaged, startup tries a validated saved map or recovery point and retains the damaged history on this device.

## Guided Tutorial

A first-visit tooltip tour highlights the capture bar, microphone, input modes, workspace modes, connections, arrangement, search, commands, playback, and backups. Restart it anytime with **Tour** in the header.

Choose **Enable voice** and grant microphone permission to say **“next”** for the next tooltip or **“skip”** to leave the entire tutorial. Back, Next, Finish, and Skip tour buttons also work without a microphone. The tutorial does not change your map or turn examples into bubbles. While it is open, other speech is ignored. Tour commands work without a wake phrase and in every input mode; your existing settings are retained. A microphone enabled only for the tutorial turns off when it ends.

## Validation

No build step or application dependencies are required to run the browser app. Run the core regression tests with Node:

```bash
node --test tests/voice.test.cjs tests/tutorial.test.cjs tests/recognition.test.cjs tests/workbench.test.cjs
```

With the local HTTP server running and Playwright available in your development environment, run the Chromium smoke checks:

```bash
node --test tests/workflows.test.cjs tests/enhancements.test.cjs tests/ui.test.cjs
node tests/browser-smoke.cjs
```

The browser checks use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` for another executable or `SPEECHFLOW_URL` for another local server. They use an isolated browser session and simulated recognition to verify the command pipeline. Live microphone recognition and audible speech output require manual testing in a supported browser. See [VOICE_COMMAND_TEST_GUIDE.md](./VOICE_COMMAND_TEST_GUIDE.md).

The workflow tests cover first-visit and replayed tutorials, voice navigation, mobile positioning, unsupported browsers, permission denial, editing, dragging, shape persistence, JSON backup round-trips, invalid imports, map history, and playback controls. The smoke checks also exercise connect-mode creation blocking, duplicate and invalid connections, templates, search, arrangement, PNG export, presentation shortcuts, and mobile fit.

## Mobile planning workflow

Tap a thought for details; drag it to move, drag empty canvas to pan, and pinch
around two fingers to zoom. Starting a pinch rolls back an unfinished card move.
Cancelled gestures do not add undo history. Panels retain native scrolling and
browser zoom. Touch users can connect without dragging: enter Connect, tap the
source, then the destination. **Cancel link** keeps Connect active; **End connect
mode** resumes capture. Connection changes support undo while Connect is active.

**Map / Outline** switches between projections of the same graph. Outline lists
all directed relationships, including cycles and cross-links, and supports
search, details, label editing, and a From/To connection form. The shared
inspector preserves unsaved drafts when switching views. **Choose as next
action** marks a thought without requiring a separate task-management schema.
Click the project name to rename, duplicate, or open recent projects with
last-edited information.

Capture keeps the camera and input focus steady. Use **Show last on map** or
Fit when you want to move the view. **Correct last thought**, Undo, and Done typing
provide explicit correction and keyboard-dismiss routes. Maps stay in browser
storage; speech recognition may send audio to the browser's speech provider.
Download JSON backups for an independent copy.

Microphone status waits for actual recognition events. Final result batches are
processed once per result index; late events from an old recognition session are
ignored. With a panel open, speech cannot create thoughts; say **close panel**
(or **close voice settings**, **close commands**, **close backups**) to return.
Native destructive confirmations retain their touch and keyboard controls.
Playback advances on utterance completion/error; absent speech output falls
back to reading in Present mode. Playback callbacks are scoped to their session.

Rendering is requested after state/geometry changes rather than continuously
redrawing an idle canvas. Buffers resize on size/pixel-density changes. Card
gestures use delegated listeners, and undo retains the latest 100 snapshots;
older edits remain available only through downloaded backups/recovery points.

Run the complete automated suite, including native packaging checks, with the HTTP server running:

```bash
npm ci
npm run build:web
node --test --test-concurrency=1 tests/*.test.cjs
node tests/browser-smoke.cjs
```

`mobile.test.cjs` injects actual Chromium touch events through CDP; this is
simulated device input, not real-device certification. `planning.test.cjs`
checks graph parity, steady capture, recognition batches/modal closing,
controlled utterance completion, idle drawing, and listener/history bounds.
Real Android/iPhone microphone permissions, on-screen keyboards, battery use,
assistive technologies, and independent user-task completion require manual
validation. No participant study results are claimed.

## iOS and Android apps

Capacitor projects are in `ios/` and `android/`, with native speech capture and
file sharing. The static browser app still runs without npm or a build step.
For native builds, use `npm ci`, then `npm run mobile:sync`; see [MOBILE.md](./MOBILE.md)
for prerequisites, Android APK/App Bundle builds, Xcode signing, data transfer,
and device-test requirements.

## Engineering and evaluation

The `core/` modules separate voice parsing, routing, graph state and persistence. `tests/voice.test.cjs` exercises command/dictation classification, spoken numbers, confirmation of destructive actions and state transitions. Run the focused suite with `node --test tests/voice.test.cjs`. These are source-level test cases, not a claim of independently verified speech-recognition accuracy.

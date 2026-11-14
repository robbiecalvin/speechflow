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


## Workspace

- **Explore** keeps the editing tools and searchable thought list available. Drag thoughts, use the connector handles, or choose the connect tool to link them. Double-click a thought to edit it.
- **Capture** clears away the editing panels so you can keep adding thoughts.
- **Present** hides the sidebar and capture dock. Use the previous/next buttons or arrow keys to step through thoughts; press Escape to return. Editing keyboard shortcuts are disabled during presentation.

The capture bar accepts text and commands. **Smart input** understands both; **Dictation only** treats everything as a thought, including phrases like “clear map”; **Commands only** rejects unknown commands instead of creating thoughts. The microphone is off by default. Enable it explicitly, then grant browser permission. Voice settings also support a wake phrase and push-to-talk.

Use **Commands** or Ctrl/Cmd+K to search and run commands. Try `task Ship the MVP`, `connect bubble one to bubble two`, `zoom in`, `fit map`, `arrange map`, or `present mode`. Destructive commands ask for confirmation. Numbering follows the thought list.

Connect mode pauses all bubble creation until you say `end connected mode` or use the explicit End connect mode button. Say `connect bubbles 1 and 2` to draw a connection and remain in connect mode.

Starter templates create an editable project plan, decision map, or brainstorm. Arrange tidies unlocked thoughts into a grid and supports undo. Fit changes only the camera. Image export captures the entire map, including labeled directed connections, as a PNG (up to 4096 pixels per side). Thoughts and map history stay in browser storage on the current device; export JSON to keep a portable backup.

## Guided Tutorial

A first-visit tooltip tour highlights the capture bar, microphone, input modes, workspace modes, connections, arrangement, search, commands, playback, and backups. Restart it anytime with **Tour** in the header.

Choose **Enable voice** and grant microphone permission to say **“next”** for the next tooltip or **“skip”** to leave the entire tutorial. Back, Next, Finish, and Skip tour buttons also work without a microphone. The tutorial does not change your map or turn examples into bubbles. While it is open, other speech is ignored. Tour commands work without a wake phrase and in every input mode; your existing settings are retained. A microphone enabled only for the tutorial turns off when it ends.

## Validation

No build step or application dependencies are required. Run the core regression tests with Node:

```bash
node --test tests/voice.test.cjs tests/tutorial.test.cjs tests/recognition.test.cjs
```

With the local HTTP server running and Playwright available in your development environment, run the Chromium smoke checks:

```bash
node --test tests/workflows.test.cjs
node tests/browser-smoke.cjs
```

The browser checks use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` for another executable or `SPEECHFLOW_URL` for another local server. They use an isolated browser session and simulated recognition to verify the command pipeline. Live microphone recognition and audible speech output require manual testing in a supported browser. See [VOICE_COMMAND_TEST_GUIDE.md](./VOICE_COMMAND_TEST_GUIDE.md).

The workflow tests cover first-visit and replayed tutorials, voice navigation, mobile positioning, unsupported browsers, permission denial, editing, dragging, shape persistence, JSON backup round-trips, invalid imports, map history, and playback controls. The smoke checks also exercise connect-mode creation blocking, duplicate and invalid connections, templates, search, arrangement, PNG export, presentation shortcuts, and mobile fit.

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

Starter templates create an editable project plan, decision map, or brainstorm. Arrange tidies unlocked thoughts into a grid and supports undo. Fit changes only the camera. Image export captures the entire map, including labeled directed connections, as a PNG (up to 4096 pixels per side). Thoughts and map history stay in browser storage on the current device; export JSON to keep a portable backup.

## Validation

No build step or application dependencies are required. Run the core regression tests with Node:

```bash
node --test tests/voice.test.cjs
```

With the local HTTP server running and Playwright available in your development environment, run the Chromium smoke checks:

```bash
node tests/browser-smoke.cjs
```

The browser checks use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` for another executable or `SPEECHFLOW_URL` for another local server. They use an isolated browser session and simulated recognition to verify the command pipeline. Live microphone recognition and audible speech output require manual testing in a supported browser. See [VOICE_COMMAND_TEST_GUIDE.md](./VOICE_COMMAND_TEST_GUIDE.md).

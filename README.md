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

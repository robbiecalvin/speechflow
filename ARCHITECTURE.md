# SpeechFlow architecture

## Runtime boundaries

The browser workspace uses `core/` modules for graph nodes and edges, layout, camera, persistence, playback and state. Voice responsibilities are separated into `voice-recognition.js`, `voice-parser.js`, `voice-router.js`, `voice-state.js`, `voice-settings.js` and `voice-errors.js`. UI and workbench modules coordinate interaction.

Native Android and iOS projects use Capacitor; `native/` contains native integration resources. The package manifest requires Node 22 or newer.

## Verification

- `node --test tests/voice.test.cjs`: focused voice behavior checks.
- `npm run test:native`: native integration unit checks.
- `npm run build:web`: web build.
- See [voice command test guide](VOICE_COMMAND_TEST_GUIDE.md) and [mobile documentation](MOBILE.md).

Native device behavior and microphone permissions require separate device verification. No new test execution is reported here.

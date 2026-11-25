# Testing SpeechFlow

Install dependencies with `npm ci` using Node 22 or newer.

```sh
node --test tests/voice.test.cjs
npm run build:web
npm run test:native
```

Build before native tests because they inspect generated web assets. See [voice command scenarios](VOICE_COMMAND_TEST_GUIDE.md) and [mobile verification](MOBILE.md). Check microphone permissions and recognition on actual devices separately. Report revision, commands, results and limitations; CI configuration alone is not passing evidence.

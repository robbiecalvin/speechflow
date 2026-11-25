# Agent instructions

## Scope

Preserve voice command/dictation distinctions, graph persistence and destructive-action confirmation. Run `node --test tests/voice.test.cjs`, `npm run test:native` and `npm run build:web`. Native microphone behavior requires device verification.

## Engineering workflow

Inspect relevant code and existing tests before editing. Keep changes focused, preserve unrelated user work and document assumptions. Do not expose secrets or use production data in tests. Report commands actually executed, outcomes and blockers. Do not claim release readiness from unexecuted checks.

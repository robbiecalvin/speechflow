# SpeechFlow Voice Command Test Guide

This guide reflects the currently implemented parser/router behavior in:
- `core/voice-parser.js`
- `core/voice-router.js`
- `script.js`

## Runtime Preconditions
- If **wake phrase mode** is enabled, every spoken command must start with your configured wake phrase.
  - Example with wake phrase `speechflow`: `speechflow connect mode`
- If **push-to-talk** is enabled, hold `Space` while speaking.
- Voice input is ignored while any modal is open.
- Confidence filtering applies if threshold is set above `0`.

## Parsing Rules
- Parsing is case-insensitive.
- Trailing punctuation is ignored for command matching (`. , ! ? ; :`).
- If a phrase does not match a command, it is treated as dictation and creates a bubble.

## Command Phrases

### Help
- `help`
- `voice help`
- `command list`
- `commands`
- `what can i say`

Expected: transcript panel shows command preview.

### Bubble Selection
- `bubble 3`
- `select bubble 3`
- `focus bubble 3`
- `go to bubble 3`

Expected: selects bubble index 3 and centers camera on it.

### Connect Mode
- `connect mode`
- `toggle connect mode`
- `connect mode on`
- `enable connect mode`
- `start connect mode`
- `connect mode off`
- `disable connect mode`
- `stop connect mode`

Expected: toggles or explicitly sets connect mode.

### Clear Map (Destructive, Confirmed)
- `clear`
- `clear map`
- `reset map`

Expected: confirmation prompt appears, then map clears if approved.

### Playback Controls
- `play`
- `start playback`
- `playback start`
- `play map`
- `stop`
- `stop playback`
- `playback stop`
- `pause`
- `pause playback`
- `resume`
- `resume playback`

Expected: playback state changes accordingly.

### Undo / Redo
- `undo`
- `undo last change`
- `redo`
- `redo last change`

Expected: undo/redo performed.

### Bubble Creation Commands
- `add bubble`
- `new bubble`
- `create bubble`

Expected: creates a default bubble (`New idea`).

- `add bubble quarterly roadmap`
- `create bubble fix auth timeout`

Expected: creates bubble with provided text.

### Selected Bubble Actions
- `delete bubble`
- `delete selected bubble`
- `remove bubble`

Expected: confirmation prompt, then deletes active selected bubble.

- `lock bubble`
- `lock selected bubble`
- `unlock bubble`
- `unlock selected bubble`

Expected: locks/unlocks active selected bubble.

### Layout / Utility
- `snap center`
- `center map`
- `center view`

Expected: runs snap-to-center behavior.

### Open / Close UI
- `open prompt`
- `create from prompt`

Expected: opens prompt modal.

- `voice settings`
- `open voice settings`

Expected: opens voice settings modal.

- `close voice settings`

Expected: closes voice settings modal.

## Typed Prefix Intents
These set bubble type and use the remainder as text:
- `question <text>`
- `task <text>`
- `note <text>`
- `blocker <text>`
- `idea <text>`

Examples:
- `question why are users dropping off`
- `task ship parser refactor`
- `note this needs legal review`
- `blocker missing api key`
- `idea launch partner channel`

Expected: creates a bubble with that type and remainder text.

## Dictation Fallback
Any non-command phrase creates a bubble directly.

Examples:
- `customer onboarding needs a better checklist`
- `schedule planning meeting for friday`

## Suggested QA Sequence
1. Disable wake phrase and push-to-talk.
2. Test selection command: `bubble 1`.
3. Test connect toggles: `connect mode on`, then `connect mode off`.
4. Test playback: `play`, `pause`, `resume`, `stop`.
5. Test typed intents: `task finish migration`.
6. Test destructive commands and confirm dialogs: `delete bubble`, `clear map`.
7. Enable wake phrase and retest commands with prefix.
8. Enable push-to-talk and retest while holding `Space`.

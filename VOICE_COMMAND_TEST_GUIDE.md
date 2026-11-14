# SpeechFlow Voice Command Test Guide

This guide reflects the currently implemented parser/router behavior in:
- `core/voice-parser.js`
- `core/voice-router.js`
- `script.js`

## Tooltip Tutorial

On first visit, the tutorial appears automatically. **Tour** in the header restarts it. Choose **Enable voice**, allow microphone access, and say exactly **“next”** or **“skip”**. “Next” advances one tooltip; on the final tooltip it finishes the tutorial. “Skip” dismisses the whole tutorial and remembers that choice on this browser. Buttons provide the same controls when voice is unavailable or permission is denied.

During the tour, bare next/skip work even with wake phrase, confidence filtering, push-to-talk, or Dictation only enabled. Other speech is ignored so instructions cannot accidentally become bubbles. Tour voice temporarily listens hands-free after explicit permission; normal voice settings resume when the tour closes. If the tour enabled a previously off microphone, it turns that microphone off on completion or skip.

Suggested checks: advance through all 11 steps by voice, skip midway, restart with Tour, try Back and Next buttons, deny microphone permission and continue with buttons, and verify your existing bubbles and connections are unchanged. Say “next idea” to verify partial matches do not advance the tutorial.

## Workspace and Input Modes

The microphone starts **off**. Click the microphone button in the capture bar to enable it and allow browser permission. You can also type commands in the capture bar without enabling the microphone.

- **Smart input** routes commands and captures unmatched speech as thoughts.
- **Dictation only** captures every phrase as text; it does not execute commands.
- **Commands only** rejects unmatched phrases with feedback.

Use Commands or Ctrl/Cmd+K for a searchable command list. Escape closes it and restores focus.

Additional commands:

| Phrase | Expected behavior |
| --- | --- |
| `connect bubble one to bubble two` | Creates a directed connection; rejects missing, duplicate, or identical endpoints |
| `select tool`, `pan tool`, `connect tool` | Changes the canvas tool |
| `zoom in`, `zoom out` | Changes camera scale |
| `fit map`, `fit to screen` | Fits all thoughts without moving them |
| `arrange map`, `tidy up` | Arranges unlocked thoughts; supports undo |
| `explore mode`, `capture mode`, `present mode` | Changes workspace mode |
| `next bubble`, `previous bubble` | Selects and centers the next or previous thought |

Selection and connection numbers accept digits and the words one through ten. Typed prefixes and add-bubble commands preserve capitalization in the captured text. A wake phrase must match a complete word, so the wake phrase `flow` does not match `flower`.

## Corrections, Layouts, and Presentation

| Phrase | Expected behavior |
| --- | --- |
| `rename bubble two to NASA Launch Plan` | Updates text and preserves capitalization |
| `change bubble three to a task` | Updates type without losing notes, shape, or connections |
| `label connection one to two as Depends on` | Labels an existing directed connection |
| `start presentation at bubble one` | Saves the starting point with the map |
| `flowchart layout`, `mind map layout`, `timeline layout` | Applies an undoable layout, preserving locked positions |
| `undo that` | Undoes the last change, or reports there is nothing to undo |

The feedback card shows what was heard and whether the action succeeded, failed, or was cancelled. Test invalid thought numbers and incomplete corrections; they must not create a bubble. Test cancelling clear-map confirmation; the result must say cancelled. In Present mode, dictation and editing commands must leave the map unchanged. End connected mode before renaming thoughts, changing types, or arranging layouts.

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

Say `connect mode` or `connected mode` to enter a persistent connection-only mode. Repeating the entry phrase keeps it enabled. While active, speech, typing, Add Bubble, templates, duplicate, paste, and frame creation cannot create new bubbles. Tool shortcuts cannot silently exit it. Undo and redo are paused until you end the mode.

Say `connect bubbles 1 and 2` (or `connect bubbles one and two`) to immediately draw a directed connection between existing bubbles. The mode stays active after connecting. Invalid, identical, and duplicate endpoints leave the map unchanged. Connection and exit commands remain available even if the input preference was Dictation only.

Say **`end connected mode`** or **`end connect mode`** to resume creating bubbles. An explicit End connect mode button is also available in the capture bar. Legacy off/stop phrases below still work.

- `connect mode`
- `toggle connect mode`
- `connect mode on`
- `enable connect mode`
- `start connect mode`
- `connect mode off`
- `disable connect mode`
- `stop connect mode`

Expected: entry phrases enable connect mode; explicit end/off/stop phrases disable it.

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

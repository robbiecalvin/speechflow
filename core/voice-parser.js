(function initVoiceParserModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const TYPE_PREFIX_INTENTS = {
    question: 'set_question_intent',
    task: 'set_task_intent',
    note: 'set_note_intent',
    blocker: 'set_blocker_intent',
    idea: 'set_idea_intent'
  };

  const COMMAND_REFERENCE = [
    { intent: 'voice_help', phrases: ['help', 'voice help', 'command list', 'what can i say'] },
    { intent: 'select_bubble', phrases: ['bubble 3', 'select bubble 3', 'focus bubble 3', 'go to bubble 3'] },
    { intent: 'toggle_connect_mode', phrases: ['connect mode', 'toggle connect mode'] },
    { intent: 'set_connect_mode_on', phrases: ['connect mode on', 'enable connect mode', 'start connect mode'] },
    { intent: 'set_connect_mode_off', phrases: ['connect mode off', 'disable connect mode', 'stop connect mode'] },
    { intent: 'clear_map', phrases: ['clear', 'clear map', 'reset map'] },
    { intent: 'start_playback', phrases: ['play', 'start playback', 'play map'] },
    { intent: 'stop_playback', phrases: ['stop', 'stop playback'] },
    { intent: 'pause_playback', phrases: ['pause', 'pause playback'] },
    { intent: 'resume_playback', phrases: ['resume', 'resume playback'] },
    { intent: 'undo', phrases: ['undo'] },
    { intent: 'redo', phrases: ['redo'] },
    { intent: 'add_bubble', phrases: ['add bubble', 'new bubble', 'create bubble'] },
    { intent: 'delete_selected_bubble', phrases: ['delete bubble', 'delete selected bubble'] },
    { intent: 'lock_selected_bubble', phrases: ['lock bubble', 'lock selected bubble'] },
    { intent: 'unlock_selected_bubble', phrases: ['unlock bubble', 'unlock selected bubble'] },
    { intent: 'snap_center', phrases: ['snap center', 'center map', 'center view'] },
    { intent: 'open_prompt_modal', phrases: ['open prompt', 'create from prompt'] },
    { intent: 'open_voice_settings', phrases: ['voice settings', 'open voice settings'] },
    { intent: 'close_voice_settings', phrases: ['close voice settings'] },
    { intent: 'set_question_intent', phrases: ['question <text>'] },
    { intent: 'set_task_intent', phrases: ['task <text>'] },
    { intent: 'set_note_intent', phrases: ['note <text>'] },
    { intent: 'set_blocker_intent', phrases: ['blocker <text>'] },
    { intent: 'set_idea_intent', phrases: ['idea <text>'] }
  ];

  function normalizeTranscript(raw) {
    const text = String(raw || '').trim();
    const lowered = text.toLowerCase();
    const compact = lowered.replace(/\s+/g, ' ').trim();
    const stripped = compact.replace(/[!?.,;:]+$/g, '').trim();
    return {
      text,
      lowered,
      compact,
      stripped
    };
  }

  function makeCommand(intent, args, normalized) {
    return {
      mode: 'command',
      intent,
      args: args || {},
      normalized
    };
  }

  function parseSelectBubble(compact, normalized) {
    const patterns = [
      /^bubble\s+(\d+)\b$/,
      /^(?:select|focus|go to)\s+bubble\s+(\d+)\b$/
    ];
    for (let i = 0; i < patterns.length; i += 1) {
      const match = compact.match(patterns[i]);
      if (match) {
        return makeCommand('select_bubble', { bubbleIndex: parseInt(match[1], 10) - 1 }, normalized);
      }
    }
    return null;
  }

  function parseTypePrefix(normalized) {
    const match = normalized.compact.match(/^(question|task|note|blocker|idea)\s+(.+)$/);
    if (!match) return null;
    const keyword = match[1];
    const remainder = normalized.text.slice(normalized.text.toLowerCase().indexOf(`${keyword} `) + keyword.length + 1).trim();
    const intent = TYPE_PREFIX_INTENTS[keyword];
    return makeCommand(intent, { remainder }, normalized);
  }

  function parseCommandAliases(compact, normalized) {
    const aliases = [
      { intent: 'voice_help', values: ['help', 'voice help', 'command list', 'commands', 'what can i say'] },
      { intent: 'toggle_connect_mode', values: ['connect mode', 'toggle connect mode'] },
      { intent: 'set_connect_mode_on', values: ['connect mode on', 'enable connect mode', 'start connect mode'] },
      { intent: 'set_connect_mode_off', values: ['connect mode off', 'disable connect mode', 'stop connect mode'] },
      { intent: 'clear_map', values: ['clear', 'clear map', 'reset map'] },
      { intent: 'start_playback', values: ['play', 'start playback', 'playback start', 'play map'] },
      { intent: 'stop_playback', values: ['stop', 'stop playback', 'playback stop'] },
      { intent: 'pause_playback', values: ['pause', 'pause playback'] },
      { intent: 'resume_playback', values: ['resume', 'resume playback'] },
      { intent: 'undo', values: ['undo', 'undo last change'] },
      { intent: 'redo', values: ['redo', 'redo last change'] },
      { intent: 'add_bubble', values: ['add bubble', 'new bubble', 'create bubble'] },
      { intent: 'delete_selected_bubble', values: ['delete bubble', 'delete selected bubble', 'remove bubble'] },
      { intent: 'lock_selected_bubble', values: ['lock bubble', 'lock selected bubble'] },
      { intent: 'unlock_selected_bubble', values: ['unlock bubble', 'unlock selected bubble'] },
      { intent: 'snap_center', values: ['snap center', 'center map', 'center view'] },
      { intent: 'open_prompt_modal', values: ['open prompt', 'create from prompt'] },
      { intent: 'open_voice_settings', values: ['voice settings', 'open voice settings'] },
      { intent: 'close_voice_settings', values: ['close voice settings'] }
    ];

    for (let i = 0; i < aliases.length; i += 1) {
      const alias = aliases[i];
      if (alias.values.includes(compact)) {
        return makeCommand(alias.intent, {}, normalized);
      }
    }

    return null;
  }

  function parseAddBubbleWithText(normalized) {
    const match = normalized.compact.match(/^(?:add|create)\s+bubble\s+(.+)$/);
    if (!match) return null;
    return makeCommand('add_bubble', { transcript: match[1] }, normalized);
  }

  function parseVoiceInput(raw) {
    const normalized = normalizeTranscript(raw);
    const compact = normalized.stripped;

    if (!compact) {
      return {
        mode: 'ignore',
        intent: null,
        args: {},
        normalized
      };
    }

    const selectBubbleCommand = parseSelectBubble(compact, normalized);
    if (selectBubbleCommand) return selectBubbleCommand;

    const addBubbleWithText = parseAddBubbleWithText(normalized);
    if (addBubbleWithText) return addBubbleWithText;

    const prefixedType = parseTypePrefix(normalized);
    if (prefixedType) return prefixedType;

    const aliasCommand = parseCommandAliases(compact, normalized);
    if (aliasCommand) return aliasCommand;

    return {
      mode: 'dictation',
      intent: 'create_bubble',
      args: { transcript: normalized.text },
      normalized
    };
  }

  function getCommandReference() {
    return COMMAND_REFERENCE.slice();
  }

  root.voiceParser = {
    parseVoiceInput,
    normalizeTranscript,
    getCommandReference
  };
})(window);

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
    { intent: 'rename_bubble', phrases: ['rename bubble 2 to Launch plan'] },
    { intent: 'change_bubble_type', phrases: ['change bubble 3 to a task'] },
    { intent: 'label_connection', phrases: ['label connection 1 to 2 as Depends on'] },
    { intent: 'set_start', phrases: ['start presentation at bubble 1'] },
    { intent: 'set_layout', phrases: ['flowchart layout', 'mind map layout', 'timeline layout'] },
    { intent: 'arrange_map', phrases: ['arrange map', 'tidy up'] },
    { intent: 'connect_bubbles', phrases: ['connect bubbles 1 and 2', 'connect bubble 1 to bubble 2'] },
    { intent: 'set_tool', phrases: ['select tool', 'pan tool', 'connect tool'] },
    { intent: 'zoom', phrases: ['zoom in', 'zoom out'] },
    { intent: 'fit_map', phrases: ['fit map', 'fit to screen'] },
    { intent: 'set_mode', phrases: ['explore mode', 'capture mode', 'present mode'] },
    { intent: 'navigate', phrases: ['next bubble', 'previous bubble'] },
    { intent: 'voice_help', phrases: ['help', 'voice help', 'command list', 'what can i say'] },
    { intent: 'select_bubble', phrases: ['bubble 3', 'select bubble 3', 'focus bubble 3', 'go to bubble 3'] },
    { intent: 'set_connect_mode_on', phrases: ['connect mode', 'connected mode', 'start connected mode'] },
    { intent: 'set_connect_mode_on', phrases: ['connect mode on', 'enable connect mode', 'start connect mode'] },
    { intent: 'set_connect_mode_off', phrases: ['end connected mode', 'end connect mode', 'connect mode off', 'stop connect mode'] },
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
    const match = normalized.text.match(/^(question|task|note|blocker|idea)\s+(.+)$/i);
    if (!match) return null;
    const keyword = match[1].toLowerCase();
    const remainder = match[2].trim();
    const intent = TYPE_PREFIX_INTENTS[keyword];
    return makeCommand(intent, { remainder }, normalized);
  }

  function parseCommandAliases(compact, normalized) {
    const aliases = [
      { intent: 'voice_help', values: ['help', 'voice help', 'command list', 'commands', 'what can i say'] },
      { intent: 'set_connect_mode_on', values: ['connect mode', 'connected mode', 'start connected mode', 'enable connected mode', 'toggle connect mode'] },
      { intent: 'set_connect_mode_on', values: ['connect mode on', 'enable connect mode', 'start connect mode'] },
      { intent: 'set_connect_mode_off', values: ['end connected mode', 'end connect mode', 'stop connected mode', 'disable connected mode', 'connect mode off', 'disable connect mode', 'stop connect mode'] },
      { intent: 'clear_map', values: ['clear', 'clear map', 'reset map'] },
      { intent: 'start_playback', values: ['play', 'start playback', 'playback start', 'play map'] },
      { intent: 'stop_playback', values: ['stop', 'stop playback', 'playback stop'] },
      { intent: 'pause_playback', values: ['pause', 'pause playback'] },
      { intent: 'resume_playback', values: ['resume', 'resume playback'] },
      { intent: 'undo', values: ['undo', 'undo last change', 'undo that'] },
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
    const match = normalized.text.match(/^(?:add|create|new)\s+bubble\s+(.+)$/i);
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

    const numbers = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
    const numbered = compact.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, word => numbers[word]);
    const rename = numbered.match(/^(?:rename|edit) bubble (\d+) to (.+)$/);
    if(rename) return makeCommand('rename_bubble', {index:Number(rename[1])-1, text:normalized.text.replace(/^(?:rename|edit)\s+bubble\s+\S+\s+to\s+/i,'').trim()},normalized);
    const change = numbered.match(/^change bubble (\d+) to (?:a |an )?(idea|task|question|blocker|note)$/);
    if(change) return makeCommand('change_bubble_type',{index:Number(change[1])-1,type:change[2]},normalized);
    const label = numbered.match(/^label connection (\d+) (?:to|and) (\d+) (?:as|to) (.+)$/);
    if(label) return makeCommand('label_connection',{from:Number(label[1])-1,to:Number(label[2])-1,label:normalized.text.replace(/^label\s+connection\s+\S+\s+(?:to|and)\s+\S+\s+(?:as|to)\s+/i,'').trim()},normalized);
    const start = numbered.match(/^start presentation at bubble (\d+)$/);
    if(start) return makeCommand('set_start',{index:Number(start[1])-1},normalized);
    const layout = compact.match(/^(flowchart|mind ?map|timeline|grid) layout$/);
    if(layout) return makeCommand('set_layout',{layout:layout[1].replace(' ','')},normalized);
    const link = numbered.match(/^connect (?:bubbles? )?(\d+) (?:to|and) (?:bubble )?(\d+)$/);
    if (link) return makeCommand('connect_bubbles', {from:Number(link[1])-1, to:Number(link[2])-1}, normalized);
    if (['arrange map','tidy up'].includes(compact)) return makeCommand('arrange_map', {}, normalized);
    const tool = compact.match(/^(select|pan|connect) tool$/);
    if (tool) return makeCommand('set_tool', {tool:tool[1]}, normalized);
    if (/^zoom (in|out)$/.test(compact)) return makeCommand('zoom', {direction:compact.endsWith('in') ? 1 : -1}, normalized);
    if (['fit map','fit to screen','zoom to fit'].includes(compact)) return makeCommand('fit_map', {}, normalized);
    const mode = compact.match(/^(explore|capture|present)(?: mode)?$/);
    if (mode) return makeCommand('set_mode', {mode:mode[1]}, normalized);
    if (['next bubble','previous bubble'].includes(compact)) return makeCommand('navigate', {direction:compact.startsWith('next') ? 1 : -1}, normalized);
    if (/^(?:rename|edit|change) bubble\b|^label connection\b|^start presentation at bubble\b/.test(compact)) {
      return makeCommand('invalid_command',{message:'Try “rename bubble 2 to launch plan”, “change bubble 3 to a task”, or “label connection 1 to 2 as depends on”.'},normalized);
    }
    const selectBubbleCommand = parseSelectBubble(numbered, normalized);
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

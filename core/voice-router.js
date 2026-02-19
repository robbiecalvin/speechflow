(function initVoiceRouterModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const DESTRUCTIVE_INTENTS = new Set(['clear_map', 'delete_selected_bubble']);

  const INTENT_HANDLER_MAP = {
    select_bubble: 'onSelectBubble',
    toggle_connect_mode: 'onToggleConnectMode',
    set_connect_mode_on: 'onSetConnectModeOn',
    set_connect_mode_off: 'onSetConnectModeOff',
    clear_map: 'onClearMap',
    start_playback: 'onStartPlayback',
    stop_playback: 'onStopPlayback',
    pause_playback: 'onPausePlayback',
    resume_playback: 'onResumePlayback',
    undo: 'onUndo',
    redo: 'onRedo',
    add_bubble: 'onAddBubble',
    delete_selected_bubble: 'onDeleteSelectedBubble',
    lock_selected_bubble: 'onLockSelectedBubble',
    unlock_selected_bubble: 'onUnlockSelectedBubble',
    snap_center: 'onSnapCenter',
    open_prompt_modal: 'onOpenPromptModal',
    open_voice_settings: 'onOpenVoiceSettings',
    close_voice_settings: 'onCloseVoiceSettings',
    voice_help: 'onVoiceHelp'
  };

  function createVoiceRouter(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const parser = opts.parser;

    if (!parser || typeof parser.parseVoiceInput !== 'function') {
      throw new Error('Voice router requires a parser with parseVoiceInput().');
    }

    function route(rawTranscript) {
      const parsed = parser.parseVoiceInput(rawTranscript);
      if (!parsed || parsed.mode === 'ignore') return;

      if (parsed.mode === 'dictation') {
        if (typeof opts.onDictation === 'function') {
          opts.onDictation(parsed.args.transcript, parsed);
        }
        return;
      }

      if (
        parsed.intent === 'set_question_intent' ||
        parsed.intent === 'set_task_intent' ||
        parsed.intent === 'set_note_intent' ||
        parsed.intent === 'set_blocker_intent' ||
        parsed.intent === 'set_idea_intent'
      ) {
        if (typeof opts.onTypedIntent === 'function') {
          opts.onTypedIntent(parsed.intent, parsed.args.remainder || '', parsed);
        } else if (parsed.intent === 'set_question_intent' && typeof opts.onQuestionIntent === 'function') {
          opts.onQuestionIntent(parsed.args.remainder || '', parsed);
        }
        if (parsed.args.remainder && typeof opts.onDictation === 'function') {
          opts.onDictation(parsed.args.remainder, parsed);
        }
        return;
      }

      const handlerName = INTENT_HANDLER_MAP[parsed.intent];
      const handler = handlerName ? opts[handlerName] : null;
      if (!handler || typeof handler !== 'function') return;

      if (DESTRUCTIVE_INTENTS.has(parsed.intent) && typeof opts.confirmDestructive === 'function') {
        const approved = !!opts.confirmDestructive(parsed);
        if (!approved) return;
      }

      handler(parsed.args || {}, parsed);
      if (typeof opts.onIntent === 'function') {
        opts.onIntent(parsed);
      }
    }

    return {
      route
    };
  }

  root.voiceRouter = {
    createVoiceRouter
  };
})(window);

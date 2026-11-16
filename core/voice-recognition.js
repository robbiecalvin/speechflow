(function initVoiceRecognitionModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function createVoiceRecognitionController(options) {
    const opts = options && typeof options === 'object' ? options : {};

    if (!opts.voiceState || typeof opts.voiceState.transition !== 'function') {
      throw new Error('Voice recognition controller requires a voice state machine.');
    }

    const onResult = typeof opts.onResult === 'function' ? opts.onResult : null;
    const onRecognitionError = typeof opts.onRecognitionError === 'function' ? opts.onRecognitionError : null;
    const mapError = typeof opts.mapError === 'function' ? opts.mapError : (error) => error;
    let configuredLanguage = opts.language || 'en-US';

    const RecognitionCtor = opts.RecognitionCtor;
    let autoRestart = opts.autoRestart !== false;

    let recognition = null;
    let restartTimer = null;
    let restartAttempts = 0;
    let stoppedByUser = false;
    let restartAllowed = true;
    let isRunning = false;
    let delivered = new Set();

    function clearRestartTimer() {
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
    }

    function backoffDelayMs() {
      const base = 500;
      const cappedAttempt = Math.min(restartAttempts, 6);
      return base * (2 ** cappedAttempt);
    }

    function scheduleRestart() {
      if (!autoRestart || stoppedByUser || !restartAllowed) return;
      clearRestartTimer();
      const delay = backoffDelayMs();
      restartAttempts += 1;
      restartTimer = setTimeout(() => {
        startListening({ allowRetry: false });
      }, delay);
    }

    function bindRecognitionEvents() {
      const boundRecognition=recognition;
      recognition.onstart = () => {
        if(stoppedByUser || recognition!==boundRecognition)return;
        opts.voiceState.transition(opts.voiceState.STATES.LISTENING, {source:'onstart'});
      };
      recognition.onresult = (event) => {
        if (recognition!==boundRecognition || stoppedByUser || (opts.shouldAcceptResult && !opts.shouldAcceptResult())) return;
        if(opts.voiceState.getState().state===opts.voiceState.STATES.REQUESTING_PERMISSION)opts.voiceState.transition(opts.voiceState.STATES.LISTENING,{source:'result'});
        opts.voiceState.transition(opts.voiceState.STATES.PROCESSING, { source: 'onresult' });
        // Each final result index belongs to this recognition session. Ignore repeated finals.
        // Minimal simulated/legacy events lack resultIndex/isFinal; keep those compatible.
        const indexed = Number.isInteger(event.resultIndex);
        for(let i=indexed?event.resultIndex:event.results.length-1;i<event.results.length;i++) {
          if(stoppedByUser)break;
          const result=event.results[i];
          if(result.isFinal===false || (indexed && delivered.has(i)))continue;
          if(indexed)delivered.add(i);
          if(onResult)onResult(result[0].transcript, {results:event.results,resultIndex:i});
        }
        if (!stoppedByUser && opts.voiceState.getState().state === opts.voiceState.STATES.PROCESSING) {
          opts.voiceState.transition(opts.voiceState.STATES.LISTENING, { source: 'onresult_complete' });
        }
      };

      recognition.onerror = (event) => {
        if (recognition!==boundRecognition || stoppedByUser) return;
        const normalizedError = mapError(event);
        restartAllowed = !!(normalizedError.recoverable && normalizedError.restart);
        if (!restartAllowed) clearRestartTimer();
        opts.voiceState.setError(normalizedError);
        if (onRecognitionError) onRecognitionError(normalizedError, event);
        if (!normalizedError.recoverable || !normalizedError.restart) {
          return;
        }
        scheduleRestart();
      };

      recognition.onend = () => {
        if(recognition!==boundRecognition)return;
        isRunning = false;
        const current = opts.voiceState.getState();
        if (stoppedByUser) {
          opts.voiceState.transition(opts.voiceState.STATES.IDLE, { source: 'onend_stopped' });
          return;
        }

        if (current.state !== opts.voiceState.STATES.ERROR) {
          opts.voiceState.transition(opts.voiceState.STATES.IDLE, { source: 'onend' });
        }
        scheduleRestart();
      };
    }

    function ensureRecognition() {
      if (recognition) return recognition;
      if (!RecognitionCtor) return null;

      recognition = new RecognitionCtor();
      recognition.continuous = opts.continuous !== false;
      recognition.interimResults = !!opts.interimResults;
      recognition.lang = configuredLanguage;
      bindRecognitionEvents();
      return recognition;
    }

    function startListening(startOptions) {
      const startOpts = startOptions && typeof startOptions === 'object' ? startOptions : {};
      if (isRunning) return true;
      recognition=null;
      const instance = ensureRecognition();
      if (!instance) {
        const unsupportedError = {
          code: 'not_supported',
          message: 'Speech recognition is not supported in this browser.',
          recoverable: false,
          restart: false,
          timestamp: new Date().toISOString()
        };
        opts.voiceState.setError(unsupportedError);
        if (onRecognitionError) onRecognitionError(unsupportedError, null);
        return false;
      }

      stoppedByUser = false;
      restartAllowed = true;
      clearRestartTimer();

      if (startOpts.allowRetry !== false) {
        restartAttempts = 0;
      }

      try {
        opts.voiceState.transition(opts.voiceState.STATES.REQUESTING_PERMISSION, { source: 'start' });
        delivered.clear();
        instance.start();
        isRunning = true;
        return true;
      } catch (error) {
        const normalizedError = mapError({ error: error?.name || 'start_failed' });
        restartAllowed = !!(normalizedError.recoverable && normalizedError.restart);
        if (!restartAllowed) clearRestartTimer();
        opts.voiceState.setError(normalizedError);
        if (onRecognitionError) onRecognitionError(normalizedError, error);
        if (normalizedError.restart && normalizedError.recoverable) {
          scheduleRestart();
        }
        return false;
      }
    }

    function stopListening() {
      stoppedByUser = true;
      clearRestartTimer();
      restartAttempts = 0;
      const stoppingRecognition = recognition;
      recognition = null;
      if (stoppingRecognition) {
        try {
          stoppingRecognition.stop();
        } catch (error) {
          // no-op: recognition may already be stopped
        }
      }
      isRunning = false;
      const current = opts.voiceState.getState();
      if (current.state !== opts.voiceState.STATES.IDLE) {
        opts.voiceState.transition(opts.voiceState.STATES.IDLE, { source: 'stop' });
      }
    }

    function setLanguage(language) {
      if (!language) return;
      configuredLanguage = language;
      if (recognition) {
        recognition.lang = language;
      }
    }

    function setAutoRestart(value) {
      autoRestart = value !== false;
      if (!autoRestart) {
        clearRestartTimer();
      }
    }

    function isListening() {
      return isRunning;
    }

    return {
      startListening,
      stopListening,
      setLanguage,
      setAutoRestart,
      isListening
    };
  }

  root.voiceRecognition = {
    createVoiceRecognitionController
  };
})(window);

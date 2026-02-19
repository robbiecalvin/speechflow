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
    let isRunning = false;

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
      if (!autoRestart || stoppedByUser) return;
      clearRestartTimer();
      const delay = backoffDelayMs();
      restartAttempts += 1;
      restartTimer = setTimeout(() => {
        startListening({ allowRetry: false });
      }, delay);
    }

    function bindRecognitionEvents() {
      recognition.onresult = (event) => {
        opts.voiceState.transition(opts.voiceState.STATES.PROCESSING, { source: 'onresult' });
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript;
        if (onResult) onResult(transcript, event);
        opts.voiceState.transition(opts.voiceState.STATES.LISTENING, { source: 'onresult_complete' });
      };

      recognition.onerror = (event) => {
        const normalizedError = mapError(event);
        opts.voiceState.setError(normalizedError);
        if (onRecognitionError) onRecognitionError(normalizedError, event);
        if (!normalizedError.recoverable || !normalizedError.restart) {
          return;
        }
        scheduleRestart();
      };

      recognition.onend = () => {
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
      clearRestartTimer();

      if (startOpts.allowRetry !== false) {
        restartAttempts = 0;
      }

      try {
        opts.voiceState.transition(opts.voiceState.STATES.REQUESTING_PERMISSION, { source: 'start' });
        instance.start();
        isRunning = true;
        opts.voiceState.transition(opts.voiceState.STATES.LISTENING, { source: 'start_success' });
        return true;
      } catch (error) {
        const normalizedError = mapError({ error: error?.name || 'start_failed' });
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
      if (recognition) {
        try {
          recognition.stop();
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

(function initVoiceStateModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const STATES = {
    IDLE: 'idle',
    REQUESTING_PERMISSION: 'requesting_permission',
    LISTENING: 'listening',
    PROCESSING: 'processing',
    SPEAKING: 'speaking',
    PAUSED: 'paused',
    ERROR: 'error'
  };

  const TRANSITIONS = {
    [STATES.IDLE]: new Set([STATES.REQUESTING_PERMISSION, STATES.LISTENING, STATES.ERROR]),
    [STATES.REQUESTING_PERMISSION]: new Set([STATES.LISTENING, STATES.ERROR, STATES.IDLE]),
    [STATES.LISTENING]: new Set([STATES.PROCESSING, STATES.ERROR, STATES.IDLE, STATES.PAUSED, STATES.SPEAKING]),
    [STATES.PROCESSING]: new Set([STATES.LISTENING, STATES.SPEAKING, STATES.ERROR, STATES.IDLE]),
    [STATES.SPEAKING]: new Set([STATES.LISTENING, STATES.PAUSED, STATES.ERROR, STATES.IDLE]),
    [STATES.PAUSED]: new Set([STATES.LISTENING, STATES.SPEAKING, STATES.ERROR, STATES.IDLE]),
    [STATES.ERROR]: new Set([STATES.IDLE, STATES.REQUESTING_PERMISSION, STATES.LISTENING])
  };

  function createVoiceStateMachine(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

    let currentState = STATES.IDLE;
    let lastError = null;

    function canTransition(nextState) {
      if (nextState === currentState) return true;
      const allowed = TRANSITIONS[currentState];
      return !!allowed && allowed.has(nextState);
    }

    function transition(nextState, meta) {
      if (!Object.values(STATES).includes(nextState)) {
        throw new Error(`Unknown voice state: ${nextState}`);
      }
      if (!canTransition(nextState)) {
        throw new Error(`Invalid voice state transition: ${currentState} -> ${nextState}`);
      }

      const prevState = currentState;
      currentState = nextState;
      if (nextState !== STATES.ERROR) {
        lastError = null;
      }
      if (meta && meta.error) {
        lastError = meta.error;
      }

      if (onChange) {
        onChange({
          prevState,
          state: currentState,
          lastError,
          meta: meta || null
        });
      }

      return currentState;
    }

    function setError(error) {
      return transition(STATES.ERROR, { error });
    }

    function getState() {
      return {
        state: currentState,
        lastError
      };
    }

    return {
      STATES,
      transition,
      setError,
      getState,
      canTransition
    };
  }

  root.voiceState = {
    STATES,
    createVoiceStateMachine
  };
})(window);

(function initVoiceErrorsModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const ERROR_MAP = {
    'not-allowed': {
      code: 'permission_denied',
      message: 'Microphone access is blocked. Enable microphone permissions and retry.',
      recoverable: false,
      restart: false
    },
    'service-not-allowed': {
      code: 'service_blocked',
      message: 'Speech recognition service is not allowed in this browser/session.',
      recoverable: false,
      restart: false
    },
    'audio-capture': {
      code: 'audio_capture_unavailable',
      message: 'No microphone was detected. Check your audio input device.',
      recoverable: true,
      restart: true
    },
    'network': {
      code: 'network_error',
      message: 'Speech recognition network error. Retrying automatically.',
      recoverable: true,
      restart: true
    },
    'no-speech': {
      code: 'no_speech_detected',
      message: 'No speech detected. Continue speaking to keep listening active.',
      recoverable: true,
      restart: true
    },
    'aborted': {
      code: 'recognition_aborted',
      message: 'Speech recognition was stopped.',
      recoverable: true,
      restart: true
    }
  };

  function normalizeRecognitionError(input) {
    const rawCode = input && input.error ? input.error : 'unknown';
    const mapped = ERROR_MAP[rawCode] || {
      code: 'unknown_error',
      message: `Speech recognition error: ${rawCode}`,
      recoverable: true,
      restart: true
    };

    return {
      rawCode,
      code: mapped.code,
      message: mapped.message,
      recoverable: mapped.recoverable,
      restart: mapped.restart,
      timestamp: new Date().toISOString()
    };
  }

  root.voiceErrors = {
    normalizeRecognitionError
  };
})(window);

(function initVoiceSettingsModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  const STORAGE_KEY = 'speechflowVoiceSettings';

  const DEFAULT_SETTINGS = {
    language: 'en-US',
    autoRestart: true,
    wakePhraseEnabled: false,
    wakePhrase: 'speechflow',
    pushToTalkEnabled: false,
    confidenceThreshold: 0,
    playbackRate: 1,
    playbackPitch: 1,
    playbackVoice: ''
  };

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(Math.max(numeric, min), max);
  }

  function sanitizeSettings(input) {
    const source = input && typeof input === 'object' ? input : {};
    return {
      language: typeof source.language === 'string' && source.language.trim() ? source.language.trim() : DEFAULT_SETTINGS.language,
      autoRestart: source.autoRestart !== false,
      wakePhraseEnabled: !!source.wakePhraseEnabled,
      wakePhrase: typeof source.wakePhrase === 'string' && source.wakePhrase.trim() ? source.wakePhrase.trim().toLowerCase() : DEFAULT_SETTINGS.wakePhrase,
      pushToTalkEnabled: !!source.pushToTalkEnabled,
      confidenceThreshold: clampNumber(source.confidenceThreshold, 0, 1, DEFAULT_SETTINGS.confidenceThreshold),
      playbackRate: clampNumber(source.playbackRate, 0.5, 2, DEFAULT_SETTINGS.playbackRate),
      playbackPitch: clampNumber(source.playbackPitch, 0.5, 2, DEFAULT_SETTINGS.playbackPitch),
      playbackVoice: typeof source.playbackVoice === 'string' ? source.playbackVoice : DEFAULT_SETTINGS.playbackVoice
    };
  }

  function loadSettings() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return sanitizeSettings(JSON.parse(raw));
    } catch (error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    const sanitized = sanitizeSettings(settings);
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  }

  root.voiceSettings = {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    sanitizeSettings
  };
})(window);

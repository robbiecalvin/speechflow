(function initSpeechModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});

  function speak(text, options) {
    if (!global.speechSynthesis || typeof global.SpeechSynthesisUtterance !== 'function') return false;
    const opts = options && typeof options === 'object' ? options : {};
    const utterance = new SpeechSynthesisUtterance(String(text || ''));
    utterance.rate = Number.isFinite(opts.rate) ? opts.rate : 1;
    utterance.pitch = Number.isFinite(opts.pitch) ? opts.pitch : 1;
    utterance.lang = typeof opts.lang === 'string' ? opts.lang : 'en-US';
    if (typeof opts.voiceName === 'string' && opts.voiceName) {
      const voices = global.speechSynthesis.getVoices ? global.speechSynthesis.getVoices() : [];
      const voice = voices.find((item) => item?.name === opts.voiceName);
      if (voice) utterance.voice = voice;
    }
    let completed = false;
    const complete = event => {if(completed)return;completed=true;opts.onComplete?.(event);};
    utterance.onend=complete;utterance.onerror=complete;
    try { global.speechSynthesis.speak(utterance); } catch { return false; }
    return true;
  }

  root.speech = {
    speak
  };
})(window);

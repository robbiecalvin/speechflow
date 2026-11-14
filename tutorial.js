/* Non-destructive, voice-navigable tour. Microphone access requires a user gesture. */
(function () {
  const storageKey = 'speechflow.tutorial.v1';
  const $ = id => document.getElementById(id);
  const launcher = document.createElement('button');
  launcher.id = 'tutorialLauncher';
  launcher.className = 'quiet-button';
  launcher.type = 'button';
  launcher.textContent = 'Tour';
  launcher.setAttribute('aria-label', 'Start SpeechFlow tutorial');
  document.querySelector('.workspace-header').appendChild(launcher);
  const layer = document.createElement('div');
  layer.id = 'tutorialLayer'; layer.className = 'hidden';
  layer.innerHTML = `<div id="tutorialHighlight" aria-hidden="true"></div>
    <section id="tutorialCard" role="dialog" aria-modal="false" aria-labelledby="tutorialTitle" aria-describedby="tutorialText" tabindex="-1">
      <div class="tour-heading"><span id="tutorialProgress" class="eyebrow"></span><button id="tutorialSkip" type="button">Skip tour</button></div>
      <div aria-live="polite" aria-atomic="true"><h2 id="tutorialTitle"></h2><p id="tutorialText"></p></div>
      <div class="tour-voice"><button id="tutorialVoice" type="button">Enable voice</button><span id="tutorialVoiceStatus" role="status"></span></div>
      <div class="tour-footer"><button id="tutorialBack" type="button">Back</button><span>Say “next” or “skip”</span><button id="tutorialNext" class="primary-button" type="button">Next →</button></div>
    </section>`;
  document.body.appendChild(layer);
  let initial = null;
  let voiceEnabled = false;
  let ownedMicrophone = false;
  let frame;
  let lastGeometry = '';
  const model = SpeechFlowCore.tutorial.createTutorial({ onChange: render });
  function restore() {
    voiceEnabled = false;
    if (ownedMicrophone && microphoneEnabled) $('microphoneToggle').click();
    else if (microphoneEnabled) applyVoiceSettingsRuntime();
    ownedMicrophone = false;
    isBubbleColumnCollapsed = initial.collapsed;
    updateBubbleColumnLayout();
    if (document.body.dataset.workspaceMode !== initial.mode) SpeechFlowWorkspace.setMode(initial.mode);
    initial.focus?.focus();
  }
  function render(state, reason) {
    layer.classList.toggle('hidden', !state.active);
    if (!state.active) {
      cancelAnimationFrame(frame);
      restore();
      try { localStorage.setItem(storageKey, reason); } catch { /* Tour still works without storage. */ }
      SpeechFlowWorkspace.notify(reason === 'complete' ? 'You’re ready to explore. Restart the tutorial anytime with Tour.' : 'Tutorial skipped. Restart anytime with Tour.');
      return;
    }
    const step = state.step;
    $('tutorialTitle').textContent = step.title;
    $('tutorialText').textContent = step.text;
    $('tutorialProgress').textContent = `QUICK TOUR · ${state.index + 1} / ${state.total}`;
    $('tutorialBack').disabled = state.index === 0;
    $('tutorialNext').textContent = state.index === state.total - 1 ? 'Finish ✓' : 'Next →';
    isBubbleColumnCollapsed = step.sidebar ? false : initial.collapsed;
    updateBubbleColumnLayout();
    lastGeometry = '';
    position();
    if (reason !== 'start') $('tutorialNext').focus({preventScroll:true});
  }
  function position() {
    if (!model.getState().active) return;
    const target = document.querySelector(model.getState().step.target);
    if (!target) return;
    if (model.getState().step.sidebar) target.scrollIntoView({block:'nearest'});
    const rect = target.getBoundingClientRect();
    const card = $('tutorialCard');
    const width = Math.min(360, innerWidth - 24);
    card.style.width = `${width}px`;
    const height = card.offsetHeight;
    let left = rect.right + 18, top = rect.top;
    if (left + width > innerWidth - 12) {
      left = Math.max(12, Math.min(innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
      top = rect.top - height - 18;
      if (top < 12) top = rect.bottom + 18;
    }
    top = Math.max(12, Math.min(innerHeight - height - 12, top));
    const geometry = [rect.left,rect.top,rect.width,rect.height,left,top].join('|');
    if (geometry === lastGeometry) return;
    lastGeometry = geometry;
    Object.assign($('tutorialHighlight').style, {left:`${Math.max(0,rect.left-5)}px`,top:`${Math.max(0,rect.top-5)}px`,width:`${Math.min(innerWidth,rect.width+10)}px`,height:`${rect.height+10}px`});
    Object.assign(card.style, {left:`${left}px`,top:`${top}px`});
  }
  function tick() {
    if (!model.getState().active) return;
    position();
    const supported = !!SpeechRecognitionCtor;
    $('tutorialVoice').disabled = !supported;
    $('tutorialVoice').textContent = voiceEnabled ? 'Turn tour voice off' : 'Enable voice';
    $('tutorialVoiceStatus').textContent = !supported ? 'Voice unavailable here. Use Next or Skip.' : voiceEnabled ? (lastKnownVoiceState === 'error' ? 'Microphone unavailable. Check permission or use the buttons.' : lastKnownVoiceState === 'listening' ? 'Listening for “next” or “skip”.' : 'Waiting for microphone…') : 'Optional · allow microphone access to speak.';
    frame = requestAnimationFrame(tick);
  }
  function start({automatic = false} = {}) {
    if (model.getState().active) return;
    initial = { collapsed:isBubbleColumnCollapsed, mode:document.body.dataset.workspaceMode, focus:automatic ? null : document.activeElement };
    if (playbackActive) stopPlayback();
    if (initial.mode !== 'explore') SpeechFlowWorkspace.setMode('explore');
    model.start(); tick();
    if (!automatic) $('tutorialNext').focus();
  }
  $('tutorialVoice').onclick = () => {
    if (voiceEnabled) {
      voiceEnabled = false;
      if (ownedMicrophone && microphoneEnabled) $('microphoneToggle').click();
      else applyVoiceSettingsRuntime();
      ownedMicrophone = false;
      return;
    }
    voiceEnabled = true;
    if (!microphoneEnabled) { ownedMicrophone = true; $('microphoneToggle').click(); }
    applyVoiceSettingsRuntime();
  };
  $('tutorialNext').onclick = () => model.next();
  $('tutorialBack').onclick = () => model.previous();
  $('tutorialSkip').onclick = () => model.skip();
  launcher.onclick = () => start();
  document.addEventListener('keydown', event => {
    if (!model.getState().active || !layer.contains(event.target)) return;
    // Tour buttons must not trigger canvas shortcuts or push-to-talk.
    if (event.key === 'Escape') { event.preventDefault(); model.skip(); }
    event.stopPropagation();
  });
  window.SpeechFlowTutorial = {
    start,
    get active() { return model.getState().active; },
    get voiceEnabled() { return voiceEnabled; },
    handleVoice(text) { return model.handleVoice(text); },
    getState: model.getState
  };
  let seen = false;
  try { seen = !!localStorage.getItem(storageKey); } catch { seen = true; }
  if (!seen) start({automatic:true});
})();

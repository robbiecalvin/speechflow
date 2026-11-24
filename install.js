(function () {
  const button = document.getElementById('installSpeechFlow');
  const standalone = window.matchMedia('(display-mode: standalone)');
  if (window.SpeechFlowNative || standalone.matches || navigator.standalone) return;

  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);
  const guide = document.createElement('dialog');
  guide.id = 'installGuide';
  guide.setAttribute('aria-labelledby', 'installGuideTitle');
  guide.innerHTML = `
    <h2 id="installGuideTitle">Install SpeechFlow</h2>
    <p></p>
    <form method="dialog"><button id="closeInstallGuide" class="primary-button" autofocus>Done</button></form>
  `;
  document.body.appendChild(guide);
  const instructions = guide.querySelector('p');

  let installPrompt;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (guide.open) guide.close();
    button.hidden = true;
  });

  function showGuide() {
    if (appleMobile) {
      instructions.textContent = 'Open SpeechFlow in Safari. In the Share menu, choose Add to Home Screen, turn on Open as Web App if shown, then tap Add.';
    } else if (android) {
      instructions.textContent = 'Open SpeechFlow in Chrome. In the browser menu (⋮), choose Add to Home screen or Install app, then follow the prompts.';
    } else {
      instructions.textContent = 'Look for Install SpeechFlow in your browser menu or address bar. On your phone, you can add SpeechFlow to your Home Screen from your browser menu.';
    }
    guide.showModal();
  }

  button.addEventListener('click', async () => {
    if (!installPrompt) {
      showGuide();
      return;
    }

    const prompt = installPrompt;
    installPrompt = null;
    button.disabled = true;
    try {
      const { outcome } = await prompt.prompt();
      if (outcome === 'accepted') button.hidden = true;
    } catch {
      if (!button.hidden) showGuide();
    } finally {
      button.disabled = false;
    }
  });

  button.hidden = false;
})();

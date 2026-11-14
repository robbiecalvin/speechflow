(function initTutorialModule(global) {
  const root = global.SpeechFlowCore || (global.SpeechFlowCore = {});
  const steps = [
    { target: '#captureDock', title: 'Welcome to SpeechFlow', text: 'Turn thoughts into a visual map. This short tour points out the essentials without changing your map. Choose Enable voice to say “next” or “skip”, or use the buttons.' },
    { target: '#quickCapture', title: 'Capture your first thought', text: 'Type an idea and press Enter, or enable the microphone to speak. Try “task plan the launch” or “question what should we try?”. Each thought becomes a bubble.' },
    { target: '#microphoneToggle', title: 'Speak when you’re ready', text: 'Microphone access is always your choice. Allow access when your browser asks. During this tour, say “next” to continue or “skip” to leave the whole tutorial. Other speech won’t change your map.' },
    { target: '#voiceInputMode', title: 'Choose how words are understood', text: 'Smart input handles thoughts and commands. Dictation only keeps your words as text. Commands only avoids creating bubbles from unrecognized commands. Tour controls work in every input mode.' },
    { target: '.mode-switch', title: 'A mode for every moment', text: 'Explore gives you the editing toolkit. Capture clears away distractions. Present lets you walk through your thoughts with the arrow keys. Escape returns from presentation.' },
    { target: '[data-tool="connect"]', title: 'Connect the dots', text: 'Choose Connect or say “connect mode”. Say “connect bubbles 1 and 2” to draw a line, or click two existing bubbles. New bubbles stay blocked until you say “end connected mode” or use its End button.' },
    { target: '.canvas-tools', title: 'Arrange your bigger picture', text: 'Drag bubbles to move them and double-click to edit their text or type. Arrange tidies unlocked thoughts; Fit brings the entire map into view. Zoom with the controls in the bottom corner.' },
    { target: '#bubbleColumn', sidebar: true, title: 'Find a thought quickly', text: 'The list numbers your bubbles for voice commands. Search to find a thought, then click its entry to select it. Say “next bubble” or “select bubble 2” to navigate by voice.' },
    { target: '#commandLauncher', title: 'Keep commands close', text: 'Open Commands or press Ctrl/Cmd+K to search the available actions. You can run them here or say them with the microphone on. Destructive voice commands ask for confirmation.' },
    { target: '#audioControlsBar', sidebar: true, title: 'Listen to your map', text: 'Play reads through your thoughts. Pause, resume, or stop with the controls or voice commands. Voice Settings lets you choose a language, wake phrase, push-to-talk, and playback voice.' },
    { target: '#sidebarHeader', sidebar: true, title: 'Save, share, and keep exploring', text: 'Your maps save on this browser and device. Export JSON for a portable backup and import it to restore a map. Export Image creates a PNG of the full graph. You can restart this tour anytime with the Tour button.' }
  ];
  function createTutorial(options) {
    const opts = options || {};
    let index = -1;
    function snapshot() { return { active: index >= 0, index, total: steps.length, step: steps[index] || null }; }
    function emit(reason) { if (opts.onChange) opts.onChange(snapshot(), reason); }
    function finish(reason) { if (index < 0) return; index = -1; emit(reason); }
    return {
      getState: snapshot,
      start() { index = 0; emit('start'); },
      next() { if (index < 0) return; if (index === steps.length - 1) finish('complete'); else { index++; emit('next'); } },
      previous() { if (index > 0) { index--; emit('previous'); } },
      skip() { finish('skip'); },
      handleVoice(text) {
        if (index < 0) return false;
        const command = String(text || '').trim().toLowerCase().replace(/[.!?,;:]+$/, '').trim();
        if (command === 'next') { this.next(); return true; }
        if (command === 'skip') { this.skip(); return true; }
        return false;
      }
    };
  }
  root.tutorial = { createTutorial };
})(window);

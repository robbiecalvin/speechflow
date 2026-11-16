/* Workspace controls share the existing graph, history, and persistence model. */
(function () {
  const $ = (id) => document.getElementById(id);
  let mode = 'explore';
  let returnFocus = null;
  let toastTimer;
  const shell = document.createElement('div');
  shell.id = 'workspaceShell';
  shell.innerHTML = `
    <header class="workspace-header"><div class="workspace-location"><span class="eyebrow">YOUR WORKSPACE</span><span id="workspaceTitle">Untitled Map</span></div><nav class="mode-switch" aria-label="Workspace mode"><button data-mode="explore" aria-pressed="true">Explore</button><button data-mode="capture" aria-pressed="false">Capture</button><button data-mode="present" aria-pressed="false">Present</button></nav><button id="commandLauncher" class="quiet-button">Commands <kbd>⌘ K</kbd></button></header>
    <section id="welcomeCard" class="welcome-card"><div class="welcome-symbol">✳</div><span class="eyebrow">MAKE ROOM FOR YOUR NEXT IDEA</span><h1>A little thought.<br>A bigger picture.</h1><p>Speak it, type it, connect it.<br>Turn what’s on your mind into something you can see.</p><button id="startIdea" class="primary-button">＋ Capture your first thought</button><div class="starter-options"><span>Or start with a little structure</span><button data-template="plan">Project plan ↗</button><button data-template="decision">Make a decision ↗</button><button data-template="brainstorm">Brainstorm ↗</button></div></section>
    <div class="canvas-tools" role="toolbar" aria-label="Canvas tools"><button data-tool="select" title="Select (V)" aria-label="Select tool">↖</button><button data-tool="pan" title="Pan (H)" aria-label="Pan tool">✥</button><button data-tool="connect" title="Connect (C)" aria-label="Connect tool">⤳</button><span></span><button id="arrangeMap" title="Arrange thoughts" aria-label="Arrange thoughts">⊞</button><button id="fitMap" title="Fit all thoughts" aria-label="Fit map">⛶</button></div>
    <div class="canvas-meta"><span id="mapStats">0 thoughts · 0 connections</span><span class="save-indicator">● Saved on this device</span></div>
    <div class="zoom-controls"><button id="zoomOut" aria-label="Zoom out">−</button><output id="zoomValue">100%</output><button id="zoomIn" aria-label="Zoom in">＋</button></div>
    <section id="captureDock" class="capture-dock" aria-label="Capture a thought"><div class="capture-topline"><span><i></i> A thought is a good place to start</span><select id="voiceInputMode" aria-label="Input interpretation"><option value="smart">Smart input</option><option value="dictation">Dictation only</option><option value="commands">Commands only</option></select></div><form id="captureForm"><button type="button" id="microphoneToggle" aria-label="Start microphone" aria-pressed="false">◉</button><input id="quickCapture" aria-label="Thought or command" placeholder="An idea, a question, a what if…" autocomplete="off" maxlength="2000"><button class="capture-submit" type="submit" aria-label="Capture thought">↑</button></form><div class="capture-footnote"><span id="captureFeedback" role="status">Type a thought, or try “task sketch the first version”</span><span>↵ to capture</span></div></section>
    <div id="presentationControls" class="presentation-controls hidden"><button id="previousThought" aria-label="Previous thought">←</button><span id="presentationPosition">Your story</span><button id="nextThought" aria-label="Next thought">→</button><button id="exitPresentation">Exit presentation <kbd>Esc</kbd></button></div>
    <div id="workspaceToast" role="status" class="workspace-toast hidden"></div>
    <div id="commandsModal" class="modal hidden" aria-hidden="true"><section class="modal-card command-card" role="dialog" aria-modal="true" aria-labelledby="commandsTitle"><div class="command-heading"><div><span class="eyebrow">AT YOUR COMMAND</span><h2 id="commandsTitle">Less clicking. More thinking.</h2></div><button id="closeCommands" aria-label="Close commands">✕</button></div><p>Say a command while listening, or run one here. Numbers follow the thought list.</p><input id="commandSearch" aria-label="Search commands" placeholder="Find a command…" autocomplete="off"><div id="commandResults"></div><footer>Smart input handles thoughts and commands. Dictation keeps every word.</footer></section></div>`;
  document.body.appendChild(shell);
  const icons = {
    select:'M5 3l14 9-7 1-3 7z', pan:'M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4',
    connect:'M4 6h7v12h9M17 15l3 3-3 3', fit:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
    arrange:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    mic:'M9 5a3 3 0 016 0v6a3 3 0 01-6 0zM5 10v1a7 7 0 0014 0v-1M12 18v4M8 22h8',
    add:'M12 5v14M5 12h14', undo:'M9 4L4 9l5 5M4 9h9a7 7 0 017 7', redo:'M15 4l5 5-5 5M20 9h-9a7 7 0 00-7 7',
    lock:'M7 10V7a5 5 0 0110 0v3M5 10h14v11H5z', trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
    export:'M12 3v12M7 10l5 5 5-5M4 15v6h16v-6', import:'M12 15V3M7 8l5-5 5 5M4 15v6h16v-6',
    history:'M3 4v6h6M3 10a9 9 0 119 11M12 7v6l4 2', image:'M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4M15 7h1',
    prompt:'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"></path></svg>`; }
  document.querySelectorAll('[data-tool]').forEach(btn => btn.innerHTML=icon(btn.dataset.tool));
  $('fitMap').innerHTML=icon('fit'); $('arrangeMap').innerHTML=icon('arrange'); $('microphoneToggle').innerHTML=icon('mic');
  const sidebarIcons={newMapBtn:'add',mapHistoryBtn:'history',exportMapIconBtn:'export',importMapIconBtn:'import',addBubbleBtn:'add',quickConnect:'connect',lockToggle:'lock',deleteBubble:'trash',clearMap:'trash',generateFromPrompt:'prompt',undoBtn:'undo',redoBtn:'redo',snapCenter:'fit',exportImageBtn:'image'};
  Object.entries(sidebarIcons).forEach(([id,name])=>{const el=$(id)?.querySelector('.btn-icon');if(el)el.innerHTML=icon(name);});
  document.querySelectorAll('#sidebar button').forEach(btn=>{if(!btn.hasAttribute('aria-label'))btn.setAttribute('aria-label',btn.querySelector('.btn-label')?.textContent || btn.title || 'Toggle sidebar');});

  // Keep the full editing toolkit available without overwhelming the canvas.
  document.querySelectorAll('#controlPanel details').forEach((el, i) => { el.open = i < 2; });
  const search = document.createElement('input');
  search.id = 'thoughtSearch'; search.placeholder = 'Search thoughts…'; search.setAttribute('aria-label', 'Search thoughts');
  $('bubbleColumn').insertBefore(search, $('bubbleList'));
  const emptyList = document.createElement('p'); emptyList.className = 'empty-list'; emptyList.textContent = 'Your thoughts will find a home here.';
  $('bubbleColumn').appendChild(emptyList);
  search.addEventListener('input', filterThoughts);
  function filterThoughts() {
    const query = search.value.toLowerCase(); let shown = 0;
    document.querySelectorAll('#bubbleList li').forEach(li => { li.hidden = !li.textContent.toLowerCase().includes(query); if (!li.hidden) shown++; });
    emptyList.classList.toggle('hidden', shown > 0);
    emptyList.style.display = shown > 0 ? 'none' : 'block';
    emptyList.textContent = bubbles.length ? 'No matching thoughts.' : 'Your thoughts will find a home here.';
  }
  new MutationObserver(filterThoughts).observe($('bubbleList'), {childList:true});
  function notify(message, status = 'info') {
    window.SpeechFlowWorkbench?.showOutcome(message,status);
    $('captureFeedback').textContent = message;
    $('workspaceToast').textContent = message; $('workspaceToast').classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('workspaceToast').classList.add('hidden'), 3500);
  }
  function fit() {
    requestCanvasRender();
    isAutoPanning = false;
    if (!bubbles.length) { notify('Capture a thought to begin your map.'); return; }
    const left = Math.min(...bubbles.map(b => b.x)); const top = Math.min(...bubbles.map(b => b.y));
    const right = Math.max(...bubbles.map(b => b.x + (b.width || 180)));
    const bottom = Math.max(...bubbles.map(b => b.y + (b.height || 90)));
    const usableHeight = window.innerHeight - (mode === 'present' ? 220 : 340);
    zoom = Math.max(MIN_ZOOM, Math.min(1, (getWorkspaceWidth()-120)/(right-left), Math.max(120,usableHeight)/(bottom-top)));
    camX = left - (getWorkspaceWidth()/zoom - (right-left))/2;
    camY = top - (Math.max(120,usableHeight)/zoom - (bottom-top))/2 - 110/zoom;
  }
  function arrange() {
    if (!bubbles.length) return notify('Capture a thought to arrange your map.');
    const movable = bubbles.filter(b => !b.locked);
    if (!movable.length) return notify('Unlock a thought before arranging.');
    const columns = Math.max(1, Math.ceil(Math.sqrt(movable.length)));
    const cellWidth = Math.max(240, ...bubbles.map(b => b.width + 60));
    const cellHeight = Math.max(160, ...bubbles.map(b => b.height + 60));
    const originX = Math.min(...bubbles.map(b => b.x));
    const originY = Math.min(...bubbles.map(b => b.y));
    let slot = 0;
    movable.forEach(b => {
      let x, y;
      do {
        x = originX + slot % columns * cellWidth; y = originY + Math.floor(slot / columns) * cellHeight; slot++;
      } while (bubbles.some(other => other.locked && x < other.x+other.width+20 && x+b.width+20 > other.x && y < other.y+other.height+20 && y+b.height+20 > other.y));
      b.x = x; b.y = y;
    });
    saveSnapshot(); fit(); notify('Thoughts arranged. Locked thoughts stay in place.');
  }
  function exportImage() {
    if (!bubbles.length) return notify('Capture a thought before exporting.');
    const padding = 64;
    const left = Math.min(...bubbles.map(b => b.x))-padding;
    const top = Math.min(...bubbles.map(b => b.y))-padding;
    const width = Math.max(...bubbles.map(b => b.x+b.width))-left+padding;
    const height = Math.max(...bubbles.map(b => b.y+b.height))-top+padding;
    const scale = Math.min(2,4096/width,4096/height);
    const image = document.createElement('canvas'); image.width=Math.ceil(width*scale); image.height=Math.ceil(height*scale);
    const context = image.getContext('2d'); context.scale(scale,scale); context.fillStyle='#f5f6ef'; context.fillRect(0,0,width,height);
    context.translate(-left,-top);
    connections.forEach(edge => {
      const x1=edge.from.x+edge.from.width/2, y1=edge.from.y+edge.from.height/2;
      const x2=edge.to.x+edge.to.width/2, y2=edge.to.y+edge.to.height/2;
      const dx=x2-x1,dy=y2-y1;
      const ratio=Math.min(Math.abs((edge.to.width/2+3)/(dx||.001)),Math.abs((edge.to.height/2+3)/(dy||.001)));
      const endX=x2-dx*ratio,endY=y2-dy*ratio;
      context.strokeStyle='#9bac94';context.fillStyle='#9bac94';context.lineWidth=2;context.beginPath();context.moveTo(x1,y1);context.lineTo(endX,endY);context.stroke();
      const angle=Math.atan2(dy,dx);context.beginPath();context.moveTo(endX,endY);context.lineTo(endX-10*Math.cos(angle-.4),endY-10*Math.sin(angle-.4));context.lineTo(endX-10*Math.cos(angle+.4),endY-10*Math.sin(angle+.4));context.closePath();context.fill();
      if(edge.label){context.fillStyle='#52674a';context.font='12px sans-serif';context.textAlign='center';context.fillText(edge.label,(x1+x2)/2,(y1+y2)/2-10);}
    });
    bubbles.forEach(b => {
      const style=getComputedStyle(b.el);context.fillStyle=style.backgroundColor;context.strokeStyle=style.borderColor;context.lineWidth=1.5;context.beginPath();
      if(b.shape==='ellipse')context.ellipse(b.x+b.width/2,b.y+b.height/2,b.width/2,b.height/2,0,0,Math.PI*2);
      else if(b.shape==='diamond'){context.moveTo(b.x+b.width/2,b.y);context.lineTo(b.x+b.width,b.y+b.height/2);context.lineTo(b.x+b.width/2,b.y+b.height);context.lineTo(b.x,b.y+b.height/2);context.closePath();}
      else context.roundRect(b.x,b.y,b.width,b.height,b.shape==='rect'?4:16);
      context.fill();context.stroke();context.save();context.clip();context.fillStyle=style.color;context.textAlign='center';context.font='13px sans-serif';
      const words=getBubbleDisplayText(b).split(/\s+/);const lines=[];let line='';
      words.forEach(word=>{const next=line?line+' '+word:word;if(context.measureText(next).width>b.width-30&&line){lines.push(line);line=word;}else line=next;});lines.push(line);
      lines.forEach((text,i)=>context.fillText(text,b.x+b.width/2,b.y+b.height/2+(i-(lines.length-1)/2)*18+5,b.width-24));context.restore();
    });
    const link=document.createElement('a');link.download=(mapName.replace(/[^a-z0-9_-]+/gi,'-')||'speechflow')+'.png';link.href=image.toDataURL('image/png');link.click();notify('Exported your complete map as a PNG.');
  }
  function changeZoom(direction) {
    requestCanvasRender();
    const center = getWorkspaceCenterWorld();
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (direction > 0 ? 1.2 : 1/1.2)));
    camX = center.x - getWorkspaceWidth()/2/zoom;
    camY = center.y - window.innerHeight/2/zoom;
  }
  function setMode(next) {
    if (!['explore','capture','present'].includes(next)) return;
    mode = next; document.body.dataset.workspaceMode = mode;
    document.dispatchEvent(new CustomEvent('speechflow:mode',{detail:mode}));
    document.querySelectorAll('[data-mode]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode)));
    $('presentationControls').classList.toggle('hidden', mode !== 'present');
    if (mode === 'present') { setActiveTool('select'); fit(); window.SpeechFlowWorkbench?.presentationStart(); }
    else { if (bubbles.length) fit(); if (mode === 'capture') $('quickCapture').focus(); }
    notify(mode === 'present' ? 'Use ← and → to walk through your thoughts. Escape to return.' : mode === 'capture' ? 'Capture mode · keep your thoughts flowing.' : 'Explore mode · select, connect, and arrange.');
  }
  function navigate(direction) {
    if (window.SpeechFlowWorkbench?.navigate(direction)) return;
    if (!bubbles.length) return notify('Your map is empty. Capture a thought first.');
    const index = bubbles.indexOf(activeBubble);
    const target = index < 0 ? (direction > 0 ? 0 : bubbles.length-1) : (index + direction + bubbles.length) % bubbles.length;
    selectBubbleByIndex(target); $('presentationPosition').textContent = `${target+1} / ${bubbles.length} · ${getBubbleDisplayText(bubbles[target]).slice(0,45)}`;
  }
  function connect(from, to) {
    if (!bubbles[from] || !bubbles[to]) return {status:'error',message:'Choose two existing thought numbers.'};
    if (from === to) return {status:'error',message:'Choose two different thoughts to connect.'};
    if (connections.some(c => c.from === bubbles[from] && c.to === bubbles[to])) return {status:'info',message:'These thoughts are already connected.'};
    addConnection(bubbles[from], bubbles[to]); saveSnapshot(); return {status:'success',message:`Connected thought ${from+1} to ${to+1}.`};
  }
  function submit(raw, options = {}) {
    const text = String(raw || '').trim(); if (!text) return false;
    if (window.SpeechFlowTutorial?.handleVoice(text)) return true;
    const feedback = window.SpeechFlowWorkbench;
    feedback?.heard(options.heard || text, options.source || 'typed');
    try {
    const parsed = voiceParserModule.parseVoiceInput(text);
    if(parsed.mode==='ignore'){notify('Say a thought or command to begin.','info');return false;}
    const connectControl = ['set_connect_mode_on', 'set_connect_mode_off', 'toggle_connect_mode'].includes(parsed.intent);
    const connectionCommand = isConnectMode && ['connect_bubbles','undo','redo'].includes(parsed.intent);
    const createsBubble = parsed.mode === 'dictation' || parsed.intent === 'add_bubble' || /^set_(question|task|note|blocker|idea)_intent$/.test(parsed.intent);
    if (!connectControl && !connectionCommand && isConnectMode && (createsBubble || voiceInputMode === 'dictation')) {
      blockCreationInConnectMode();feedback?.showOutcome('End connected mode before creating new thoughts.','error');return false;
    }
    if (!connectControl && !connectionCommand && voiceInputMode === 'commands' && parsed.mode !== 'command') {
      notify('Command not recognized. Open Commands to find a phrase.','error');return false;
    }
    if (document.body.dataset.workspaceMode === 'present' && (parsed.mode==='dictation' || voiceInputMode==='dictation' || ['add_bubble','rename_bubble','change_bubble_type','clear_map','delete_selected_bubble','connect_bubbles','arrange_map','set_layout','undo','redo','label_connection','set_start'].includes(parsed.intent))) {
      notify('Return to Explore mode before editing your map.','error');return false;
    }
    const beforeCount=bubbles.length;
    const version=feedback?.notificationVersion;
    let result;
    if (!connectControl && !connectionCommand && voiceInputMode === 'dictation') {lastSpokenIntent='idea';result=createBubbleFromVoiceTranscript(text);}
    else {lastSpokenIntent='idea';result=voiceRouter.route(text);}
    if (result?.status) {notify(result.message,result.status);return result.status==='success';}
    if (bubbles.length>beforeCount) {
      if(!window.SpeechFlowWorkbench?.hasInspectorDraft)makeBubbleActive(bubbles.at(-1));
      notify(storageFailures.size?'Thought captured, but not saved. Download a backup now.':'Thought captured. Keep going.',storageFailures.size?'error':'success');
    } else if(version===feedback?.notificationVersion) notify('Command completed.','success');
    return true;
    } finally { feedback?.finishInput(); }
  }
  $('captureForm').addEventListener('submit', e => { e.preventDefault(); if (submit($('quickCapture').value)) $('quickCapture').value = ''; });
  $('voiceInputMode').addEventListener('change', e => { voiceInputMode = e.target.value; notify(`${e.target.selectedOptions[0].text} enabled.`); });
  $('microphoneToggle').addEventListener('click', () => {
    if (!voiceRecognitionController || !SpeechRecognitionCtor) return notify('Speech recognition needs a supported Chromium browser. You can still type below.');
    microphoneEnabled = !microphoneEnabled;
    if (microphoneEnabled) { applyVoiceSettingsRuntime(); notify(voiceSettings.pushToTalkEnabled ? 'Microphone enabled. Hold Space to speak.' : 'Microphone enabled. Allow microphone access when prompted.'); }
    else { voiceRecognitionController.stopListening(); notify('Microphone off.'); updateVoiceModeHint(); }
    $('microphoneToggle').setAttribute('aria-pressed', String(microphoneEnabled));
    $('microphoneToggle').setAttribute('aria-label', microphoneEnabled ? 'Stop microphone' : 'Start microphone');
  });
  function closeCommands() { $('commandsModal').classList.add('hidden'); $('commandsModal').setAttribute('aria-hidden','true'); returnFocus?.focus(); }
  function renderCommands() {
    const query = $('commandSearch').value.toLowerCase(); const results = $('commandResults'); results.replaceChildren();
    const entries = voiceParserModule.getCommandReference().filter(e => e.phrases.join(' ').includes(query));
    entries.forEach(entry => {
      const button = document.createElement('button'); button.type='button';
      const title = document.createElement('strong'); title.textContent = entry.phrases[0];
      const hint = document.createElement('span'); hint.textContent = entry.phrases.slice(1).join(' · ') || 'Run command ↵';
      button.append(title,hint); button.addEventListener('click', () => { closeCommands(); submit(entry.phrases[0].replace('<text>', 'your next thought')); }); results.appendChild(button);
    });
    if (!entries.length) results.textContent = 'No commands found. Try “zoom”, “bubble”, or “mode”.';
  }
  function openCommands() { returnFocus = document.activeElement; $('commandsModal').classList.remove('hidden'); $('commandsModal').setAttribute('aria-hidden','false'); $('commandSearch').value=''; renderCommands(); $('commandSearch').focus(); }
  $('commandSearch').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#commandResults button')?.click(); } });
  $('commandLauncher').onclick = openCommands; $('closeCommands').onclick = closeCommands; $('commandSearch').oninput = renderCommands;
  $('commandsModal').addEventListener('click', e => { if (e.target === $('commandsModal')) closeCommands(); });
  $('startIdea').onclick = () => $('quickCapture').focus();
  $('arrangeMap').onclick = arrange;
  $('fitMap').onclick = fit; $('zoomIn').onclick = () => changeZoom(1); $('zoomOut').onclick = () => changeZoom(-1);
  $('previousThought').onclick = () => navigate(-1); $('nextThought').onclick = () => navigate(1); $('exitPresentation').onclick = () => setMode('explore');
  document.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => setMode(btn.dataset.mode));
  document.querySelectorAll('[data-tool]').forEach(btn => btn.onclick = () => setActiveTool(btn.dataset.tool));
  const templates = {
    plan: [['What are we building?', 'idea'], ['Define the outcome', 'task'], ['Make the first version', 'task'], ['What could get in the way?', 'blocker']],
    decision: [['What should we choose?', 'question'], ['Option A', 'idea'], ['Option B', 'idea'], ['What matters most?', 'note']],
    brainstorm: [['The big idea', 'idea'], ['What if we tried…', 'idea'], ['A different perspective', 'question'], ['The next small step', 'task']]
  };
  document.querySelectorAll('[data-template]').forEach(btn => btn.onclick = () => {
    if (blockCreationInConnectMode() || bubbles.length) return;
    const center = getWorkspaceCenterWorld();
    const nodes = templates[btn.dataset.template].map(([text,type],i) => createBubble(text, center.x-200+(i%2)*270, center.y-170+Math.floor(i/2)*190,type));
    nodes.slice(1).forEach(node => addConnection(nodes[0], node)); updateSidebar(); saveSnapshot(); fit(); notify('A starting point, ready to make your own.');
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!$('commandsModal').classList.contains('hidden')) { closeCommands(); return; }
      const more = document.getElementById('moreModal');
      if (more && !more.classList.contains('hidden')) window.SpeechFlowUI?.closeMore();
      else if (isAnyModalOpen()) return;
      openCommands(); return;
    }
    if (!$('commandsModal').classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); closeCommands(); }
      if (e.key === 'Tab') {
        const items = [...$('commandsModal').querySelectorAll('button,input')]; const first=items[0],last=items[items.length-1];
        if (e.shiftKey && document.activeElement===first) {e.preventDefault();last.focus();} else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();}
      }
      return;
    }
    if (isEditableTarget(e.target) || isAnyModalOpen()) return;
    if (mode === 'present' && ['ArrowLeft','ArrowRight','Escape'].includes(e.key)) {
      e.preventDefault(); e.stopImmediatePropagation(); if (e.key==='Escape') setMode('explore'); else navigate(e.key==='ArrowRight'?1:-1);
    } else if (mode === 'present') { e.stopImmediatePropagation(); }
  }, true);
  let resizeTimer;

  if (bubbles.length) fit();
  const connectBanner = document.createElement('div');
  connectBanner.id = 'connectModeBanner';
  connectBanner.className = 'connect-mode-banner hidden';
  connectBanner.setAttribute('role', 'status');
  connectBanner.innerHTML = '<span><strong>Connect mode</strong> · “connect bubbles 1 and 2”<small>Creation paused until you say “end connected mode”.</small></span><button type="button" id="cancelLink">Cancel link</button><button type="button" id="endConnect">End connect mode</button>';
  $('captureDock').prepend(connectBanner);
  $('endConnect').onclick = () => setConnectModeFromVoice(false);
  $('cancelLink').onclick = () => {cancelPendingLink();notify('Link cancelled. Connect mode remains active.');};
  const sourceStatus = document.createElement('span');sourceStatus.id='connectionSource';connectBanner.prepend(sourceStatus);
  function syncSource(){sourceStatus.textContent=selectedBubble?`Connecting from: ${getBubbleDisplayText(selectedBubble)} → choose destination`:'Tap a source, then a destination.';$('cancelLink').disabled=!selectedBubble;}
  document.addEventListener('speechflow:connection',syncSource);syncSource();
  let lastState = '';
  setInterval(() => {
    const state = `${bubbles.length}|${connections.length}|${mapName}|${zoom}|${activeTool}|${isConnectMode}`;
    if (state !== lastState) {
      connectBanner.classList.toggle('hidden', !isConnectMode);
      $('quickCapture').placeholder = isConnectMode ? 'Connect bubbles 1 and 2…' : 'An idea, a question, a what if…';
      $('voiceInputMode').disabled = isConnectMode;
      ['addBubbleBtn','generateFromPrompt','duplicateSelectionBtn','pasteSelectionBtn','frameSelectionBtn'].forEach(id => { if ($(id)) $(id).disabled = isConnectMode; });
      $('workspaceTitle').textContent = mapName; $('zoomValue').textContent = `${Math.round(zoom*100)}%`;
      $('mapStats').textContent = `${bubbles.length} thought${bubbles.length===1?'':'s'} · ${connections.length} connection${connections.length===1?'':'s'}`;
      $('welcomeCard').classList.toggle('hidden', bubbles.length > 0);
      document.querySelectorAll('[data-tool]').forEach(btn => btn.setAttribute('aria-pressed',String(btn.dataset.tool===activeTool)));
      lastState = state;
    }
    window.SpeechFlowUI?.refreshActions();
    $('microphoneToggle').classList.toggle('listening', microphoneEnabled && lastKnownVoiceState==='listening');
  }, 200);
  document.body.dataset.workspaceMode = mode;
  window.SpeechFlowWorkspace = { submit, fit, arrange, exportImage, notify, zoom:changeZoom, setMode, navigate, connect, openCommands };
})();

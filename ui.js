/* Presentation layer: retain the existing graph and command handlers while simplifying their homes. */
(function () {
  const $ = id => document.getElementById(id);
  const mobile = matchMedia('(max-width: 900px)');
  const shell = $('workspaceShell');
  let mobileInspectorOpen = false;
  let lastWidth = getWorkspaceWidth();
  let lastMode = document.body.dataset.workspaceMode;
  let lastViewport = innerWidth;
  let returnFocus;
  let lastFocusedElement=document.activeElement;
  document.addEventListener('focusin',event=>{lastFocusedElement=event.target;});
  const layer = document.createElement('div');
  layer.id = 'uiLayer';
  layer.innerHTML = `
    <button id="sidebarBackdrop" class="ui-sidebar-backdrop hidden" aria-label="Close thought list" tabindex="-1"></button>
    <button id="inspectorBackdrop" class="ui-inspector-backdrop hidden" aria-label="Close thought details" tabindex="-1"></button>
    <div id="moreModal" class="modal hidden" aria-hidden="true"><section class="modal-card more-card" role="dialog" aria-modal="true" aria-labelledby="moreTitle"><div class="command-heading"><div><span class="eyebrow">EVERYTHING YOU NEED</span><h2 id="moreTitle">Tools & settings</h2></div><button id="closeMore" aria-label="Close tools and settings">✕</button></div><div class="more-shortcuts"><button data-open="commandLauncher">Commands</button><button data-open="backupLauncher">Backups & recovery</button><button data-open="tutorialLauncher">Guided tour</button></div><section id="moreLayoutRoot"></section><section class="more-files"><h3>Map files</h3><div id="moreFiles" class="more-file-buttons"></div></section><section id="moreEditing"></section><section id="morePlayback"><h3>Voice & playback</h3></section></section></div>
    <nav id="mobileNavigation" aria-label="Mobile workspace"><button id="mobileCapture"><span aria-hidden="true">＋</span><span>Capture</span></button><button id="mobileConnect" data-tool="connect" aria-pressed="false"><span aria-hidden="true">⤳</span><span id="mobileConnectLabel">Connect</span></button><button id="mobileSearch"><span aria-hidden="true">⌕</span><span>Search</span></button><button id="mobileMore"><span aria-hidden="true">···</span><span>More</span></button></nav>
    <div id="toolTooltip" role="tooltip" class="tool-tooltip hidden"></div>`;
  shell.appendChild(layer);
  const inspector = $('thoughtInspector');
  shell.appendChild(inspector);
  inspector.setAttribute('aria-label', 'Thought details');
  $('moreEditing').appendChild($('controlPanel'));
  $('moreFiles').append($('exportMapIconBtn'), $('importMapIconBtn'));
  $('exportMapIconBtn').innerHTML = 'Download JSON';
  $('importMapIconBtn').innerHTML = 'Import JSON';
  $('morePlayback').appendChild($('audioControlsBar'));
  $('sidebarColumns').prepend($('addBubbleBtn'));
  $('addBubbleBtn').classList.add('primary-button');
  $('addBubbleBtn').querySelector('.btn-label').textContent = 'Add thought';
  const footer = document.createElement('div');
  footer.className = 'ui-sidebar-footer';
  footer.innerHTML = '<button id="moreTools" class="ui-more-trigger">More tools & settings <span aria-hidden="true">↗</span></button><span>A little thought. A bigger picture.</span>';
  $('sidebar').appendChild(footer);
  $('bubbleColumn').querySelector('h3').textContent = 'Your thoughts';
  $('thoughtSearch').placeholder = 'Search your thoughts…';
  const layout = document.createElement('div');layout.id='layoutControls';layout.className='layout-controls';
  const label = document.createElement('label');label.htmlFor='layoutPicker';label.textContent='Layout';
  layout.append(label,$('layoutPicker'),$('arrangeMap'));
  shell.appendChild(layout);
  $('arrangeMap').innerHTML='<span aria-hidden="true">⊞</span> Arrange';
  // One activity area replaces overlapping toasts, transcript cards, and result cards.
  const activity = document.createElement('details');activity.id='activityHistory';
  activity.innerHTML='<summary id="activitySummary">Recent activity</summary><ol id="activityEntries"></ol>';
  const receipt = $('commandReceipt');
  $('captureDock').append(receipt,activity);
  if(!receipt.dataset.active)$('receiptOutcome').textContent='Speak or type a thought to begin.';
  $('captureFeedback').setAttribute('aria-hidden','true');
  $('voiceTranscriptPanel').setAttribute('aria-hidden','true');
  $('voiceErrorMessage').setAttribute('aria-hidden','true');
  const voiceInfo = document.createElement('div');voiceInfo.className='activity-voice-info';
  voiceInfo.append($('voiceModeHint'));
  activity.appendChild(voiceInfo);
  const voiceSettings = document.createElement('button');voiceSettings.type='button';voiceSettings.textContent='Voice settings';
  voiceSettings.onclick=()=>$('voiceSettingsBtn').click();activity.appendChild(voiceSettings);
  const history = [];
  let historyKey = '';
  new MutationObserver(() => {
    const heard = $('receiptHeard').textContent, outcome = $('receiptOutcome').textContent;
    const status = receipt.dataset.status || 'info';
    if(status==='pending' || !receipt.dataset.active)return;
    const key = `${heard}|${outcome}|${status}`;
    if(key===historyKey)return;historyKey=key;
    history.unshift({heard,outcome,status});history.splice(12);
    $('activitySummary').textContent=`Recent activity · ${history.length}`;
    $('activityEntries').replaceChildren();
    history.forEach(item=>{const li=document.createElement('li');li.dataset.status=item.status;const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=item.heard;span.textContent=item.outcome;li.append(strong,span);$('activityEntries').appendChild(li);});
  }).observe(receipt,{subtree:true,childList:true,attributes:true,attributeFilter:['data-status']});
  function closeList(){isBubbleColumnCollapsed=true;updateBubbleColumnLayout();sync();}
  function openList(){mobileInspectorOpen=false;if(document.body.dataset.workspaceMode!=='explore')SpeechFlowWorkspace.setMode('explore');isBubbleColumnCollapsed=false;updateBubbleColumnLayout();sync();$('thoughtSearch').focus();}
  function openInspector(){
    if(!activeBubble && !selectedEdge)return;
    if(document.body.dataset.workspaceMode!=='explore')SpeechFlowWorkspace.setMode('explore');
    SpeechFlowWorkbench.refreshInspector();
    if(mobile.matches){mobileInspectorOpen=true;closeList();}
    sync();$('closeInspector').focus({preventScroll:true});
  }
  function closeInspector(){mobileInspectorOpen=false;$('closeInspector').click();sync();}
  const originalCloseInspector=$('closeInspector').onclick;
  $('closeInspector').onclick=()=>{const target=activeBubble?.el;mobileInspectorOpen=false;originalCloseInspector();sync();(mobile.matches?$('mobileCapture'):target||document.querySelector('.canvas-tools [data-tool=select]'))?.focus({preventScroll:true});};
  $('inspectSelected').onclick=openInspector;
  $('sidebarBackdrop').onclick=closeList;
  $('inspectorBackdrop').onclick=closeInspector;
  function openMore(){
    returnFocus=document.activeElement;hideTooltip();
    $('moreModal').classList.remove('hidden');$('moreModal').setAttribute('aria-hidden','false');$('closeMore').focus();
  }
  function closeMore(){
    $('moreModal').classList.add('hidden');$('moreModal').setAttribute('aria-hidden','true');
    const rect=returnFocus?.getBoundingClientRect();
    const visible=returnFocus?.isConnected&&!returnFocus.closest('[inert]')&&rect?.width>0&&rect?.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight;
    (visible?returnFocus:mobile.matches?$('mobileMore'):$('moreTools')).focus({preventScroll:true});
  }
  $('moreTools').onclick=openMore;$('mobileMore').onclick=openMore;$('closeMore').onclick=closeMore;
  $('moreModal').addEventListener('click',event=>{if(event.target===$('moreModal'))closeMore();});
  $('moreModal').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button || ['closeMore','audioPlayStopToggle','audioPauseResumeToggle','audioSingleToggle'].includes(button.id))return;
    closeMore();
  },true);
  document.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>$(button.dataset.open).click());
  $('mobileCapture').onclick=()=>{closeList();mobileInspectorOpen=false;SpeechFlowWorkspace.setMode('capture');sync();$('quickCapture').focus();};
  $('mobileConnect').onclick=()=>{closeList();mobileInspectorOpen=false;SpeechFlowWorkspace.setMode('explore');setConnectModeFromVoice(!isConnectMode);sync();};
  $('mobileSearch').onclick=openList;
  const mobileIcons={mobileCapture:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',mobileConnect:'<path d="M4 6h7v12h9M17 15l3 3-3 3"/>',mobileSearch:'<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',mobileMore:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'};
  for(const [id,paths] of Object.entries(mobileIcons))$(id).firstElementChild.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const toolLabels = {select:'Select · V — click a thought to inspect it',pan:'Pan · H — drag the canvas to move around',connect:'Connect · C — connect existing thoughts; end connect mode to create again'};
  for(const button of document.querySelectorAll('.canvas-tools [data-tool]'))button.dataset.tooltip=toolLabels[button.dataset.tool];
  $('fitMap').dataset.tooltip='Fit map — bring every thought into view';
  $('arrangeMap').dataset.tooltip='Arrange — apply the selected layout; supports undo';
  $('microphoneToggle').dataset.tooltip='Microphone — enable listening when you’re ready';
  $('zoomIn').dataset.tooltip='Zoom in';$('zoomOut').dataset.tooltip='Zoom out';
  document.querySelectorAll('[data-tooltip]').forEach(button=>button.removeAttribute('title'));
  let tooltipTarget;
  function hideTooltip(){
    if(tooltipTarget){const ids=(tooltipTarget.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!=='toolTooltip');if(ids.length)tooltipTarget.setAttribute('aria-describedby',ids.join(' '));else tooltipTarget.removeAttribute('aria-describedby');}
    tooltipTarget=null;$('toolTooltip').classList.add('hidden');
  }
  function showTooltip(target){
    hideTooltip();if(!target.dataset.tooltip)return;
    tooltipTarget=target;const tooltip=$('toolTooltip');tooltip.textContent=target.dataset.tooltip;tooltip.classList.remove('hidden');
    target.setAttribute('aria-describedby',`${target.getAttribute('aria-describedby')||''} toolTooltip`.trim());
    const rect=target.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
    tooltip.style.left=`${Math.max(8,Math.min(innerWidth-box.width-8,rect.left+rect.width/2-box.width/2))}px`;
    tooltip.style.top=`${rect.bottom+box.height+15<innerHeight?rect.bottom+10:Math.max(8,rect.top-box.height-10)}px`;
  }
  document.addEventListener('pointerover',event=>{const target=event.target.closest('[data-tooltip]');if(target&&event.pointerType!=='touch')showTooltip(target);});
  document.addEventListener('pointerout',event=>{if(tooltipTarget&&!tooltipTarget.contains(event.relatedTarget))hideTooltip();});
  document.addEventListener('focusin',event=>{if(event.target.dataset.tooltip)showTooltip(event.target);});
  document.addEventListener('focusout',event=>{if(event.target===tooltipTarget)hideTooltip();});
  document.addEventListener('click',event=>{
    const thought=event.target.closest('.bubble'),entry=event.target.closest('#bubbleList li');
    if(mobile.matches&&(thought||entry)&&!isConnectMode&&document.body.dataset.workspaceMode!=='present')queueMicrotask(openInspector);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')hideTooltip();
    if(!$('moreModal').classList.contains('hidden')){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeMore();return;}
      if(event.key==='Tab'){
        const items=[...$('moreModal').querySelectorAll('button,input,select,summary')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=items[0],last=items.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
      return;
    }
    if(event.key==='Escape'&&mobile.matches&&mobileInspectorOpen){event.preventDefault();event.stopImmediatePropagation();closeInspector();return;}
    if(event.key==='Escape'&&mobile.matches&&!isBubbleColumnCollapsed){event.preventDefault();event.stopImmediatePropagation();closeList();return;}
    const node=event.target.closest('.bubble');
    if(event.key==='Enter'&&node&&document.body.dataset.workspaceMode!=='present'&&!isConnectMode){event.preventDefault();event.stopImmediatePropagation();const thought=bubbles.find(b=>b.el===node);if(thought){makeBubbleActive(thought);openInspector();}}
  },true);
  function decorateThoughts(){
    bubbles.forEach((node,index)=>{
      let badge=node.el.querySelector('.bubble-type-badge');
      if(!badge){badge=document.createElement('span');badge.className='bubble-type-badge';badge.setAttribute('aria-hidden','true');node.el.appendChild(badge);}
      const type=`${bubbleTypeLabels[node.type]||node.type}${node.locked?' · Locked':''}`;
      if(badge.textContent!==type)badge.textContent=type;
      const name=`Thought ${index+1}, ${node.type}: ${getBubbleDisplayText(node)}`;
      if(node.el.getAttribute('aria-label')!==name)node.el.setAttribute('aria-label',name);
      node.el.setAttribute('role','group');node.el.tabIndex=0;
    });
  }
  const progress=document.createElement('div');progress.id='storyProgress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Presentation progress');progress.innerHTML='<span></span>';
  $('presentationControls').prepend(progress);
  const storyStep=document.createElement('span');storyStep.id='storyStep';storyStep.className='eyebrow';$('storyCaption').prepend(storyStep);
  function updateStory(){const state=SpeechFlowWorkbench.getPresentationState();progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(state.total||1));progress.setAttribute('aria-valuenow',String(state.total?state.position+1:0));progress.setAttribute('aria-valuetext',state.total?`${state.position+1} of ${state.total} thoughts`:'No thoughts to present');progress.firstChild.style.width=`${state.total?(state.position+1)/state.total*100:0}%`;storyStep.textContent=state.total?`THOUGHT ${state.position+1} OF ${state.total}`:'YOUR NEXT STORY';}
  document.addEventListener('speechflow:slide',updateStory);
  function refreshActions(){
    const selection=getSelectionNodes(),hasThought=!!activeBubble;
    const rules={quickConnect:hasThought&&bubbles.length>1,lockToggle:hasThought,deleteBubble:hasThought,copySelectionBtn:selection.length>0,cutSelectionBtn:selection.length>0,duplicateSelectionBtn:selection.length>0,groupSelectionBtn:selection.length>1,ungroupSelectionBtn:selection.some(n=>n.groupId),frameSelectionBtn:selection.length>0,applyShapeBtn:selection.length>0,alignLeftBtn:selection.length>1,alignTopBtn:selection.length>1,distributeHorizontalBtn:selection.length>2,distributeVerticalBtn:selection.length>2,pasteSelectionBtn:!!clipboardSnapshot?.nodes?.length,undoBtn:undoStack.length>1,redoBtn:redoStack.length>0};
    for(const [id,enabled] of Object.entries(rules))if($(id))$(id).disabled=!enabled||isConnectMode;
  }
  function sync(){
    const mode=document.body.dataset.workspaceMode;
    if(inspector.classList.contains('hidden'))mobileInspectorOpen=false;
    document.body.dataset.mobileInspector=String(mobileInspectorOpen&&mode==='explore');
    document.body.dataset.sidebarOpen=String(!isBubbleColumnCollapsed);
    $('sidebarBackdrop').classList.toggle('hidden',!mobile.matches||isBubbleColumnCollapsed||mode==='present');
    $('inspectorBackdrop').classList.toggle('hidden',!mobile.matches||!mobileInspectorOpen||inspector.classList.contains('hidden')||mode!=='explore');
    if(mobile.matches&&isBubbleColumnCollapsed&&document.activeElement?.closest('#sidebar'))$('mobileSearch').focus({preventScroll:true});
    const sidebarHidden=mode==='present'||(mobile.matches&&isBubbleColumnCollapsed);
    $('sidebar').inert=sidebarHidden;
    $('sidebar').setAttribute('aria-hidden',String(sidebarHidden));
    const inspectorHidden=mode!=='explore'||inspector.classList.contains('hidden')||(mobile.matches&&!mobileInspectorOpen);
    const focusInInspector=document.activeElement?.closest('#thoughtInspector')||((document.activeElement===document.body||document.activeElement===document.documentElement)&&lastFocusedElement?.closest('#thoughtInspector'));
    if(inspectorHidden&&focusInInspector)(mode==='present'?$('exitPresentation'):mobile.matches?$('mobileCapture'):$('quickCapture')).focus({preventScroll:true});
    inspector.inert=inspectorHidden;
    inspector.setAttribute('role',mobile.matches?'dialog':'complementary');inspector.setAttribute('aria-modal','false');
    const side=getSidebarWidth(),inset=window.SpeechFlowUI?.inspectorInset||0;
    document.documentElement.style.setProperty('--ui-sidebar',`${side}px`);document.documentElement.style.setProperty('--ui-inspector',`${inset}px`);
    const width=getWorkspaceWidth();
    if(mode===lastMode&&lastViewport===innerWidth&&width!==lastWidth)camX+=(lastWidth-width)/2/zoom;
    lastWidth=width;lastMode=mode;lastViewport=innerWidth;
    $('mobileConnectLabel').textContent=isConnectMode?'End connect':'Connect';
    $('mobileConnect').setAttribute('aria-label',isConnectMode?'End connect mode':'Start connect mode');
    $('mobileCapture').setAttribute('aria-pressed',String(mode==='capture'));
    const destination=mobile.matches?$('moreLayoutRoot'):shell;
    if(layout.parentElement!==destination)destination.appendChild(layout);
    refreshActions();updateStory();
  }
  new MutationObserver(sync).observe(inspector,{attributes:true,attributeFilter:['class']});
  new MutationObserver(sync).observe($('sidebar'),{attributes:true,attributeFilter:['class']});
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-workspace-mode']});
  document.addEventListener('speechflow:changed',()=>{decorateThoughts();sync();});
  mobile.addEventListener('change',()=>{mobileInspectorOpen=false;sync();hideTooltip();});
  window.addEventListener('resize',()=>{sync();hideTooltip();});
  new MutationObserver(()=>{decorateThoughts();sync();}).observe($('bubbleList'),{childList:true});
  // The controller refreshes selection and connect status without changing graph data.
  setInterval(()=>{decorateThoughts();sync();},300);
  window.SpeechFlowUI={
    openMore,closeMore,openInspector,refreshActions,
    get inspectorInset(){return !mobile.matches&&!inspector.classList.contains('hidden')&&document.body.dataset.workspaceMode==='explore'?inspector.getBoundingClientRect().width+32:0;},
    tourTarget(selector){const target=document.querySelector(selector);if(target?.getClientRects().length)return target;if(selector==='[data-tool="connect"]'&&mobile.matches)return $('mobileConnect');if(selector==='.canvas-tools'&&mobile.matches)return $('mobileMore');if(selector==='#audioControlsBar')return mobile.matches?$('mobileMore'):$('moreTools');if(['#commandLauncher','#backupLauncher'].includes(selector)&&mobile.matches)return $('mobileMore');return target;}
  };
  updateAudioControlsUI();decorateThoughts();sync();
})();

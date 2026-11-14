/* Higher-level editing, backup, and presentation workflows. No network services required. */
(function () {
  const $ = id => document.getElementById(id);
  const tools = SpeechFlowCore.workbench;
  const backupsKey = 'speechflow.recovery.v1';
  const exportedKey = 'speechflow.exported.v1';
  let notificationVersion = 0;
  let inputActive = false;
  let inspectorSignature = '';
  let inspectorDirty = false;
  let backupTimer;
  let sequence = [];
  let position = 0;
  const ui = document.createElement('div');
  ui.id = 'workbenchShell';
  ui.innerHTML = `
    <section id="commandReceipt" class="command-receipt" aria-label="Input feedback"><span id="receiptHeard">Ready when you are</span><strong id="receiptOutcome" role="status">Your last input and its result will appear here.</strong></section>
    <div id="backupModal" class="modal hidden" aria-hidden="true"><section class="modal-card backup-card" role="dialog" aria-modal="true" aria-labelledby="backupTitle"><div class="command-heading"><div><span class="eyebrow">KEEP YOUR IDEAS SAFE</span><h2 id="backupTitle">Backups & recovery</h2></div><button id="closeBackups" aria-label="Close backups">✕</button></div><p id="backupExplanation">Maps and recovery points are saved in this browser. Download a JSON backup to keep a copy outside this device.</p><p id="backupStatus" role="status"></p><div class="backup-actions"><button id="downloadBackup" class="primary-button">Download this map</button><button id="importBackup">Import a backup</button><button id="saveRecovery">Save recovery point</button></div><h3>Recent recovery points</h3><div id="recoveryList"></div></section></div>`;
  document.body.appendChild(ui);
  const launch = document.createElement('button');launch.id='backupLauncher';launch.className='quiet-button';launch.textContent='Backups';launch.onclick=openBackups;
  document.querySelector('.workspace-header').appendChild(launch);
  const layoutPicker=document.createElement('select');layoutPicker.id='layoutPicker';layoutPicker.setAttribute('aria-label','Map layout');
  for(const [value,label] of [['grid','Grid'],['flowchart','Flowchart'],['mindmap','Mind map'],['timeline','Timeline']]){const option=document.createElement('option');option.value=value;option.textContent=label;layoutPicker.appendChild(option);}
  $('arrangeMap').before(layoutPicker);
  $('arrangeMap').onclick=()=>applyLayout(layoutPicker.value);
  const inspector=document.createElement('section');inspector.id='thoughtInspector';inspector.className='thought-inspector hidden';
  inspector.innerHTML=`<div class="inspector-heading"><span class="eyebrow" id="inspectorHeading">THOUGHT DETAILS</span><button id="closeInspector" aria-label="Close thought inspector">✕</button></div><form id="inspectorForm"><label for="inspectorText">Thought</label><textarea id="inspectorText" rows="3" maxlength="2000" required></textarea><label for="inspectorType">Type</label><select id="inspectorType"><option value="idea">Idea</option><option value="task">Task</option><option value="question">Question</option><option value="blocker">Blocker</option><option value="note">Note</option></select><label for="inspectorNotes">Notes</label><textarea id="inspectorNotes" rows="3" maxlength="10000" placeholder="Context, details, next steps…"></textarea><label class="inspector-check"><input type="checkbox" id="inspectorStart">Start my presentation here</label><button type="submit" class="primary-button">Apply changes</button></form><h4>Connections</h4><div id="inspectorConnections"></div><p id="inspectorHint">Changes support undo.</p>`;
  $('sidebarColumns').prepend(inspector);
  const inspectButton=document.createElement('button');inspectButton.id='inspectSelected';inspectButton.textContent='Inspect selection';inspectButton.className='hidden';inspectButton.onclick=()=>{isBubbleColumnCollapsed=false;updateBubbleColumnLayout();inspector.scrollIntoView({block:'nearest'});};
  document.querySelector('.canvas-meta').appendChild(inspectButton);
  $('closeInspector').onclick=()=>{activeBubble=null;selectedEdge=null;clearMultiSelection();highlightBubble(null);refreshInspector();};
  inspector.addEventListener('input',()=>{inspectorDirty=true;});
  $('inspectorForm').onsubmit=event=>{
    event.preventDefault();
    if(!activeBubble || !bubbles.includes(activeBubble))return;
    if(isConnectMode)return fail('End connected mode before editing thoughts.');
    const text=$('inspectorText').value.trim();if(!text)return fail('A thought needs some text.');
    activeBubble.textEl.textContent=text;activeBubble.notes=$('inspectorNotes').value;
    setBubbleType(activeBubble,$('inspectorType').value);
    if($('inspectorStart').checked)setStartingNode(activeBubble.id);else if(startingNodeId()===activeBubble.id)setStartingNode(null);
    activeBubble.updatedAt=new Date().toISOString();updateSidebar();inspectorDirty=false;saveSnapshot();refreshInspector(true);success('Thought updated.');
  };
  function result(status,message){SpeechFlowWorkspace.notify(message);showOutcome(message,status);return {status,message};}
  function fail(message){return result('error',message);}
  function success(message){return storageFailures.size?result('error',`${message} Browser storage is unavailable; download a backup to keep these changes.`):result('success',message);}
  function showOutcome(message,status='info'){if(status==='error')$('commandReceipt').dataset.active='true';if(!inputActive)$('receiptHeard').textContent='Workspace update';$('receiptOutcome').textContent=message;$('commandReceipt').dataset.status=status;notificationVersion++;}
  function heard(text,source='typed'){inputActive=true;$('commandReceipt').dataset.active='true';$('receiptHeard').textContent=`${source==='voice'?'Heard':'Entered'}: ${text}`;$('receiptOutcome').textContent='Working…';$('commandReceipt').dataset.status='pending';}
  function rename(index,text){
    if(isConnectMode)return fail('End connected mode before editing thoughts.');
    const node=bubbles[index];if(!node)return fail('That thought number does not exist.');
    if(!String(text||'').trim())return fail('A thought needs some text.');
    node.textEl.textContent=text.trim();node.updatedAt=new Date().toISOString();updateSidebar();saveSnapshot();refreshInspector(true);return success(`Renamed thought ${index+1}.`);
  }
  function changeType(index,type){
    if(isConnectMode)return fail('End connected mode before editing thoughts.');
    const node=bubbles[index];if(!node)return fail('That thought number does not exist.');
    if(!ALLOWED_BUBBLE_TYPES.includes(type))return fail('Choose idea, task, question, blocker, or note.');
    setBubbleType(node,type);updateSidebar();saveSnapshot();refreshInspector(true);return success(`Thought ${index+1} is now a ${type}.`);
  }
  function labelConnection(from,to,label){
    const edge=connections.find(e=>e.from===bubbles[from]&&e.to===bubbles[to]);
    if(!edge)return fail('That directed connection does not exist. Connect the thoughts first.');
    edge.label=String(label||'').trim().slice(0,200);saveSnapshot();refreshInspector();return success(`Connection ${from+1} → ${to+1} updated.`);
  }
  function startingNodeId(){return bubbles.find(n=>n.metadata?.presentationStart)?.id || null;}
  function setStartingNode(id){bubbles.forEach(n=>{n.metadata={...n.metadata};delete n.metadata.presentationStart;if(n.id===id)n.metadata.presentationStart=true;});}
  function setStart(index){if(!bubbles[index])return fail('Choose an existing thought as the starting point.');setStartingNode(bubbles[index].id);saveSnapshot();refreshInspector(true);return success(`Presentation starts at thought ${index+1}.`);}
  function applyLayout(layout){
    if(!['grid','flowchart','mindmap','timeline'].includes(layout))return fail('Choose a supported layout.');
    if(isConnectMode)return fail('End connected mode before arranging your map.');
    if(!bubbles.length)return fail('Capture a thought before choosing a layout.');
    if(bubbles.every(n=>n.locked))return fail('Unlock a thought before arranging.');
    const positions=tools.layout(bubbles,connections,layout,startingNodeId());
    positions.forEach(p=>{const n=bubbles.find(n=>n.id===p.id);n.x=p.x;n.y=p.y;});
    connections.forEach(e=>{delete e.metadata?.bendX;delete e.metadata?.bendY;});
    layoutPicker.value=layout;saveSnapshot();SpeechFlowWorkspace.fit();return success(`${layoutPicker.selectedOptions[0].text} layout applied. Locked thoughts stayed in place.`);
  }
  function refreshInspector(force=false){
    const edge=connections.includes(selectedEdge)?selectedEdge:null;
    const node=!edge&&bubbles.includes(activeBubble)?activeBubble:null;
    const related=edge?[edge]:node?connections.filter(e=>e.from===node||e.to===node):[];
    const key=JSON.stringify([node?.id,node&&getBubbleDisplayText(node),node?.type,node?.notes,node?.metadata?.presentationStart,related.map(e=>[e.id,e.label]),isConnectMode]);
    if(!force && key===inspectorSignature)return;
    if(!force && inspectorDirty && inspector.dataset.node===node?.id)return;
    inspectorSignature=key;inspectorDirty=false;inspector.dataset.node=node?.id||'';
    inspector.classList.toggle('hidden',!node&&!related.length);
    inspectButton.classList.toggle('hidden',!node||!isBubbleColumnCollapsed);
    $('inspectorForm').classList.toggle('hidden',!node);
    if(edge)$('inspectorHeading').textContent=`CONNECTION ${bubbles.indexOf(edge.from)+1} → ${bubbles.indexOf(edge.to)+1}`;
    if(node){$('inspectorHeading').textContent=`THOUGHT ${bubbles.indexOf(node)+1}`;$('inspectorText').value=getBubbleDisplayText(node);$('inspectorType').value=node.type;$('inspectorNotes').value=node.notes||'';$('inspectorStart').checked=startingNodeId()===node.id;}
    for(const field of inspector.querySelectorAll('#inspectorForm input,#inspectorForm textarea,#inspectorForm select,#inspectorForm button'))field.disabled=isConnectMode;
    $('inspectorHint').textContent=isConnectMode?'End connected mode to edit thoughts. Connection labels remain editable.':'Changes support undo.';
    const list=$('inspectorConnections');list.replaceChildren();
    for(const edge of related){
      const form=document.createElement('form');form.className='connection-editor';const label=document.createElement('label');const id=`edgeLabel-${edge.id}`;
      label.htmlFor=id;label.textContent=`${bubbles.indexOf(edge.from)+1} → ${bubbles.indexOf(edge.to)+1}`;
      const input=document.createElement('input');input.id=id;input.value=edge.label;input.maxLength=200;input.placeholder='Name this connection';input.setAttribute('aria-label',`Label connection ${label.textContent}`);
      const button=document.createElement('button');button.textContent='Save label';button.type='submit';
      form.append(label,input,button);form.onsubmit=e=>{e.preventDefault();labelConnection(bubbles.indexOf(edge.from),bubbles.indexOf(edge.to),input.value);};list.appendChild(form);
    }
    if(!related.length)list.textContent='No connections yet. Use Connect to link this thought.';
  }
  function readBackups(){try{const parsed=JSON.parse(localStorage.getItem(backupsKey)||'[]');return Array.isArray(parsed)?parsed.filter(point=>{try{return !!point.id && typeof point.snapshot==='string' && !!tools.validateBackup(point.snapshot);}catch{return false;}}):[];}catch{return [];}}
  function checkpoint(manual=false){
    if(!activeMapId||!bubbles.length){if(manual)result('info','Capture a thought before saving a recovery point.');return;}
    const snapshot=getStateSnapshot();const all=readBackups();
    const comparable=s=>{const raw=JSON.parse(s);raw.bubbles.forEach(n=>delete n.updatedAt);return JSON.stringify(raw);};
    const latest=all.find(p=>p.mapId===activeMapId);
    if(!manual&&latest&&comparable(latest.snapshot)===comparable(snapshot))return;
    const point={id:`recovery_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,mapId:activeMapId,mapName,savedAt:Date.now(),snapshot};
    const points=[point,...all].slice(0,24);
    try{localStorage.setItem(backupsKey,JSON.stringify(points));if(manual)success('Recovery point saved in this browser.');}catch{fail('Recovery could not be saved. Download a JSON backup now.');}
  }
  function downloadBackup(){
    const blob=new Blob([getStateSnapshot()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`${mapName.replace(/[^a-z0-9_-]+/gi,'-')||'speechflow'}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    try{const exported=JSON.parse(localStorage.getItem(exportedKey)||'{}');exported[activeMapId]=Date.now();localStorage.setItem(exportedKey,JSON.stringify(exported));}catch{}
    success('Backup download started. Keep the JSON file somewhere safe.');renderBackupStatus();
  }
  function renderBackupStatus(){
    let exported={};try{exported=JSON.parse(localStorage.getItem(exportedKey)||'{}');}catch{}
    const date=exported[activeMapId];
    const stale=!!date && (mapDatabase.find(m=>m.id===activeMapId)?.updatedAt||0)>date;
    $('backupStatus').textContent=storageFailures.size?'Browser storage is full or unavailable. Download your current map now.':date?`Last backup download: ${new Date(date).toLocaleString()}.${stale?' Your map has changed since then. Download a fresh copy.':''}`:'No downloaded backup recorded for this map. Download one to keep an independent copy.';
    const indicator=document.querySelector('.save-indicator');
    indicator.textContent=storageFailures.size?'● Not saved — download a backup':date&&!stale?'● Saved here · backup downloaded':stale?'● Saved here · backup out of date':'● Saved here · backup recommended';
    indicator.classList.toggle('needs-backup',!date||stale||storageFailures.size>0);
  }
  let backupReturnFocus;
  function openBackups(){backupReturnFocus=document.activeElement;$('backupModal').classList.remove('hidden');$('backupModal').setAttribute('aria-hidden','false');renderBackups();$('closeBackups').focus();}
  function closeBackups(){$('backupModal').classList.add('hidden');$('backupModal').setAttribute('aria-hidden','true');backupReturnFocus?.focus();}
  function renderBackups(){
    renderBackupStatus();const list=$('recoveryList');list.replaceChildren();
    for(const point of readBackups()){
      const row=document.createElement('div');row.className='recovery-item';const text=document.createElement('span');text.textContent=`${point.mapName} · ${new Date(point.savedAt).toLocaleString()}`;
      const restore=document.createElement('button');restore.textContent='Restore a copy';restore.onclick=()=>{
        if(isConnectMode)return fail('End connected mode before restoring a map.');
        if(!confirm('Restore this recovery point as a new map? Your current map will be kept.'))return;
        try{const raw=tools.validateBackup(point.snapshot);checkpoint();const parsed=persistenceModule.parseSnapshot(raw);parsed.mapId=generateMapId();parsed.mapName=`${parsed.mapName} (recovered)`;restoreStateFromSnapshot(parsed);undoStack=[];redoStack=[];saveSnapshot();closeBackups();SpeechFlowWorkspace.fit();success('Recovery point restored as a new map.');}catch{fail('This recovery point could not be read. Choose another or import a backup.');}
      };row.append(text,restore);list.appendChild(row);
    }
    if(!list.children.length)list.textContent='Recovery points appear after you edit a map. They stay on this device; downloaded backups are independent copies.';
  }
  $('closeBackups').onclick=closeBackups;$('backupModal').onclick=e=>{if(e.target===$('backupModal'))closeBackups();};
  $('downloadBackup').onclick=downloadBackup;$('importBackup').onclick=()=>{$('importMap').click();};$('saveRecovery').onclick=()=>{checkpoint(true);renderBackups();};
  // The original export control uses this shared implementation too (see script.js).
  document.querySelector('.save-indicator').addEventListener('click',openBackups);
  document.querySelector('.save-indicator').setAttribute('role','button');document.querySelector('.save-indicator').tabIndex=0;
  document.querySelector('.save-indicator').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openBackups();}});
  function presentationStart(){
    sequence=tools.storyOrder(bubbles,connections,startingNodeId());position=0;
    if(sequence.length)showSlide();else {$('storyTitle').textContent='Your story starts with a thought';$('storyNotes').textContent='Return to Explore to build your map.';SpeechFlowWorkspace.notify('Your map is empty. Capture a thought to tell its story.');}
  }
  function showSlide(){
    const node=bubbles.find(n=>n.id===sequence[position]);if(!node)return;
    selectBubbleByIndex(bubbles.indexOf(node));
    zoom=Math.min(1.4,Math.max(.25,(getWorkspaceWidth()-140)/(node.width+80)));
    camX=node.x-(getWorkspaceWidth()/zoom-node.width)/2;camY=node.y-(innerHeight/zoom-node.height)/2;
    $('presentationPosition').textContent=`${position+1} / ${sequence.length} · ${getBubbleDisplayText(node).slice(0,45)}`;
    $('storyTitle').textContent=getBubbleDisplayText(node);$('storyNotes').textContent=node.notes||'Use the arrows to follow the connections in your map.';
  }
  const story=document.createElement('section');story.id='storyCaption';story.innerHTML='<span class="eyebrow">FOLLOW YOUR THINKING</span><h2 id="storyTitle"></h2><p id="storyNotes"></p>';
  $('workspaceShell').appendChild(story);
  function navigate(direction){
    if(document.body.dataset.workspaceMode!=='present')return false;
    if(!sequence.length)return true;
    position=(position+direction+sequence.length)%sequence.length;showSlide();return true;
  }
  document.addEventListener('speechflow:changed',()=>{
    refreshInspector();renderBackupStatus();clearTimeout(backupTimer);backupTimer=setTimeout(()=>checkpoint(),600);
  });
  document.addEventListener('speechflow:storageerror',()=>{renderBackupStatus();});
  document.addEventListener('keydown',event=>{
    if($('backupModal').classList.contains('hidden'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeBackups();}
    if(event.key==='Tab'){
      const focusables=[...$('backupModal').querySelectorAll('button,[tabindex="0"]')];const first=focusables[0],last=focusables.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  },true);
  setInterval(()=>{refreshInspector();inspectButton.classList.toggle('hidden',!activeBubble||!isBubbleColumnCollapsed);},250);
  window.SpeechFlowWorkbench={heard,showOutcome,finishInput(){inputActive=false;},get notificationVersion(){return notificationVersion;},rename,changeType,labelConnection,setStart,applyLayout,downloadBackup,openBackups,checkpoint,presentationStart,navigate,refreshInspector};
  renderBackupStatus();
  if(startupRecoveryMessage){SpeechFlowWorkspace.notify(startupRecoveryMessage,'info');$('commandReceipt').dataset.active='true';$('receiptHeard').textContent='Session recovery';}
})();

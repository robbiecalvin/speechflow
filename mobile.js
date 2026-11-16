/* Delegated gestures: provisional motion is committed once, or rolled back. */
(() => {
  const pointers = new Map();
  let gesture = null;
  let suppressClick = false;
  let lastPointerType = '';
  window.addEventListener('dblclick',e=>{if(onCanvas(e.target)&&(lastPointerType==='touch'||isConnectMode)){e.preventDefault();e.stopImmediatePropagation();}},true);
  const onCanvas = target => target.closest('.bubble, #connections, #clickLayer') || target === document.body;
  const point = e => ({x:e.clientX,y:e.clientY});
  function rollback() {
    if (!gesture) return;
    for (const original of gesture.nodes || []) Object.assign(original.node, {x:original.x,y:original.y,updatedAt:original.updatedAt,dragging:false});
    camX=gesture.camX;camY=gesture.camY;zoom=gesture.zoom;
    clearSnapGuides();
  }
  function pinch() {
    const [a,b]=[...pointers.values()];
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};
  }
  document.addEventListener('pointerdown',e=>{
    if (!onCanvas(e.target) || e.target.closest('.bubble-resize-handle') && e.pointerType==='mouse' || e.button!==0 || playbackActive || document.body.dataset.workspaceMode==='present') return;
    if (e.target.closest('.bubble-connector') && e.pointerType==='mouse') return;
    // Keep legacy mouse marquee and empty-canvas pan, but own every card drag.
    const node=bubbles.find(b=>b.el===e.target.closest('.bubble'));
    if (e.pointerType==='mouse' && !node) return;
    lastPointerType=e.pointerType;
    e.preventDefault();e.stopImmediatePropagation();isAutoPanning=false;
    if(!pointers.size)suppressClick=false;
    pointers.set(e.pointerId,point(e));
    e.target.setPointerCapture?.(e.pointerId);
    if(pointers.size===1){
      const targets=node?(multiSelection.has(node)?[...multiSelection]:node.groupId?bubbles.filter(n=>n.groupId===node.groupId):[node]):[];
      gesture={start:point(e),node,camX,camY,zoom,moved:false,nodes:targets.filter(n=>!n.locked).map(node=>({node,x:node.x,y:node.y,updatedAt:node.updatedAt}))};
    } else if(pointers.size===2){
      rollback();suppressClick=true;
      gesture={camX,camY,zoom,pinch:pinch(),moved:true,nodes:[]};
    }
  },true);
  document.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;
    e.preventDefault();pointers.set(e.pointerId,point(e));
    if(gesture.pinch && pointers.size===2){
      const next=pinch(),start=gesture.pinch;
      zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,gesture.zoom*next.distance/Math.max(1,start.distance)));
      camX=gesture.camX+(start.x-getSidebarWidth())/gesture.zoom-(next.x-getSidebarWidth())/zoom;
      camY=gesture.camY+start.y/gesture.zoom-next.y/zoom;
    } else if(!gesture.pinch){
      const dx=e.clientX-gesture.start.x,dy=e.clientY-gesture.start.y;
      if(Math.hypot(dx,dy)>8)gesture.moved=true;
      if(!gesture.moved)return;
      suppressClick=true;
      if(gesture.node && activeTool!=='pan' && !isConnectMode){
        for(const entry of gesture.nodes){entry.node.x=entry.x+dx/zoom;entry.node.y=entry.y+dy/zoom;entry.node.dragging=true;}
      } else if(!gesture.node || activeTool==='pan'){
        camX=gesture.camX-dx/zoom;camY=gesture.camY-dy/zoom;
      }
    }
  },{capture:true,passive:false});
  function finish(e,cancelled){
    if(!pointers.has(e.pointerId)||!gesture)return;
    e.preventDefault();
    if(cancelled){rollback();suppressClick=true;pointers.clear();gesture=null;return;}
    pointers.delete(e.pointerId);
    if(pointers.size)return;
    const g=gesture;gesture=null;
    g.nodes.forEach(entry=>{entry.node.dragging=false;});
    if(g.moved && !g.pinch && g.nodes.some(entry=>entry.node.x!==entry.x||entry.node.y!==entry.y)){
      g.nodes.forEach(entry=>{entry.node.updatedAt=new Date().toISOString();});saveSnapshot();
    } else if(!g.moved && g.node){
      suppressClick=true;
      if(isConnectMode)chooseConnectionThought(g.node);
      else {selectThought(g.node,e);window.SpeechFlowUI?.openInspector();}
    }
    clearSnapGuides();
  }
  document.addEventListener('pointerup',e=>finish(e,false),true);
  document.addEventListener('pointercancel',e=>finish(e,true),true);
  window.addEventListener('click',e=>{
    if(suppressClick && onCanvas(e.target)){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.addEventListener('resize',()=>{if(gesture){rollback();gesture=null;pointers.clear();suppressClick=true;}});
})();

/* Map and Outline are projections of the same graph, using the same inspector. */
(() => {
  const $=id=>document.getElementById(id);
  const switcher=document.createElement('div');switcher.className='view-switch';switcher.setAttribute('aria-label','Project view');
  switcher.innerHTML='<button id="mapView" aria-pressed="true">Map</button><button id="outlineView" aria-pressed="false">Outline</button>';
  document.querySelector('.canvas-meta').prepend(switcher);
  const panel=document.createElement('section');panel.id='outlinePanel';panel.className='hidden';panel.setAttribute('aria-label','Project outline');
  panel.innerHTML='<h2>Thoughts & relationships</h2><label>Search thoughts<input id="outlineSearch" type="search"></label><div id="outlineList"></div><form id="outlineConnect"><h3>Connect thoughts</h3><label>From<select id="outlineFrom"></select></label><label>To<select id="outlineTo"></select></label><button>Connect</button></form>';
  document.body.appendChild(panel);
  let view='map';
  function setView(next){
    view=next;document.body.dataset.projectView=next;panel.classList.toggle('hidden',next!=='outline');
    $('mapView').setAttribute('aria-pressed',String(next==='map'));$('outlineView').setAttribute('aria-pressed',String(next==='outline'));
    if(next==='outline')render();
  }
  document.addEventListener('speechflow:mode',event=>{if(event.detail==='present'){document.body.dataset.projectView='map';panel.classList.add('hidden');}else setView(view);});
  $('mapView').onclick=()=>setView('map');$('outlineView').onclick=()=>setView('outline');
  function inspect(node){
    if(isConnectMode){chooseConnectionThought(node);return;}
    selectThought(node);
    // The existing inspector retains its draft when the same thought is selected.
    window.SpeechFlowUI.openInspector();
  }
  function render(){
    if(view!=='outline')return;
    const query=$('outlineSearch').value.toLowerCase();
    const list=$('outlineList');list.replaceChildren();
    bubbles.forEach((node,index)=>{
      if(![getBubbleDisplayText(node),node.notes,node.type].join(' ').toLowerCase().includes(query))return;
      const article=document.createElement('article');article.dataset.nodeId=node.id;
      const button=document.createElement('button');button.textContent=`${index+1}. ${getBubbleDisplayText(node)} · ${node.type}${node.metadata?.nextAction?' · Next action':''}`;
      button.onclick=()=>inspect(node);article.appendChild(button);
      if(node.notes){const notes=document.createElement('p');notes.textContent=node.notes;article.appendChild(notes);}
      const relationships=document.createElement('ul');relationships.setAttribute('aria-label',`Relationships for thought ${index+1}`);
      connections.filter(e=>e.from===node||e.to===node).forEach(edge=>{
        const li=document.createElement('li'),edit=document.createElement('button');
        edit.textContent=`From ${bubbles.indexOf(edge.from)+1}: ${getBubbleDisplayText(edge.from)} → To ${bubbles.indexOf(edge.to)+1}: ${getBubbleDisplayText(edge.to)}${edge.label?` — ${edge.label}`:''}. Edit label`;
        edit.onclick=()=>{selectedEdge=edge;activeBubble=null;window.SpeechFlowUI.openInspector();};li.appendChild(edit);relationships.appendChild(li);
      });article.appendChild(relationships);list.appendChild(article);
    });
    for(const id of ['outlineFrom','outlineTo']){const select=$(id),value=select.value;select.replaceChildren();bubbles.forEach((node,i)=>{const option=document.createElement('option');option.value=node.id;option.textContent=`${i+1}. ${getBubbleDisplayText(node)}`;select.appendChild(option);});if(bubbles.some(n=>n.id===value))select.value=value;}
    if(!list.children.length)list.textContent=bubbles.length?'No matching thoughts.':'Capture your first thought below.';
  }
  $('outlineSearch').oninput=render;
  $('outlineConnect').onsubmit=e=>{e.preventDefault();const result=SpeechFlowWorkspace.connect(bubbles.findIndex(n=>n.id===$('outlineFrom').value),bubbles.findIndex(n=>n.id===$('outlineTo').value));SpeechFlowWorkspace.notify(result.message,result.status);};
  document.addEventListener('speechflow:changed',render);
  const next=document.createElement('button');next.id='chooseNextAction';next.type='button';next.textContent='Choose as next action';
  $('inspectorForm').after(next);next.onclick=()=>{if(!activeBubble||isConnectMode)return;for(const node of bubbles){node.metadata={...node.metadata};delete node.metadata.nextAction;}activeBubble.metadata.nextAction=true;saveSnapshot();SpeechFlowWorkspace.notify('Next action chosen. Find it in Outline.');};
  // Project actions preserve the current graph; duplication assigns new project identity only.
  const projects=document.createElement('div');projects.id='projectsModal';projects.className='modal hidden';projects.setAttribute('aria-hidden','true');
  projects.innerHTML='<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="projectsTitle"><h2 id="projectsTitle">Your project</h2><button id="closeProjects">Close</button><form id="renameProject"><label>Project name<input id="projectName" maxlength="100" required></label><button>Rename</button></form><button id="duplicateProject">Duplicate project</button><button id="recentProjects">Recent projects</button><p>Maps are stored in this browser. Speech recognition may send audio to your browser’s speech provider. Download backups to keep an independent copy.</p></section>';
  document.body.appendChild(projects);
  $('workspaceTitle').tabIndex=0;$('workspaceTitle').setAttribute('role','button');$('workspaceTitle').setAttribute('aria-label','Project name and recent projects');
  function open(){if(isAnyModalOpen())return;$('projectName').value=mapName;projects.classList.remove('hidden');projects.setAttribute('aria-hidden','false');$('projectName').focus();}
  function close(){projects.classList.add('hidden');projects.setAttribute('aria-hidden','true');$('workspaceTitle').focus();}
  $('workspaceTitle').onclick=open;$('workspaceTitle').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
  $('closeProjects').onclick=close;
  $('renameProject').onsubmit=e=>{e.preventDefault();if(blockCreationInConnectMode())return;setMapName($('projectName').value.trim()||'Untitled Map');saveSnapshot();close();};
  $('duplicateProject').onclick=()=>{if(blockCreationInConnectMode())return;const snapshot=persistenceModule.parseSnapshot(getStateSnapshot());snapshot.mapId=generateMapId();snapshot.mapName=`${mapName} (copy)`;restoreStateFromSnapshot(snapshot);undoStack=[];redoStack=[];saveSnapshot();close();};
  $('recentProjects').onclick=()=>{close();openMapHistoryModal();};
  projects.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=[...projects.querySelectorAll('button,input')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  const correction=document.createElement('div');correction.className='capture-correction';correction.innerHTML='<button id="correctLast">Correct last thought</button><button id="undoCapture">Undo</button><button id="captureDone">Done typing</button><button id="showLastOnMap">Show last on map</button>';
  $('captureDock').appendChild(correction);
  $('correctLast').onclick=()=>{if(bubbles.length){inspect(bubbles.at(-1));setTimeout(()=>$('inspectorText').focus(),300);}};
  $('undoCapture').onclick=()=>undo();$('captureDone').onclick=()=>{document.activeElement.blur();};
  $('showLastOnMap').onclick=()=>{setView('map');selectBubbleByIndex(bubbles.length-1);};
  function viewport(){const vv=window.visualViewport;$('captureDock').style.setProperty('--keyboard-offset',`${vv?Math.max(0,innerHeight-vv.height-vv.offsetTop):0}px`);}
  window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);viewport();
})();

// Coalesce rendering after state/geometry changes, with no idle drawing loop.
for(const event of ['pointermove','pointerup','wheel','resize','click','keydown','speechflow:changed'])window.addEventListener(event,requestCanvasRender,{passive:true});
new MutationObserver(requestCanvasRender).observe(document.body,{subtree:true,attributes:true,childList:true,attributeFilter:['class','hidden','data-mobile-inspector']});

(() => {
 const state=document.querySelector('.capture-topline > span');state.id='microphoneState';state.setAttribute('role','status');
 const retry=document.createElement('button');retry.type='button';retry.id='retryMicrophone';retry.textContent='Retry microphone';retry.className='hidden';document.getElementById('microphoneToggle').after(retry);
 function sync(){
  const labels={idle:'Microphone off',requesting_permission:'Waiting for permission',listening:'Listening',processing:'Processing',speaking:'Playing thoughts',paused:'Playback paused',error:'Speech interrupted · retry available'};
  const error=voiceStateMachine.getState().lastError;
  state.textContent=!SpeechRecognitionCtor?'Speech unsupported · typing available':!microphoneEnabled?'Microphone off':error?.code==='permission_denied'?'Permission denied · typing available':labels[lastKnownVoiceState]||'Microphone off';
  retry.classList.toggle('hidden',!SpeechRecognitionCtor||!microphoneEnabled||lastKnownVoiceState!=='error');
 }
 retry.onclick=()=>{voiceRecognitionController.stopListening();voiceRecognitionController.startListening();};
 document.addEventListener('speechflow:voice',sync);sync();
})();

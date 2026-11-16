const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>browser?.close());
async function open(t,viewport={width:1440,height:1000},deviceScaleFactor=1){
 const p=await browser.newPage({viewport,hasTouch:true,deviceScaleFactor});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 await p.addInitScript(()=>{
  localStorage.setItem('speechflow.tutorial.v1','skip');
  window.SpeechRecognition=class{constructor(){window.testRecognition=this;}start(){this.onstart?.();}stop(){this.onend?.();}};
  window.spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>spoken.push(u),cancel(){},pause(){},resume(){},getVoices:()=>[]}});
  window.canvasDraws=0;const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){canvasDraws++;return clear.apply(this,args);};
  window.documentListeners=0;const add=document.addEventListener.bind(document);document.addEventListener=(...args)=>{documentListeners++;return add(...args);};
 });
 await p.goto(process.env.SPEECHFLOW_URL||'http://127.0.0.1:8080');return p;
}
async function enter(p,text){await p.locator('#quickCapture').fill(text);await p.locator('#captureForm').evaluate(f=>f.requestSubmit());}
test('Outline shares cyclic, cross-linked, disconnected graph, edits, drafts, and connections',async t=>{
 const p=await open(t);
 for(const text of ['Alpha','Beta','Gamma','Disconnected'])await enter(p,text);
 await p.evaluate(()=>{for(const [a,b] of [[0,1],[1,0],[0,2],[1,2]])SpeechFlowWorkspace.connect(a,b);});
 await p.waitForTimeout(300);await p.locator('#inspectorNotes').fill('An unsaved draft');
 const graph=await p.evaluate(()=>JSON.stringify([bubbles.map(n=>[n.id,n.notes,n.type]),connections.map(e=>[e.id,e.from.id,e.to.id,e.label])]));
 await p.locator('#outlineView').click();assert.equal(await p.locator('#outlineList article').count(),4);
 const outlineBox=await p.locator('#outlinePanel').boundingBox(),sidebarBox=await p.locator('#sidebar').boundingBox();assert.ok(outlineBox.x>=sidebarBox.x+sidebarBox.width,'outline remains clear of the sidebar');
 assert.match(await p.locator('#outlineList').textContent(),/From 2: Beta → To 1: Alpha/);
 await p.locator('#mapView').click();assert.equal(await p.locator('#inspectorNotes').inputValue(),'An unsaved draft');
 assert.equal(await p.evaluate(()=>JSON.stringify([bubbles.map(n=>[n.id,n.notes,n.type]),connections.map(e=>[e.id,e.from.id,e.to.id,e.label])])),graph);
 await p.locator('#outlineView').click();await p.locator('#inspectorForm button').click();
 const ids=await p.evaluate(()=>bubbles.map(n=>n.id));await p.locator('#outlineFrom').selectOption(ids[2]);await p.locator('#outlineTo').selectOption(ids[3]);await p.locator('#outlineConnect button').click();
 assert.equal(await p.evaluate(()=>connections.length),5);
 await p.locator('#outlineSearch').fill('Disconnected');assert.equal(await p.locator('#outlineList article').count(),1);
 await p.locator('#outlineList article > button').click();await p.locator('#inspectorText').fill('A next step');await p.locator('#inspectorType').selectOption('task');await p.locator('#inspectorForm button').click();await p.locator('#chooseNextAction').click();
 assert.equal(await p.evaluate(()=>bubbles[3].metadata.nextAction),true);
 await p.locator('#outlineSearch').fill('');assert.match(await p.locator('#outlineList').textContent(),/A next step · task · Next action/);
});
test('capture leaves camera, focus, and unsaved drafts steady; project rename and duplicate preserve graph',async t=>{
 const p=await open(t);await enter(p,'First');await p.waitForTimeout(300);await p.locator('#inspectorNotes').fill('Keep this draft');
 await p.locator('#quickCapture').focus();const camera=await p.evaluate(()=>[camX,camY,zoom]);
 await enter(p,'Second');await enter(p,'Third');assert.deepEqual(await p.evaluate(()=>[camX,camY,zoom]),camera);assert.equal(await p.evaluate(()=>document.activeElement.id),'quickCapture');assert.equal(await p.locator('#inspectorNotes').inputValue(),'Keep this draft');
 await p.locator('#workspaceTitle').click();await p.locator('#projectName').fill('Launch plan');await p.locator('#renameProject button').click();
 assert.equal(await p.evaluate(()=>mapName),'Launch plan');assert.equal(await p.evaluate(()=>bubbles.length),3);
 const original=await p.evaluate(()=>({id:activeMapId,nodes:bubbles.map(n=>n.id)}));
 await p.locator('#workspaceTitle').click();await p.locator('#duplicateProject').click();assert.notEqual(await p.evaluate(()=>activeMapId),original.id);assert.deepEqual(await p.evaluate(()=>bubbles.map(n=>n.id)),original.nodes);
});
test('recognition batches finals once and closes a voice-opened panel through recognition',async t=>{
 const p=await open(t);await p.locator('#microphoneToggle').click();
 await p.evaluate(()=>{const result=text=>Object.assign([{transcript:text,confidence:1}],{isFinal:true});const event={resultIndex:0,results:[result('Alpha'),result('Beta')]};testRecognition.onresult(event);testRecognition.onresult(event);});
 assert.equal(await p.evaluate(()=>bubbles.length),2);
 const say=text=>p.evaluate(text=>testRecognition.onresult({results:[[{transcript:text,confidence:1}]]}),text);
 await say('voice settings');assert.equal(await p.locator('#voiceSettingsModal').isVisible(),true);
 await say('Unexpected thought');assert.equal(await p.evaluate(()=>bubbles.length),2);
 await say('close voice settings');assert.equal(await p.locator('#voiceSettingsModal').isVisible(),false);
 await say('commands');assert.equal(await p.locator('#commandsModal').isVisible(),true);await say('close commands');assert.equal(await p.locator('#commandsModal').isVisible(),false);
});
test('playback waits for utterances, handles pause completion, and ignores old session callbacks',async t=>{
 const p=await open(t);await enter(p,'Long thought');await enter(p,'Next thought');
 await p.locator('#microphoneToggle').click();await p.evaluate(()=>{window.prePlaybackRecognition=testRecognition;startPlayback();});assert.equal(await p.evaluate(()=>playbackIndex),1);
 await p.waitForTimeout(3200);assert.equal(await p.evaluate(()=>playbackIndex),1,'no fixed three-second advance');
 await p.evaluate(()=>{pausePlayback();spoken[0].onend();});assert.equal(await p.evaluate(()=>playbackIndex),1);
 await p.evaluate(()=>resumePlayback());assert.equal(await p.evaluate(()=>playbackIndex),2);
 await p.evaluate(()=>{window.old=spoken[1];stopPlayback();startPlayback();old.onend();});await p.waitForTimeout(50);assert.equal(await p.evaluate(()=>playbackIndex),1);
 await p.evaluate(()=>{spoken.at(-1).onend();});await p.waitForTimeout(50);assert.equal(await p.evaluate(()=>playbackIndex),2);
 await p.evaluate(()=>{spoken.at(-1).onerror({error:'synthesis-failed'});});await p.waitForTimeout(50);assert.equal(await p.evaluate(()=>playbackActive),false);assert.equal(await p.locator('.bubble:visible').count(),2);
 await p.evaluate(()=>prePlaybackRecognition.onresult({results:[[{transcript:'Playback echo',confidence:1}]]}));assert.equal(await p.evaluate(()=>bubbles.length),2);
});
test('idle canvas does not draw, restore does not grow document listeners, history is bounded',async t=>{
 const p=await open(t);await enter(p,'Retained thought');await p.waitForTimeout(800);
 const draws=await p.evaluate(()=>canvasDraws);await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>canvasDraws),draws);
 const listeners=await p.evaluate(()=>documentListeners);
 await p.evaluate(()=>{const snapshot=getStateSnapshot();for(let i=0;i<20;i++)restoreStateFromSnapshot(snapshot);});
 assert.equal(await p.evaluate(()=>documentListeners),listeners);
 await p.evaluate(()=>{for(let i=0;i<110;i++){bubbles[0].notes=String(i);saveSnapshot();}});assert.equal(await p.evaluate(()=>undoStack.length),100);
});

test('high-density buffers retain directed-edge hit testing',async t=>{
 const p=await open(t,{width:1440,height:1000},2);
 await p.evaluate(()=>{const a=createBubble('From',100,180),b=createBubble('To',420,440);addConnection(a,b);saveSnapshot();activeBubble=null;SpeechFlowWorkspace.fit();});await p.waitForTimeout(400);
 const target=await p.evaluate(()=>{
  const rect=clickLayer.getBoundingClientRect(),edge=connections[0];
  const fromX=(edge.from.x-camX)*zoom+edge.from.width*zoom/2,fromY=(edge.from.y-camY)*zoom+edge.from.height*zoom/2;
  const toX=(edge.to.x-camX)*zoom+edge.to.width*zoom/2,toY=(edge.to.y-camY)*zoom+edge.to.height*zoom/2;
  const bend=getEdgeBend(edge,fromX,fromY,toX,toY);
  return {x:rect.left+bend.bendX,y:rect.top+(fromY+toY)/2,buffer:canvas.width,css:canvas.getBoundingClientRect().width};
 });
 assert.equal(target.buffer,Math.round(target.css*2));await p.mouse.click(target.x,target.y);assert.equal(await p.evaluate(()=>selectedEdge?.id),await p.evaluate(()=>connections[0].id));
});

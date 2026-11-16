const {click,reveal}=require('./ui-actions.cjs');
const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium} = require('playwright');
let browser;
const base = process.env.SPEECHFLOW_URL || 'http://127.0.0.1:8080';
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();});
async function session(t,{tour=false,width=1440,height=1000,supported=true}={}) {
  const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({tour,supported})=>{
    if(!tour)localStorage.setItem('speechflow.tutorial.v1','skip');
    window.recognitionStarts=0;
    if(supported)window.SpeechRecognition=class {
      constructor(){window.testRecognition=this;}
      start(){window.recognitionStarts++;}
      stop(){this.onend?.();}
    };
    else {window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;}
  },{tour,supported});
  await page.goto(base);
  t.after(async()=>{await page.close();assert.deepEqual(errors,[],'no uncaught JavaScript errors');});
  return page;
}
async function capture(page,text){await page.locator('#quickCapture').fill(text);await page.locator('#captureForm').evaluate(form=>form.requestSubmit());}
async function say(page,text){await page.evaluate(text=>testRecognition.onresult({results:[[{transcript:text,confidence:1}]]}),text);}
async function count(page,n){assert.equal(await page.locator('.bubble').count(),n);}

test('first-visit tutorial, click navigation, skip memory, and replay',async t=>{
  const p=await session(t,{tour:true});
  assert.equal(await p.locator('#tutorialLayer').isVisible(),true);
  assert.equal(await p.evaluate(()=>recognitionStarts),0);
  await p.locator('#tutorialNext').click();assert.equal(await p.evaluate(()=>SpeechFlowTutorial.getState().index),1);
  await p.locator('#tutorialBack').click();assert.equal(await p.evaluate(()=>SpeechFlowTutorial.getState().index),0);
  await p.locator('#tutorialSkip').click();assert.equal(await p.locator('#tutorialLayer').isVisible(),false);
  await p.reload();assert.equal(await p.locator('#tutorialLayer').isVisible(),false);
  await p.locator('#tutorialLauncher').click();assert.equal(await p.locator('#tutorialLayer').isVisible(),true);
  await count(p,0);await p.locator('#tutorialSkip').click();
});

test('spoken next completes the whole tour; skip exits from any step without changing a map',async t=>{
  const p=await session(t);
  await capture(p,'My existing thought');
  const before=await p.evaluate(()=>getStateSnapshot());
  await p.evaluate(()=>{voiceSettings.wakePhraseEnabled=true;voiceSettings.wakePhrase='speechflow';voiceSettings.pushToTalkEnabled=true;voiceSettings.confidenceThreshold=1;voiceInputMode='dictation';});
  await p.locator('#tutorialLauncher').click();await p.locator('#tutorialVoice').click();
  assert.equal(await p.evaluate(()=>microphoneEnabled),true);
  await say(p,'next idea is not a tour command');await count(p,1);
  const total=await p.evaluate(()=>SpeechFlowTutorial.getState().total);
  for(let i=0;i<total;i++) {
    await say(p,'NEXT!');
    if(i<total-1)assert.equal(await p.evaluate(()=>SpeechFlowTutorial.getState().index),i+1);
  }
  assert.equal(await p.evaluate(()=>SpeechFlowTutorial.active),false);
  assert.equal(await p.evaluate(()=>microphoneEnabled),false);
  assert.equal(await p.evaluate(()=>voiceStateMachine.getState().state),'idle');
  assert.equal(await p.evaluate(()=>getStateSnapshot()).then(s=>JSON.parse(s).bubbles[0].text),JSON.parse(before).bubbles[0].text);
  await p.locator('#tutorialLauncher').click();await p.locator('#tutorialVoice').click();await say(p,'next');await say(p,'skip');
  assert.equal(await p.evaluate(()=>SpeechFlowTutorial.active),false);await count(p,1);
});

test('tour preserves an existing microphone session, input preference, connect mode, and sidebar state',async t=>{
  const p=await session(t);
  await p.locator('#microphoneToggle').click();await capture(p,'connect mode');
  const collapsed=await p.evaluate(()=>isBubbleColumnCollapsed);
  await p.locator('#tutorialLauncher').click();await say(p,'next');await say(p,'skip');
  assert.equal(await p.evaluate(()=>microphoneEnabled),true);
  assert.equal(await p.evaluate(()=>isConnectMode),true);
  assert.equal(await p.evaluate(()=>isBubbleColumnCollapsed),collapsed);
  await say(p,'end connected mode');await say(p,'A thought after the tour');await count(p,1);
});

test('mobile tour steps stay on-screen and unsupported browsers retain clickable controls',async t=>{
  const p=await session(t,{tour:true,width:390,height:844,supported:false});
  assert.equal(await p.locator('#tutorialVoice').isDisabled(),true);
  const total=await p.evaluate(()=>SpeechFlowTutorial.getState().total);
  for(let i=0;i<total;i++) {
    const box=await p.locator('#tutorialCard').boundingBox();
    assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=391&&box.y+box.height<=845,`step ${i+1} fits viewport`);
    await p.locator('#tutorialNext').click();
  }
  assert.equal(await p.locator('#tutorialLayer').isVisible(),false);
  assert.equal(await p.evaluate(()=>isBubbleColumnCollapsed),true);
});

test('edit text and type, duplicate, delete with attached edges, undo and redo',async t=>{
  const p=await session(t);await capture(p,'First thought');await capture(p,'Second thought');
  await capture(p,'connect bubbles 1 and 2');
  await p.locator('.bubble').first().dblclick();await p.locator('[data-modal-action=edit]').click();
  await p.locator('#bubbleEditorTextInput').fill('Updated NASA API');await p.locator('#bubbleEditorApply').click();
  assert.equal(await p.locator('.bubble-text').first().textContent(),'Updated NASA API');
  await p.locator('.bubble').first().dblclick();await p.locator('[data-modal-action=type]').click();
  await p.locator('#bubbleEditorTypeSelect').selectOption('task');await p.locator('#bubbleEditorApply').click();
  assert.equal(await p.locator('.bubble').first().getAttribute('class').then(c=>c.includes('shape-rounded')),true);
  await p.locator('.bubble').first().click();await p.keyboard.press('Control+d');await count(p,3);
  await p.keyboard.press('Delete');await count(p,2);
  await p.locator('.bubble').first().click();await p.keyboard.press('Delete');await count(p,1);
  assert.equal(await p.evaluate(()=>connections.length),0);
  await click(p,'#undoBtn');await count(p,2);assert.equal(await p.evaluate(()=>connections.length),1);
  await click(p,'#redoBtn');await count(p,1);
});

test('JSON backup round-trip and invalid imports preserve graph and undo history',async t=>{
  const p=await session(t);await capture(p,'First backup thought');await capture(p,'task Second backup thought');await capture(p,'connect bubbles 1 and 2');
  const pending=p.waitForEvent('download');await click(p,'#exportMapIconBtn');const download=await pending;
  const json=await fs.readFile(await download.path(),'utf8');assert.equal(JSON.parse(json).connections.length,1);
  await p.locator('#importMap').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await p.waitForTimeout(100);await count(p,2);assert.equal(await p.evaluate(()=>connections.length),1);
  const undoLength=await p.evaluate(()=>undoStack.length);const mapId=await p.evaluate(()=>activeMapId);
  let dialogSeen=false;p.once('dialog',async d=>{dialogSeen=true;await d.accept();});
  await p.locator('#importMap').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{bad json')});
  await p.waitForTimeout(100);assert.ok(dialogSeen);await count(p,2);
  assert.equal(await p.evaluate(()=>undoStack.length),undoLength,'invalid import must not corrupt undo');
  assert.equal(await p.evaluate(()=>activeMapId),mapId,'invalid import must not replace map identity');
  p.once('dialog',d=>d.accept());await p.locator('#importMap').setInputFiles({name:'unrelated.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await p.waitForTimeout(100);await count(p,2);
  await p.reload();await count(p,2);
});

test('new maps, history, and undo keep separate map records',async t=>{
  const p=await session(t);await capture(p,'Original map thought');
  await p.locator('#newMapBtn').click();await p.locator('#mapNameInput').fill('Second map');
  await p.locator('#saveBubbleTypes').click();await count(p,0);await capture(p,'Second map thought');
  await p.locator('#mapHistoryBtn').click();await p.locator('.history-item').filter({hasText:'Untitled Map'}).getByRole('button',{name:'Load'}).click();
  assert.equal(await p.locator('.bubble-text').first().textContent(),'Original map thought');
  await p.waitForTimeout(300);assert.equal(await p.locator('#undoBtn').isDisabled(),true);
  assert.equal(await p.evaluate(()=>mapName),'Untitled Map','undo must stay within loaded map');
});

test('dragging and shape changes survive reload without losing edges',async t=>{
  const p=await session(t);await capture(p,'Drag me');await capture(p,'Keep me connected');await capture(p,'connect bubbles 1 and 2');
  const bubble=p.locator('.bubble').first();const box=await bubble.boundingBox();
  const old=await p.evaluate(()=>({x:bubbles[0].x,y:bubbles[0].y}));
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+65,box.y+box.height/2+50,{steps:8});await p.mouse.up();
  assert.notDeepEqual(await p.evaluate(()=>({x:bubbles[0].x,y:bubbles[0].y})),old);
  await bubble.click();await reveal(p,'#applyShapeBtn');await p.locator('summary').filter({hasText:'Arrange & Style'}).click();
  await p.locator('#shapePicker').selectOption('rect');await p.locator('#applyShapeBtn').click();
  await p.reload();assert.equal(await p.locator('.bubble').first().getAttribute('class').then(c=>c.includes('shape-rect')),true);
  assert.equal(await p.evaluate(()=>connections.length),1);
});

test('playback pauses, resumes, and stops without hidden nodes or stale timers',async t=>{
  const p=await session(t);
  // Headless machines have no reliable speech output. Completion is tested with
  // controlled utterance events in planning.test.cjs. Keep this suite deterministic.
  await p.evaluate(()=>Object.defineProperty(window,'speechSynthesis',{value:{speak(){},cancel(){},pause(){},resume(){},getVoices:()=>[]}}));await capture(p,'First spoken idea');await capture(p,'Second spoken idea');
  await click(p,'#audioPlayStopToggle');assert.equal(await p.evaluate(()=>playbackActive),true);
  await click(p,'#audioPauseResumeToggle');assert.equal(await p.evaluate(()=>playbackPaused),true);
  await click(p,'#audioPauseResumeToggle');assert.equal(await p.evaluate(()=>playbackPaused),false);
  await click(p,'#audioPlayStopToggle');assert.equal(await p.evaluate(()=>playbackActive),false);
  assert.equal(await p.locator('.bubble:visible').count(),2);
  assert.equal(await p.evaluate(()=>voiceStateMachine.getState().state),'idle');
});

test('tutorial microphone denial leaves next and skip usable',async t=>{
  const p=await session(t,{tour:true});await p.locator('#tutorialVoice').click();
  await p.evaluate(()=>{testRecognition.onerror({error:'not-allowed'});testRecognition.onend();});
  await p.waitForTimeout(60);
  assert.match(await p.locator('#tutorialVoiceStatus').textContent(),/permission|unavailable/i);
  await p.locator('#tutorialNext').click();assert.equal(await p.evaluate(()=>SpeechFlowTutorial.getState().index),1);
  await p.locator('#tutorialSkip').click();assert.equal(await p.evaluate(()=>microphoneEnabled),false);await count(p,0);
});

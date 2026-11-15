const {click,reveal}=require('./ui-actions.cjs');
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();});
async function pageFor(t,viewport={width:1440,height:1000}){
  const p=await browser.newPage({viewport,acceptDownloads:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{localStorage.setItem('speechflow.tutorial.v1','skip');window.SpeechRecognition=class{constructor(){window.testRecognition=this;}start(){}stop(){this.onend?.();}};});
  await p.goto(process.env.SPEECHFLOW_URL||'http://127.0.0.1:8080');
  t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});return p;
}
async function enter(p,text){await p.locator('#quickCapture').fill(text);await p.locator('#captureForm').evaluate(f=>f.requestSubmit());}
async function say(p,text){await p.evaluate(text=>testRecognition.onresult({results:[[{transcript:text,confidence:1}]]}),text);}
async function download(p,selector){const pending=p.waitForEvent('download');await click(p,selector);const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}

test('voice receipts show heard text, successful corrections, invalid targets, and cancelled actions',async t=>{
  const p=await pageFor(t);await enter(p,'First idea');await enter(p,'Second idea');await p.locator('#microphoneToggle').click();
  await say(p,'rename bubble two to NASA Launch Plan');assert.equal(await p.locator('.bubble-text').nth(1).textContent(),'NASA Launch Plan');
  assert.match(await p.locator('#receiptHeard').textContent(),/^Heard: rename/);assert.equal(await p.locator('#commandReceipt').getAttribute('data-status'),'success');
  await say(p,'change bubble one to a task');assert.equal(await p.evaluate(()=>bubbles[0].type),'task');
  await say(p,'undo that');assert.equal(await p.evaluate(()=>bubbles[0].type),'idea');
  await say(p,'rename bubble 99 to Missing');assert.equal(await p.locator('#commandReceipt').getAttribute('data-status'),'error');assert.match(await p.locator('#receiptOutcome').textContent(),/does not exist/);
  await say(p,'rename bubble two');assert.equal(await p.locator('.bubble').count(),2);assert.match(await p.locator('#receiptOutcome').textContent(),/Try/);
  p.once('dialog',d=>d.dismiss());await say(p,'clear map');assert.equal(await p.locator('#commandReceipt').getAttribute('data-status'),'cancelled');assert.equal(await p.locator('.bubble').count(),2);
});

test('inspector edits text, type, notes, starting point, and connection labels with persistence and undo',async t=>{
  const p=await pageFor(t);await enter(p,'First idea');await enter(p,'Second idea');await enter(p,'connect bubbles 1 and 2');
  await p.waitForTimeout(300);await p.locator('#inspectorText').fill('A clear decision');await p.locator('#inspectorType').selectOption('question');await p.locator('#inspectorNotes').fill('Compare costs and benefits.');await p.locator('#inspectorStart').check();
  await p.locator('#inspectorForm button[type=submit]').click();
  await p.locator('.connection-editor input').fill('Supports');await p.locator('.connection-editor button').click();
  const json=await download(p,'#exportMapIconBtn');assert.equal(json.bubbles[1].notes,'Compare costs and benefits.');assert.equal(json.connections[0].label,'Supports');assert.equal(json.bubbles[1].metadata.presentationStart,true);
  await enter(p,'undo that');assert.equal(await p.evaluate(()=>connections[0].label),'');
  await enter(p,'redo');await p.reload();assert.equal(await p.evaluate(()=>bubbles[1].notes),'Compare costs and benefits.');assert.equal(await p.evaluate(()=>bubbles[1].type),'question');assert.equal(await p.evaluate(()=>connections[0].label),'Supports');
});

test('each new layout works in the browser and can be undone',async t=>{
  const p=await pageFor(t);await enter(p,'A');await enter(p,'B');await enter(p,'C');await enter(p,'connect bubbles 1 and 2');await enter(p,'connect bubbles 2 and 3');
  for(const layout of ['flowchart','mindmap','timeline']){
    const before=await p.evaluate(()=>bubbles.map(n=>[n.x,n.y]));await p.locator('#layoutPicker').selectOption(layout);await p.locator('#arrangeMap').click();
    const after=await p.evaluate(()=>bubbles.map(n=>[n.x,n.y]));assert.notDeepEqual(after,before);assert.equal(await p.evaluate(()=>connections.length),2);
    await enter(p,'undo that');assert.deepEqual(await p.evaluate(()=>bubbles.map(n=>[n.x,n.y])),before);
  }
});

test('recovery restores a copy, preserves current map, and warns when a backup is stale',async t=>{
  const p=await pageFor(t);await enter(p,'A');await enter(p,'B');
  await p.locator('#backupLauncher').click();await p.locator('#saveRecovery').click();
  const json=await download(p,'#downloadBackup');assert.equal(json.bubbles.length,2);await p.locator('#closeBackups').click();
  await enter(p,'C');assert.match(await p.locator('.save-indicator').textContent(),/out of date/);
  const original=await p.evaluate(()=>activeMapId);await p.locator('#backupLauncher').click();
  const index=await p.evaluate(()=>JSON.parse(localStorage.getItem('speechflow.recovery.v1')).findIndex(point=>JSON.parse(point.snapshot).bubbles.length===2));
  assert.ok(index>=0);p.once('dialog',d=>d.accept());await p.locator('.recovery-item').nth(index).getByRole('button').click();
  assert.equal(await p.locator('.bubble').count(),2);assert.notEqual(await p.evaluate(()=>activeMapId),original);
  assert.equal(await p.evaluate(id=>JSON.parse(mapDatabase.find(m=>m.id===id).snapshot).bubbles.length,original),3);
});

test('full browser storage leaves map editable and exposes download fallback',async t=>{
  const p=await pageFor(t);await p.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(['bubbleHistory','mapDatabase'].includes(key))throw new DOMException('Quota full','QuotaExceededError');return original.call(this,key,value);};});
  await enter(p,'Keep this idea');assert.equal(await p.locator('.bubble').count(),1);assert.match(await p.locator('.save-indicator').textContent(),/Not saved/);assert.match(await p.locator('#receiptOutcome').textContent(),/not saved/);
  const json=await download(p,'#exportMapIconBtn');assert.equal(json.bubbles[0].text,'Keep this idea');
});

test('damaged session history recovers a saved map and retains damaged data',async t=>{
  const p=await pageFor(t);await enter(p,'Recover this idea');await p.evaluate(()=>localStorage.setItem('bubbleHistory','{damaged'));await p.reload();
  assert.equal(await p.locator('.bubble-text').first().textContent(),'Recover this idea');assert.equal(await p.evaluate(()=>localStorage.getItem('speechflow.damagedHistory.v1')),'{damaged');assert.match(await p.locator('#receiptOutcome').textContent(),/recovered/i);
});

test('presentation uses the chosen starting point, follows connections, and protects against dictation edits',async t=>{
  const p=await pageFor(t);for(const text of ['A','B','C'])await enter(p,text);
  await enter(p,'connect bubbles 1 and 3');await enter(p,'label connection one to three as Leads to');await enter(p,'start presentation at bubble three');
  await p.locator('[data-mode=present]').click();assert.equal(await p.locator('#storyTitle').textContent(),'C');
  await p.locator('#nextThought').click();assert.equal(await p.locator('#storyTitle').textContent(),'A');await p.keyboard.press('ArrowRight');assert.equal(await p.locator('#storyTitle').textContent(),'B');
  await p.locator('#microphoneToggle').evaluate(button=>button.click());await say(p,'Accidental speech while presenting');assert.equal(await p.locator('.bubble').count(),3);
  await p.keyboard.press('Escape');await p.reload();await p.locator('[data-mode=present]').click();assert.equal(await p.locator('#storyTitle').textContent(),'C');
});

test('mobile inspector and backups remain accessible without header overflow',async t=>{
  const p=await pageFor(t,{width:390,height:844});await enter(p,'A mobile thought');await p.waitForTimeout(300);
  await p.locator('#inspectSelected').click();assert.equal(await p.locator('#inspectorText').isVisible(),true);
  await p.locator('#closeInspector').click();await p.locator('#mobileMore').click();await p.locator('[data-open=backupLauncher]').click();
  const box=await p.locator('.backup-card').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391&&box.y>=0&&box.y+box.height<=845);
  await p.locator('#closeBackups').click();const header=await p.locator('#mobileMore').boundingBox();assert.ok(header.x>=0&&header.x+header.width<=390);
});


test('blocked browser storage still starts the workspace and allows an independent JSON download',async t=>{
  const p=await pageFor(t);
  await p.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('Storage blocked','SecurityError');};Storage.prototype.setItem=function(){throw new DOMException('Storage blocked','SecurityError');};});
  await p.reload();
  // A tour is not auto-opened when storage cannot retain its completion preference.
  await enter(p,'A thought without storage');assert.equal(await p.locator('.bubble').count(),1);
  assert.match(await p.locator('.save-indicator').textContent(),/Not saved/);
  await click(p,'#voiceSettingsBtn');await p.locator('#voiceLanguageInput').fill('en-GB');await p.locator('#voiceSettingsSave').click();assert.equal(await p.evaluate(()=>voiceSettings.language),'en-GB');assert.equal(await p.locator('#voiceSettingsModal').isVisible(),false);
  const json=await download(p,'#exportMapIconBtn');assert.equal(json.bubbles[0].text,'A thought without storage');
});

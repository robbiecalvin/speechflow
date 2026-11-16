const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {click,reveal}=require('./ui-actions.cjs');
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();});
async function open(t,viewport={width:1440,height:1000}){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('speechflow.tutorial.v1','skip'));
  await page.goto(process.env.SPEECHFLOW_URL||'http://127.0.0.1:8080');
  t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});return page;
}
async function enter(p,text){await p.locator('#quickCapture').fill(text);await p.locator('#captureForm').evaluate(f=>f.requestSubmit());}

test('sidebar prioritizes capture and search; More has contextual actions and restores focus',async t=>{
  const p=await open(t);assert.equal(await p.locator('#addBubbleBtn').isVisible(),true);assert.equal(await p.locator('#thoughtSearch').isVisible(),true);
  assert.equal(await p.locator('#lockToggle').isVisible(),false);assert.equal(await p.locator('#voiceSettingsBtn').isVisible(),false);
  await p.locator('#moreTools').click();assert.equal(await p.locator('#lockToggle').isDisabled(),true);assert.equal(await p.locator('#undoBtn').isDisabled(),true);
  await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>!!document.activeElement.closest('#moreModal')),true);await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'closeMore');
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'moreTools');
  await p.locator('#addBubbleBtn').click();assert.equal(await p.locator('.bubble').count(),1);assert.equal(await p.locator('#bubbleList li').count(),1);
  const duplicates=await p.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);});assert.deepEqual(duplicates,[]);
});

test('inspector stays separate, fit respects its width, and unsaved drafts survive responsive reflow',async t=>{
  const p=await open(t);await enter(p,'A thought to inspect');await p.waitForTimeout(350);await p.locator('#inspectorNotes').fill('Unsaved notes stay with this thought.');
  assert.equal(await p.locator('#thoughtInspector').evaluate(el=>!!el.closest('#sidebar')),false);
  await p.locator('#fitMap').click();await p.waitForTimeout(50);
  const panel=await p.locator('#thoughtInspector').boundingBox(),card=await p.locator('.bubble').boundingBox();assert.ok(card.x+card.width<=panel.x);
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(350);assert.equal(await p.locator('#thoughtInspector').isVisible(),false);
  await p.locator('#inspectSelected').click();assert.equal(await p.locator('#inspectorNotes').inputValue(),'Unsaved notes stay with this thought.');
  const sheet=await p.locator('#thoughtInspector').boundingBox(),nav=await p.locator('#mobileNavigation').boundingBox();assert.ok(sheet.y>72&&sheet.y+sheet.height<nav.y);
  await p.locator('#inspectorForm button[type=submit]').click();assert.equal(await p.evaluate(()=>bubbles[0].notes),'Unsaved notes stay with this thought.');
});

test('one activity area shows outcomes and expandable history without overlapping notifications',async t=>{
  const p=await open(t);await enter(p,'A');await enter(p,'rename bubble one to A clearer thought');
  assert.equal(await p.locator('#commandReceipt').evaluate(el=>!!el.closest('#captureDock')),true);
  assert.equal(await p.locator('#workspaceToast').isVisible(),false);assert.equal(await p.locator('#voiceTranscriptPanel').isVisible(),false);
  assert.match(await p.locator('#receiptOutcome').textContent(),/Renamed/);await p.locator('#activitySummary').click();assert.ok(await p.locator('#activityEntries li').count()>=2);
  await enter(p,'rename bubble 99 to Missing');assert.equal(await p.locator('#commandReceipt').getAttribute('data-status'),'error');assert.match(await p.locator('#activityEntries li').first().textContent(),/does not exist/);
});

test('canvas controls have readable layouts, descriptive tooltips, and clear connect state',async t=>{
  const p=await open(t);await enter(p,'A');await enter(p,'B');
  await p.locator('.canvas-tools [data-tool=connect]').hover();assert.equal(await p.locator('#toolTooltip').isVisible(),true);assert.match(await p.locator('#toolTooltip').textContent(),/existing thoughts/);
  await p.locator('.canvas-tools [data-tool=connect]').click();assert.equal(await p.locator('.canvas-tools [data-tool=connect]').getAttribute('aria-pressed'),'true');
  await enter(p,'Do not create this');assert.equal(await p.locator('.bubble').count(),2);
  await p.locator('#endConnect').click();await p.waitForTimeout(250);
  const picker=await p.locator('#layoutPicker').boundingBox();assert.ok(picker.width>=90);
  await p.locator('#layoutPicker').selectOption('flowchart');await p.locator('#arrangeMap').click();assert.equal(await p.evaluate(()=>isConnectMode),false);
});

test('thought cards expose type, number, and keyboard access to details',async t=>{
  const p=await open(t);await enter(p,'task Build a prototype');await enter(p,'question What should we measure?');await p.waitForTimeout(350);
  assert.equal(await p.locator('.bubble-type-badge').first().textContent(),'Task');assert.equal(await p.locator('.bubble-id-label').first().textContent(),'01');
  await p.locator('.bubble').first().focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>activeBubble===bubbles[0]),true);assert.equal(await p.locator('#inspectorType').inputValue(),'task');
});

test('mobile Capture, Connect, Search, and More are reachable and use a bottom-sheet inspector',async t=>{
  const p=await open(t,{width:390,height:844});
  for(const id of ['mobileCapture','mobileConnect','mobileSearch','mobileMore']){const b=await p.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=391&&b.height>=44);}
  await p.locator('#mobileCapture').click();await enter(p,'A');await enter(p,'B');assert.equal(await p.locator('#thoughtInspector').isVisible(),false);
  await p.locator('#mobileConnect').click();await enter(p,'connect bubbles 1 and 2');await enter(p,'Blocked thought');assert.equal(await p.locator('.bubble').count(),2);assert.equal(await p.evaluate(()=>connections.length),1);
  await p.locator('#mobileConnect').click();await p.locator('#mobileSearch').click();await p.locator('#thoughtSearch').fill('A');await p.locator('#bubbleList li:visible').first().click();
  assert.equal(await p.locator('#thoughtInspector').isVisible(),true);await p.locator('#mobileMore').click();assert.equal(await p.locator('#moreModal').isVisible(),true);
  await p.locator('[data-open=backupLauncher]').click();assert.equal(await p.locator('#backupModal').isVisible(),true);assert.equal(await p.locator('#moreModal').isVisible(),false);
});

test('presentation highlights the current thought and provides accurate progress and captions',async t=>{
  const p=await open(t);await enter(p,'A');await enter(p,'B');await enter(p,'connect bubbles 1 and 2');
  await p.waitForTimeout(350);await p.locator('#inspectorNotes').fill('The important supporting detail.');await p.locator('#inspectorForm button').click();await enter(p,'start presentation at bubble 1');
  await p.locator('[data-mode=present]').click();assert.equal(await p.locator('#storyProgress').getAttribute('aria-valuenow'),'1');assert.equal(await p.locator('#storyProgress').getAttribute('aria-valuemax'),'2');
  assert.equal(await p.locator('#thoughtInspector').isVisible(),false);assert.equal(await p.locator('.zoom-controls').isVisible(),false);assert.equal(await p.locator('#commandLauncher').isVisible(),false);
  assert.ok(await p.locator('.bubble:not(.active)').evaluate(el=>Number(getComputedStyle(el).opacity))<.5);
  await p.locator('#nextThought').click();assert.equal(await p.locator('#storyProgress').getAttribute('aria-valuenow'),'2');assert.equal(await p.locator('#storyNotes').textContent(),'The important supporting detail.');
  await p.keyboard.press('Escape');assert.equal(await p.locator('.canvas-tools').isVisible(),true);
});

test('short mobile screens keep capture reachable when the keyboard reduces available space',async t=>{
  const p=await open(t,{width:320,height:568});
  const start=await p.locator('#startIdea').boundingBox(),dock=await p.locator('#captureDock').boundingBox();assert.ok(start.y+start.height<=dock.y);
  await p.locator('#quickCapture').focus();await p.setViewportSize({width:320,height:420});await p.waitForTimeout(100);
  const input=await p.locator('#quickCapture').boundingBox();assert.ok(input.y>=72&&input.y+input.height<=420);assert.equal(await p.locator('#mobileNavigation').isVisible(),false);
  await p.locator('#quickCapture').fill('A thought on a smaller screen');await p.keyboard.press('Enter');assert.equal(await p.locator('.bubble').count(),1);
});

test('command shortcut replaces More, toggles Commands, and does not stack unrelated dialogs',async t=>{
  const p=await open(t);await p.locator('#moreTools').click();await p.keyboard.press('Control+k');
  assert.equal(await p.locator('.modal:not(.hidden)').count(),1);assert.equal(await p.locator('#commandsModal').isVisible(),true);
  await p.keyboard.press('Control+k');assert.equal(await p.locator('.modal:not(.hidden)').count(),0);assert.equal(await p.evaluate(()=>document.activeElement.id),'moreTools');
  await p.locator('#backupLauncher').click();await p.keyboard.press('Control+k');assert.equal(await p.locator('.modal:not(.hidden)').count(),1);assert.equal(await p.locator('#backupModal').isVisible(),true);
});

test('closing More restores a visible trigger after desktop-to-mobile and mobile-to-desktop resizing',async t=>{
  const p=await open(t);await p.locator('#moreTools').click();await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>document.activeElement.id),'mobileMore');
  await p.locator('#mobileMore').click();await p.setViewportSize({width:1440,height:1000});await p.waitForTimeout(250);await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>document.activeElement.id),'moreTools');
});

test('mobile thought drawer is inert when closed and keyboard reachable when open',async t=>{
  const p=await open(t,{width:390,height:844});assert.equal(await p.locator('#sidebar').evaluate(el=>el.inert),true);
  await p.locator('#mobileSearch').click();assert.equal(await p.locator('#sidebar').evaluate(el=>el.inert),false);assert.equal(await p.evaluate(()=>document.activeElement.id),'thoughtSearch');
  await p.keyboard.press('Escape');assert.equal(await p.locator('#sidebar').evaluate(el=>el.inert),true);assert.equal(await p.evaluate(()=>document.activeElement.id),'mobileSearch');
});

test('responsive reflow moves focus out of a hidden inspector without losing a draft',async t=>{
  const p=await open(t);await enter(p,'A thought with a draft');await p.waitForTimeout(350);await p.locator('#inspectorNotes').fill('Keep these notes.');
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>document.activeElement.id),'mobileCapture');
  assert.equal(await p.locator('#thoughtInspector').evaluate(el=>el.inert),true);
  await p.locator('#inspectSelected').click();assert.equal(await p.locator('#thoughtInspector').evaluate(el=>el.inert),false);assert.equal(await p.locator('#inspectorNotes').inputValue(),'Keep these notes.');
});

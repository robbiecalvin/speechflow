const {click,reveal}=require('./ui-actions.cjs');
/* Run with a local server on port 8080 and Playwright installed in your environment. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('speechflow.tutorial.v1','skip');
      window.recognitionStarts=0;
      window.SpeechRecognition=class {
        constructor(){window.testRecognition=this;}
        start(){window.recognitionStarts++;}
        stop(){this.onend?.();}
      };
    });
    await page.goto(process.env.SPEECHFLOW_URL || 'http://127.0.0.1:8080');
    assert.equal(await page.evaluate(()=>recognitionStarts),0,'microphone must be opt-in');
    await page.locator('[data-template=plan]').click();
    assert.equal(await page.locator('.bubble').count(),4);
    assert.equal(await page.evaluate(()=>connections.length),3);
    await click(page,'#undoBtn');assert.equal(await page.locator('.bubble').count(),0);
    await click(page,'#redoBtn');assert.equal(await page.locator('.bubble').count(),4);
    await page.reload();
    assert.deepEqual(await page.evaluate(()=>bubbles.map(b=>b.type)),['idea','task','task','blocker']);
    assert.equal(await page.locator('.bubble.locked').count(),0,'playback order must not lock nodes');
    async function submit(text){await page.locator('#quickCapture').fill(text);await page.locator('#captureForm').evaluate(form=>form.requestSubmit());}
    await page.locator('#microphoneToggle').click();
    assert.equal(await page.evaluate(()=>recognitionStarts),1);
    await page.evaluate(()=>testRecognition.onresult({results:[[{transcript:'task Review NASA API',confidence:1}]]}));
    assert.equal(await page.locator('.bubble').count(),5);
    assert.equal(await page.evaluate(()=>getBubbleDisplayText(bubbles[4])),'Review NASA API');
    await page.evaluate(()=>{
      voiceSettings.wakePhraseEnabled=true;voiceSettings.wakePhrase='flow';
      testRecognition.onresult({results:[[{transcript:'flower task Should not appear',confidence:1}]]});
    });
    assert.equal(await page.locator('.bubble').count(),5,'wake phrase must match a whole word');
    await page.evaluate(()=>testRecognition.onresult({results:[[{transcript:'flow, task Check the boundary',confidence:1}]]}));
    assert.equal(await page.locator('.bubble').count(),6);
    await page.evaluate(()=>{voiceSettings.wakePhraseEnabled=false;undo();});
    await page.locator('#microphoneToggle').click();
    assert.equal(await page.evaluate(()=>voiceStateMachine.getState().state),'idle');
    await page.evaluate(()=>testRecognition.onresult({results:[[{transcript:'task Late result must be ignored',confidence:1}]]}));
    assert.equal(await page.locator('.bubble').count(),5);

    page.once('dialog',dialog=>dialog.dismiss());
    await submit('clear map');assert.equal(await page.locator('.bubble').count(),5,'destructive commands require confirmation');
    await page.locator('#voiceInputMode').selectOption('commands');
    await submit('Not a command');assert.equal(await page.locator('.bubble').count(),5);
    await page.locator('#voiceInputMode').selectOption('dictation');
    await submit('clear map');assert.equal(await page.locator('.bubble').count(),6);
    await page.locator('#voiceInputMode').selectOption('smart');
    await submit('connect bubble one to bubble six');assert.equal(await page.evaluate(()=>connections.length),4);
    await submit('connect bubble one to bubble six');assert.equal(await page.evaluate(()=>connections.length),4);
    await submit('connect bubble one to bubble one');assert.equal(await page.evaluate(()=>connections.length),4);
    await page.locator('#thoughtSearch').fill('NASA');
    assert.equal(await page.locator('#bubbleList li:visible').count(),1);
    await page.locator('#thoughtSearch').fill('');
    await page.evaluate(()=>{bubbles[0].locked=true;bubbles[0].el.classList.add('locked');});
    const locked=await page.evaluate(()=>({x:bubbles[0].x,y:bubbles[0].y}));
    await page.locator('#arrangeMap').click();
    assert.deepEqual(await page.evaluate(()=>({x:bubbles[0].x,y:bubbles[0].y})),locked);
    const exportPromise=page.waitForEvent('download');await click(page,'#exportImageBtn');
    const download=await exportPromise;assert.match(download.suggestedFilename(),/\.png$/);assert.equal(await download.failure(),null);
    await click(page,'#audioPlayStopToggle');
    await click(page,'#audioPlayStopToggle');
    assert.equal(await page.locator('.bubble:visible').count(),6,'stop must restore the entire map');
    await page.locator('[data-mode=present]').click();await page.locator('#nextThought').click();
    await page.keyboard.press('ArrowRight');await page.keyboard.press('Delete');assert.equal(await page.locator('.bubble').count(),6);
    await page.keyboard.press('Escape');assert.equal(await page.locator('body').getAttribute('data-workspace-mode'),'explore');
    await page.keyboard.press('Control+k');await page.locator('#commandSearch').fill('fit map');
    assert.equal(await page.locator('#commandResults button').count(),1);await page.keyboard.press('Enter');
    assert.equal(await page.locator('#commandsModal').getAttribute('aria-hidden'),'true');
    // Connection-only mode stays active until explicitly ended, including in dictation mode.
    await page.locator('#microphoneToggle').click();
    async function say(text) { await page.evaluate(text=>testRecognition.onresult({results:[[{transcript:text,confidence:1}]]}),text); }
    await say('connect mode');assert.equal(await page.evaluate(()=>isConnectMode),true);
    await say('connect mode');assert.equal(await page.evaluate(()=>isConnectMode),true,'entry must be idempotent');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#addBubbleBtn').isDisabled(),true);
    await say('A new thought should not appear');await say('add bubble Nor should this');await say('task Do not create this');
    assert.equal(await page.locator('.bubble').count(),6);
    await page.evaluate(()=>{setActiveTool('select');createBubble('blocked',0,0);duplicateSelection();pasteClipboard();});
    assert.equal(await page.evaluate(()=>activeTool),'connect');assert.equal(await page.locator('.bubble').count(),6);
    await page.evaluate(()=>{voiceInputMode='dictation';});
    await say('connect bubbles two and six');
    assert.equal(await page.evaluate(()=>connections.length),5);
    assert.equal(await page.evaluate(()=>isConnectMode),true,'connecting must not end mode');
    await say('connect bubbles 2 and 99');await say('connect bubbles 2 and 2');await say('connect bubbles 2 and 6');
    assert.equal(await page.evaluate(()=>connections.length),5);
    assert.equal(await page.locator('.bubble').count(),6);
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>!!connections[4]._clickPath),true,'connection must render');
    await say('end connected mode');assert.equal(await page.evaluate(()=>isConnectMode),false);
    await say('A thought after ending connected mode');assert.equal(await page.locator('.bubble').count(),7);
    await page.locator('#microphoneToggle').click();
    await page.evaluate(()=>{voiceInputMode='smart';undo();});
    await page.locator('[data-mode=capture]').click();assert.equal(await page.locator('#quickCapture').evaluate(el=>document.activeElement===el),true);
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
    assert.ok(await page.evaluate(()=>zoom)>.01,'resize must not collapse zoom');
    const dock=await page.locator('#captureDock').boundingBox();assert.ok(dock.x>=0&&dock.x+dock.width<=391);
    await page.evaluate(()=>SpeechFlowWorkspace.fit());
    assert.ok(await page.evaluate(()=>bubbles.every(b=>{const r=b.el.getBoundingClientRect();return r.left>=getSidebarWidth()-1&&r.right<=innerWidth+1;})),'fit keeps thoughts horizontally visible');
    assert.deepEqual(errors,[]);
    console.log('PASS: templates, history, persistence, simulated recognition, input modes, connections, search, arrange, PNG export, playback stop, presentation, command palette, mobile layout.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

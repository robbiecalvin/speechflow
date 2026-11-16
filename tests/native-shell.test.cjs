const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
let browser,server,url;
before(async()=>{
 const root=path.resolve(__dirname,'../www');
 server=http.createServer(async(req,res)=>{
  try {let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const data=await fs.readFile(file);const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(data);}catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));});
async function open(t,platform='android'){
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await p.close();assert.deepEqual(errors,[]);});
 await p.addInitScript(({platform})=>{
  localStorage.setItem('speechflow.tutorial.v1','skip');if(platform==='ios')window.webkit={messageHandlers:{bridge:{}}};else window.androidBridge={};window.nativeCalls=[];window.permissionDenied=false;window.nativePermissionPending=false;
  const callbacks=new Map();let counter=0;
  const methods={SpeechFlowSpeech:['start','stop'],TextToSpeech:['getSupportedVoices','stop','speak'],Filesystem:['mkdir','stat','readdir','writeFile'],Share:['share'],Keyboard:['hide'],App:['minimizeApp']};
  window.nativeEmit=(plugin,eventName,data)=>{for(const entry of callbacks.values())if(entry.plugin===plugin&&entry.event===eventName)entry.callback(data);};
  window.Capacitor={
   PluginHeaders:Object.entries(methods).map(([name,names])=>({name,methods:[...names.map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]})),
   nativeCallback(plugin,method,options,callback){const id=String(++counter);callbacks.set(id,{plugin,event:options.eventName,callback});return id;},
   async nativePromise(plugin,method,options){
    nativeCalls.push({plugin,method,options});
    if(method==='removeListener'){callbacks.delete(options.callbackId);return;}
    if(plugin==='SpeechFlowSpeech'&&method==='start'){
     if(permissionDenied)throw {code:'PERMISSION_DENIED'};
     if(nativePermissionPending)return new Promise(resolve=>{window.nativeAllowPermission=()=>{nativeEmit(plugin,'recognition',{session:options.session,type:'started'});resolve();};});
     nativeEmit(plugin,'recognition',{session:options.session,type:'started'});return;
    }
    if(plugin==='TextToSpeech'&&method==='getSupportedVoices')return {voices:[]};
    if(plugin==='TextToSpeech'&&method==='speak')return new Promise(resolve=>{window.nativeSpeechDone=resolve;});
    if(plugin==='Filesystem'&&method==='readdir')return {files:[]};
    if(plugin==='Filesystem'&&method==='writeFile')return {uri:'file:///private/cache/'+options.path};
    return {};
   }
  };
 },{platform});
 await p.goto(url);return p;
}
test('packaged app uses native recording, persists captures, and stops on background',async t=>{
 const p=await open(t);assert.equal(await p.evaluate(()=>SpeechFlowNative.platform),'android');assert.equal(await p.locator('body').evaluate(el=>el.classList.contains('native-app')),true);
 assert.equal(await p.evaluate(()=>nativeCalls.some(c=>c.plugin==='SpeechFlowSpeech'&&c.method==='start')),false);
 await p.locator('#microphoneToggle').click();await p.waitForFunction(()=>document.getElementById('microphoneState').textContent==='Listening');
 await p.evaluate(()=>{const session=nativeCalls.find(c=>c.plugin==='SpeechFlowSpeech'&&c.method==='start').options.session;nativeEmit('SpeechFlowSpeech','recognition',{session,type:'result',text:'task Prepare the launch',confidence:1});window.oldSession=session;});
 assert.equal(await p.locator('.bubble').count(),1);assert.equal(await p.evaluate(()=>bubbles[0].type),'task');
 await p.evaluate(()=>nativeEmit('App','appStateChange',{isActive:false}));assert.equal(await p.evaluate(()=>microphoneEnabled),false);
 await p.evaluate(()=>nativeEmit('SpeechFlowSpeech','recognition',{session:oldSession,type:'result',text:'Late echo'}));assert.equal(await p.locator('.bubble').count(),1);
 await p.reload();assert.equal(await p.locator('.bubble').count(),1);assert.equal(await p.evaluate(()=>microphoneEnabled),false);
});
test('packaged permission failure preserves typing and provides explicit retry',async t=>{
 const p=await open(t);await p.evaluate(()=>permissionDenied=true);await p.locator('#microphoneToggle').click();await p.waitForFunction(()=>document.getElementById('microphoneState').textContent.includes('Permission denied'));
 assert.equal(await p.locator('#retryMicrophone').isVisible(),true);await p.locator('#quickCapture').fill('Typed fallback');await p.locator('#captureForm').evaluate(f=>f.requestSubmit());assert.equal(await p.locator('.bubble').count(),1);
});
test('packaged backup and PNG export use native sharing without claiming a downloaded backup',async t=>{
 const p=await open(t);await p.evaluate(()=>SpeechFlowWorkspace.submit('My saved thought'));
 await p.evaluate(()=>SpeechFlowWorkbench.downloadBackup());
 const file=await p.evaluate(()=>nativeCalls.find(c=>c.plugin==='Filesystem'&&c.method==='writeFile').options);
 assert.equal(file.encoding,'utf8');assert.equal(JSON.parse(file.data).bubbles[0].text,'My saved thought');assert.match(file.path,/\.json$/);
 assert.equal(await p.evaluate(()=>localStorage.getItem('speechflow.exported.v1')),null);
 await p.evaluate(()=>SpeechFlowWorkspace.exportImage());const image=await p.evaluate(()=>nativeCalls.filter(c=>c.plugin==='Filesystem'&&c.method==='writeFile').at(-1).options);assert.match(image.path,/\.png$/);assert.ok(image.data.startsWith('iVBOR'));assert.equal(image.encoding,undefined);
 assert.equal(await p.evaluate(()=>nativeCalls.filter(c=>c.plugin==='Share'&&c.method==='share').length),2);
});

test('iOS permission-dialog inactivity does not cancel activation; real backgrounding does',async t=>{
 const p=await open(t,'ios');await p.evaluate(()=>nativePermissionPending=true);await p.locator('#microphoneToggle').click();await p.waitForFunction(()=>!!window.nativeAllowPermission);
 await p.evaluate(()=>nativeEmit('App','appStateChange',{isActive:false}));assert.equal(await p.evaluate(()=>microphoneEnabled),true);
 await p.evaluate(()=>nativeAllowPermission());await p.waitForFunction(()=>document.getElementById('microphoneState').textContent==='Listening');
 await p.evaluate(()=>nativeEmit('App','pause',{}));assert.equal(await p.evaluate(()=>microphoneEnabled),false);
});

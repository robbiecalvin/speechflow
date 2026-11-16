const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const esbuild=require('esbuild');
const path=require('node:path');
const code=esbuild.transformSync(fs.readFileSync(path.join(__dirname,'../native/adapters.js'),'utf8'),{format:'cjs',target:'node22'}).code;
const context={module:{exports:{}},console};vm.runInNewContext(code,context);
const {createRecognitionClass,createSpeechSynthesis,shareNativeFile}=context.module.exports;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function microphone(){
 const listeners=new Set(),starts=[],stops=[];
 return {listeners,starts,stops,async addListener(_,callback){listeners.add(callback);return {remove:async()=>listeners.delete(callback)};},async start(options){starts.push(options);},async stop(options){stops.push(options);},emit(event){for(const fn of listeners)fn(event);}};
}
test('native recording is opt-in, uses actual start events, and emits each final once',async()=>{
 const plugin=microphone(),Recognition=createRecognitionClass(plugin),r=new Recognition();let starts=0,results=0,ends=0;
 r.onstart=()=>starts++;r.onresult=e=>{results++;assert.equal(e.results[0].isFinal,true);assert.equal(e.results[0][0].transcript,'My thought');};r.onend=()=>ends++;
 assert.equal(plugin.starts.length,0);r.start();await flush();assert.equal(starts,0);
 const session=plugin.starts[0].session;plugin.emit({session,type:'started'});assert.equal(starts,1);
 plugin.emit({session,type:'result',text:'My thought'});plugin.emit({session,type:'result',text:'My thought'});plugin.emit({session,type:'ended'});await flush();
 assert.equal(results,1);assert.equal(ends,1);assert.equal(plugin.listeners.size,0);
});
test('stop during permission/start ignores late native callbacks and removes listeners',async()=>{
 const plugin=microphone(),pending=deferred();plugin.start=options=>{plugin.starts.push(options);return pending.promise;};
 const r=new (createRecognitionClass(plugin))();let results=0;r.onresult=()=>results++;r.start();await flush();const session=plugin.starts[0].session;
 r.stop();plugin.emit({session,type:'started'});plugin.emit({session,type:'result',text:'Late thought'});pending.resolve();await flush();
 assert.equal(results,0);assert.equal(plugin.listeners.size,0);assert.equal(plugin.stops[0].session,session);
});
test('superseded sessions cannot deliver results into the current recording',async()=>{
 const plugin=microphone(),Recognition=createRecognitionClass(plugin),first=new Recognition(),next=new Recognition();let results=0;next.onresult=()=>results++;
 first.start();await flush();const old=plugin.starts[0].session;next.start();await flush();
 plugin.emit({session:old,type:'result',text:'Old'});plugin.emit({session:plugin.starts[1].session,type:'result',text:'New'});assert.equal(results,1);next.stop();
});
test('denied permissions produce a terminal permission error rather than a successful start',async()=>{
 const plugin=microphone();plugin.start=async()=>{throw {code:'PERMISSION_DENIED'};};const r=new (createRecognitionClass(plugin))();let error,ended=0;r.onerror=e=>error=e.error;r.onend=()=>ended++;r.start();await flush();assert.equal(error,'not-allowed');assert.equal(ended,1);assert.equal(plugin.listeners.size,0);
});
function speech(){
 const requests=[],ranges=new Set();
 return {requests,async stop(){},async getSupportedVoices(){return {voices:[]};},async addListener(_,callback){ranges.add(callback);return {remove:async()=>ranges.delete(callback)};},speak(options){const pending=deferred();requests.push({options,...pending});return pending.promise;},range(start){for(const callback of ranges)callback({start});}};
}
test('native TTS pauses and resumes from the current word, ignoring cancelled completion',async()=>{
 const plugin=speech(),synth=createSpeechSynthesis(plugin);let ends=0;const utterance={text:'First second third',onend:()=>ends++};
 synth.speak(utterance);await flush();plugin.range(6);synth.pause();plugin.requests[0].resolve();await flush();assert.equal(ends,0);
 synth.resume();await flush();assert.equal(plugin.requests[1].options.text,'second third');plugin.requests[1].resolve();await flush();assert.equal(ends,1);
});
test('cancelled native speech cannot advance a replacement utterance',async()=>{
 const plugin=speech(),synth=createSpeechSynthesis(plugin);let old=0,next=0;synth.speak({text:'Old',onend:()=>old++});await flush();synth.speak({text:'New',onend:()=>next++});await flush();plugin.requests[0].resolve();await flush();assert.equal(old,0);assert.equal(next,0);plugin.requests[1].resolve();await flush();assert.equal(next,1);
});
test('native exports are sanitized, bounded, private cache files shared through the OS',async()=>{
 let written,shared;const deleted=[];
 const filesystem={async mkdir(){},async readdir(){return {files:Array.from({length:21},(_,i)=>({name:`${i}.json`,mtime:i}))};},async deleteFile(file){deleted.push(file);},async writeFile(file){written=file;return {uri:'file:///private/cache/map.json'};}};
 await shareNativeFile({filesystem,share:{async share(options){shared=options;return {};}}},{name:'../../map.json',data:'{"thought":"hello"}',mimeType:'application/json'});
 assert.equal(written.directory,'CACHE');assert.equal(written.encoding,'utf8');assert.ok(!written.path.includes('../'));assert.equal(deleted.length,2);assert.equal(shared.url,'file:///private/cache/map.json');
});
test('failed native file writes never claim sharing succeeded',async()=>{
 let shared=false;const filesystem={async mkdir(){},async readdir(){return {files:[]};},async writeFile(){throw new Error('disk full');}};
 await assert.rejects(shareNativeFile({filesystem,share:{async share(){shared=true;}}},{name:'map.json',data:'{}',mimeType:'application/json'}),/disk full/);assert.equal(shared,false);
});
test('web bundle includes only app assets and loads adapters before the command controller',()=>{
 const root=path.join(__dirname,'..','www');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(html.indexOf('native-bridge.js')<html.indexOf('./script.js'));
 for(const name of ['.git','node_modules','package-lock.json','android','ios','tests'])assert.equal(fs.existsSync(path.join(root,name)),false);
 assert.equal(fs.existsSync(path.join(root,'core','voice-parser.js')),true);
});
test('native speech is registered on the actual Android and iOS launch paths',()=>{
 const root=path.resolve(__dirname,'..');const read=file=>fs.readFileSync(path.join(root,file),'utf8');
 assert.match(read('android/app/src/main/java/app/speechflow/mobile/MainActivity.java'),/registerPlugin\(SpeechFlowSpeechPlugin.class\)/);
 assert.match(read('ios/App/App/SceneDelegate.swift'),/rootViewController = SpeechFlowViewController\(\)/);
 assert.match(read('ios/App/App/SpeechFlowViewController.swift'),/registerPluginInstance\(SpeechFlowSpeechPlugin\(\)\)/);
 assert.match(read('ios/App/App/SpeechFlowSpeechPlugin.swift'),/UIApplication.didEnterBackgroundNotification/);
 assert.match(read('ios/App/App/Info.plist'),/NSMicrophoneUsageDescription/);
 assert.match(read('ios/App/App/Info.plist'),/NSSpeechRecognitionUsageDescription/);
 assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/SpeechFlowSpeechPlugin.swift in Sources/);
});
test('native synthesis failures report an error, never successful completion',async()=>{
 const plugin=speech(),synth=createSpeechSynthesis(plugin);let errors=0,ends=0;
 synth.speak({text:'Unavailable language',onerror:()=>errors++,onend:()=>ends++});await flush();plugin.requests[0].reject(new Error('unsupported language'));await flush();assert.equal(errors,1);assert.equal(ends,0);
});

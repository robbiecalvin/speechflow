const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function harness({supported=true,onResult,accept=true}={}) {
  const pending=new Map();let nextId=0,instance,starts=0,results=0;
  const context=vm.createContext({window:{},setTimeout:callback=>{pending.set(++nextId,callback);return nextId;},clearTimeout:id=>pending.delete(id)});
  for(const name of ['voice-state','voice-errors','voice-recognition'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../core',name+'.js'),'utf8'),context);
  const core=context.window.SpeechFlowCore;
  const state=core.voiceState.createVoiceStateMachine();
  class Recognition {constructor(){instance=this;}start(){starts++;}stop(){instance.onend();}}
  let controller;
  controller=core.voiceRecognition.createVoiceRecognitionController({RecognitionCtor:supported?Recognition:null,voiceState:state,autoRestart:true,mapError:core.voiceErrors.normalizeRecognitionError,shouldAcceptResult:()=>accept,onResult:()=>{results++;onResult?.(controller,state);}});
  return {controller,state,pending,get instance(){return instance;},get starts(){return starts;},get results(){return results;},emit(){instance.onresult({results:[[{transcript:'next',confidence:1}]]});},retry(){const [id,callback]=pending.entries().next().value;pending.delete(id);callback();}};
}
test('recognition handles unsupported browsers without retry loops',()=>{
  const h=harness({supported:false});assert.equal(h.controller.startListening(),false);assert.equal(h.state.getState().state,'error');assert.equal(h.pending.size,0);
});
test('stopping during a result handler leaves recognition idle',()=>{
  const h=harness({onResult:c=>c.stopListening()});h.controller.startListening();h.emit();assert.equal(h.results,1);assert.equal(h.state.getState().state,'idle');assert.equal(h.pending.size,0);
});
test('permission denial never auto-restarts after recognition ends',()=>{
  const h=harness();h.controller.startListening();h.instance.onerror({error:'not-allowed'});h.instance.onend();assert.equal(h.state.getState().state,'error');assert.equal(h.pending.size,0);
});
test('recoverable network errors schedule one retry and user stop cancels it',()=>{
  const h=harness();h.controller.startListening();h.instance.onerror({error:'network'});h.instance.onend();assert.equal(h.pending.size,1);h.retry();assert.equal(h.starts,2);assert.equal(h.state.getState().state,'listening');h.instance.onend();h.controller.stopListening();assert.equal(h.pending.size,0);
});
test('late speech and errors after user stop do not change the idle state',()=>{
  const h=harness();h.controller.startListening();h.controller.stopListening();h.emit();h.instance.onerror({error:'aborted'});assert.equal(h.results,0);assert.equal(h.state.getState().state,'idle');assert.equal(h.pending.size,0);
});
test('modal or playback acceptance guard suppresses recognition results',()=>{
  const h=harness({accept:false});h.controller.startListening();h.emit();assert.equal(h.results,0);assert.equal(h.state.getState().state,'listening');
});
test('a terminal permission error cancels a previously scheduled network retry',()=>{
  const h=harness();h.controller.startListening();h.instance.onerror({error:'network'});assert.equal(h.pending.size,1);h.instance.onerror({error:'not-allowed'});assert.equal(h.pending.size,0);h.instance.onend();assert.equal(h.pending.size,0);
});

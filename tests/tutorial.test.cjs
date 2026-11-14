const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function tutorial(onChange){const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../core/tutorial.js'),'utf8'),c);return c.window.SpeechFlowCore.tutorial.createTutorial({onChange});}
test('tour starts inactive and only consumes whole-word controls while active',()=>{
  const tour=tutorial();assert.equal(tour.handleVoice('next'),false);tour.start();
  assert.equal(tour.handleVoice('next idea'),false);assert.equal(tour.getState().index,0);
  assert.equal(tour.handleVoice(' NEXT! '),true);assert.equal(tour.getState().index,1);
  assert.equal(tour.handleVoice('please skip this idea'),false);
  assert.equal(tour.handleVoice('Skip.'),true);assert.equal(tour.getState().active,false);
  assert.equal(tour.handleVoice('next'),false);
});
test('tour completes once and restarts from its beginning',()=>{
  const reasons=[];const tour=tutorial((s,reason)=>reasons.push(reason));tour.start();const {total}=tour.getState();
  for(let i=0;i<total;i++)tour.next();assert.equal(tour.getState().active,false);assert.equal(reasons.filter(x=>x==='complete').length,1);
  tour.next();tour.skip();assert.equal(reasons.filter(x=>x==='complete').length,1);
  tour.start();assert.equal(tour.getState().index,0);tour.previous();assert.equal(tour.getState().index,0);tour.next();tour.previous();assert.equal(tour.getState().index,0);
});

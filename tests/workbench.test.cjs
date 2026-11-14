const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function core(){const c=vm.createContext({window:{}});for(const file of ['workbench','voice-parser','voice-router'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../core',file+'.js'),'utf8'),c);return c.window.SpeechFlowCore;}
const nodes=[{id:'a',x:0,y:0,width:180,height:90},{id:'b',x:100,y:0,width:240,height:110},{id:'c',x:100,y:100,width:180,height:90},{id:'d',x:200,y:100,width:180,height:90}];
const edges=[{from:'a',to:'b'},{from:'b',to:'c'},{from:'c',to:'a'}];
test('all layouts are finite, avoid overlaps, preserve fixed nodes, and do not mutate input',()=>{
  const c=core();
  for(const mode of ['grid','flowchart','mindmap','timeline']){
    const input=nodes.map((n,i)=>({...n,locked:i===1}));const before=JSON.stringify(input);
    const placed=c.workbench.layout(input,edges,mode,'a');assert.equal(placed.length,4);assert.equal(JSON.stringify(input),before);
    for(const p of placed){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));if(p.id==='b'){assert.equal(p.x,100);assert.equal(p.y,0);}}
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
      const a={...input.find(n=>n.id===placed[i].id),...placed[i]},b={...input.find(n=>n.id===placed[j].id),...placed[j]};
      assert.ok(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),`${mode}: overlapping ${a.id}/${b.id}`);
    }
  }
});
test('graph story starts at a chosen node and visits cyclic and disconnected nodes once',()=>{
  const order=Array.from(core().workbench.storyOrder(nodes,edges,'b'));assert.deepEqual(order,['b','c','a','d']);
});
test('voice corrections preserve capitalization and parse spoken target numbers',()=>{
  const parser=core().voiceParser;
  const rename=parser.parseVoiceInput('rename bubble two to NASA Launch Plan');assert.equal(rename.intent,'rename_bubble');assert.equal(rename.args.index,1);assert.equal(rename.args.text,'NASA Launch Plan');
  const change=parser.parseVoiceInput('change bubble three to a task');assert.equal(change.args.index,2);assert.equal(change.args.type,'task');
  const label=parser.parseVoiceInput('label connection one to two as Depends on NASA');assert.equal(label.args.label,'Depends on NASA');
  assert.equal(parser.parseVoiceInput('rename bubble two').intent,'invalid_command');assert.equal(parser.parseVoiceInput('undo that').intent,'undo');assert.equal(parser.parseVoiceInput('mind map layout').args.layout,'mindmap');
});
test('backup validation rejects dangling edges and unrelated JSON without mutating input',()=>{
  const validate=core().workbench.validateBackup;
  assert.throws(()=>validate({mapName:{invalid:true},bubbles:[],connections:[]}));
  assert.throws(()=>validate('{}'));assert.throws(()=>validate({bubbles:[{text:'a'}],connections:[{from:0,to:1}]}));
  const data={bubbles:[{text:'a'}],connections:[]};assert.equal(validate(data),data);
});
test('router returns cancellation and handler failures to the feedback UI',()=>{
  const c=core();let called=0;
  const router=c.voiceRouter.createVoiceRouter({parser:c.voiceParser,confirmDestructive:()=>false,onClearMap:()=>called++,onRenameBubble:()=>({status:'error',message:'No such thought'})});
  assert.equal(router.route('clear map').status,'cancelled');assert.equal(called,0);assert.equal(router.route('rename bubble 9 to Test').status,'error');
});

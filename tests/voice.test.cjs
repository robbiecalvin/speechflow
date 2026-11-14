const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function core() {
  const context = vm.createContext({window:{}});
  for (const name of ['voice-parser','voice-router','node','persistence','voice-state']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../core',name+'.js'),'utf8'),context);
  }
  return context.window.SpeechFlowCore;
}
test('command parsing preserves names and capitalized dictation',()=>{
  const parser=core().voiceParser;
  assert.equal(parser.parseVoiceInput('Create bubble Ship the MVP').args.transcript,'Ship the MVP');
  assert.equal(parser.parseVoiceInput('TASK   Review NASA API').args.remainder,'Review NASA API');
  assert.equal(parser.parseVoiceInput('What if we tried this?').mode,'dictation');
  assert.equal(parser.parseVoiceInput('  ').mode,'ignore');
});
test('spoken numbers, punctuation, tools, and workspace modes',()=>{
  const parser=core().voiceParser;
  assert.equal(parser.parseVoiceInput('Select bubble THREE!').args.bubbleIndex,2);
  const link=parser.parseVoiceInput('Connect bubble one to bubble two.');
  assert.equal(link.intent,'connect_bubbles');assert.equal(link.args.from,0);assert.equal(link.args.to,1);
  for(const phrase of ['zoom in','zoom out','fit map','pan tool','present mode','next bubble','arrange map']) assert.equal(parser.parseVoiceInput(phrase).mode,'command',phrase);
  assert.equal(parser.parseVoiceInput('connect bubble one to the future').mode,'dictation');
});
test('router confirms destructive actions and dispatches typed intent exactly once',()=>{
  const c=core();let deleted=0,typed=0,dictation=0,connections=0;
  const options={parser:c.voiceParser,confirmDestructive:()=>false,onClearMap:()=>deleted++,onTypedIntent:()=>typed++,onDictation:()=>dictation++,onConnectBubbles:()=>connections++};
  const router=c.voiceRouter.createVoiceRouter(options);
  router.route('clear map');assert.equal(deleted,0);
  options.confirmDestructive=()=>true;router.route('clear map');assert.equal(deleted,1);
  router.route('task Build a prototype');assert.equal(typed,1);assert.equal(dictation,1);
  router.route('connect one to two');assert.equal(connections,1);
});
test('node model and snapshots retain types, shapes, dimensions, and lock state',()=>{
  const c=core();const node=c.node.createNode({text:'A task',type:'task',shape:'diamond',width:240,height:140,groupId:'team'});
  assert.equal(node.type,'task');assert.equal(node.shape,'diamond');assert.equal(node.width,240);assert.equal(node.groupId,'team');
  const snapshot=c.persistence.parseSnapshot(c.persistence.stringifySnapshot({bubbles:[{...node,locked:false}],connections:[]}));
  assert.equal(snapshot.bubbles[0].type,'task');assert.equal(snapshot.bubbles[0].locked,false);assert.equal(snapshot.bubbles[0].height,140);
});
test('playback can start without enabling the microphone',()=>{
  const machine=core().voiceState.createVoiceStateMachine();
  machine.transition('speaking');machine.transition('paused');machine.transition('speaking');machine.transition('idle');
  assert.equal(machine.getState().state,'idle');
});

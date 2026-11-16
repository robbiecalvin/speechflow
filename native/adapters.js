/* Browser-shaped adapters keep native speech behind the existing intent pipeline. */
export function createRecognitionClass(plugin) {
  let owner = null;
  let sequence = 0;
  return class NativeRecognition {
    constructor() { this.lang='en-US'; this.handles=[]; this.active=false; }
    start() {
      if (this.active) throw new Error('Recognition already started');
      owner?.stop();
      owner=this;this.active=true;this.delivered=false;this.session=String(++sequence);
      void this.begin();
    }
    async begin() {
      try {
        const handle=await plugin.addListener('recognition', event=>{
          if (!this.active || event.session!==this.session) return;
          if (event.type==='started') this.onstart?.();
          if (event.type==='result' && event.text?.trim() && !this.delivered) {
            this.delivered=true;
            const result=Object.assign([{transcript:event.text,confidence:event.confidence ?? 1}],{isFinal:true});
            this.onresult?.({resultIndex:0,results:[result]});
          }
          if (event.type==='error') this.onerror?.({error:event.error||'network'});
          if (event.type==='ended') this.finish();
        });
        if (!this.active) {await handle.remove();return;}
        this.handles.push(handle);
        await plugin.start({session:this.session,language:this.lang});
      } catch (error) {
        if (!this.active) return;
        const code=error?.code==='PERMISSION_DENIED'?'not-allowed':error?.code==='UNAVAILABLE'?'service-not-allowed':'network';
        this.onerror?.({error:code});this.finish();
      }
    }
    finish() {
      if (!this.active) return;
      this.active=false;
      this.handles.splice(0).forEach(handle=>{void handle.remove();});
      if(owner===this)owner=null;
      this.onend?.();
    }
    stop() {
      if (!this.active) return;
      // Native stops carry the session ID, so a delayed Stop cannot stop a new session.
      void plugin.stop({session:this.session}).catch(()=>{});
      this.finish();
    }
    abort() {this.stop();}
  };
}

export function createSpeechSynthesis(tts) {
  let current=null, voices=[], generation=0, stopped=Promise.resolve();
  const api={
    onvoiceschanged:null,
    getVoices:()=>voices,
    speak(utterance) {
      api.cancel();
      const item={utterance,offset:0,range:0,paused:false,token:++generation};current=item;
      void run(item);
    },
    cancel() {generation++;current=null;stopped=tts.stop().catch(()=>{});},
    pause() {
      if(!current||current.paused)return;
      current.paused=true;current.offset+=current.range;current.range=0;current.token=++generation;
      stopped=tts.stop().catch(()=>{});
    },
    resume() {if(current?.paused){current.paused=false;current.token=++generation;void run(current);}},
  };
  async function run(item) {
    const token=item.token;
    await stopped;
    if(current!==item||generation!==token||item.paused)return;
    let handle;
    try {
      handle=await tts.addListener('onRangeStart',event=>{
        if(current===item&&generation===token)item.range=Math.max(0,event.start||0);
      });
      if(current!==item||generation!==token||item.paused)return;
      const index=voices.findIndex(v=>v.name===item.utterance.voice?.name);
      await tts.speak({text:item.utterance.text.slice(item.offset),lang:item.utterance.lang||'en-US',rate:item.utterance.rate||1,pitch:item.utterance.pitch||1,...(index>=0?{voice:index}:{}),category:'ambient'});
      if(current===item&&generation===token&&!item.paused){current=null;item.utterance.onend?.();}
    } catch(error) {
      if(current===item&&generation===token&&!item.paused){current=null;item.utterance.onerror?.({error:'synthesis-failed',message:error.message});}
    } finally {await handle?.remove();}
  }
  void tts.getSupportedVoices().then(result=>{voices=result.voices||[];api.onvoiceschanged?.();}).catch(()=>{});
  return api;
}

export async function shareNativeFile({filesystem,share}, {name,data,mimeType}) {
  const safeName=String(name).replace(/[^a-zA-Z0-9._-]/g,'-').slice(-120)||'speechflow.json';
  const directory='speechflow-exports';
  await filesystem.mkdir({path:directory,directory:'CACHE',recursive:true}).catch(error=>{
    // mkdir fails for an existing directory; verify it rather than hiding other failures.
    return filesystem.stat({path:directory,directory:'CACHE'});
  });
  const entries=await filesystem.readdir({path:directory,directory:'CACHE'});
  const oldest=[...entries.files].sort((a,b)=>(b.mtime||0)-(a.mtime||0)).slice(19);
  await Promise.all(oldest.map(file=>filesystem.deleteFile({path:`${directory}/${file.name}`,directory:'CACHE'}).catch(()=>{})));
  const path=`${directory}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeName}`;
  const written=await filesystem.writeFile({path,data,directory:'CACHE',...(mimeType==='application/json'?{encoding:'utf8'}:{})});
  return share.share({title:'SpeechFlow',url:written.uri,dialogTitle:'Save or share your SpeechFlow file'});
}

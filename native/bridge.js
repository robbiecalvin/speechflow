import {Capacitor, registerPlugin} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Keyboard} from '@capacitor/keyboard';
import {TextToSpeech} from '@capacitor-community/text-to-speech';
import {createRecognitionClass,createSpeechSynthesis,shareNativeFile} from './adapters.js';

if (Capacitor.isNativePlatform()) {
  document.body.classList.add('native-app');
  const nativeSpeech=registerPlugin('SpeechFlowSpeech');
  window.SpeechRecognition=createRecognitionClass(nativeSpeech);
  class NativeUtterance {constructor(text){this.text=String(text);this.rate=1;this.pitch=1;this.lang='en-US';}}
  // WKWebView provides system synthesis with real pause/resume. Android needs native TTS.
  const webKitSpeech=Capacitor.getPlatform()==='ios' && typeof window.SpeechSynthesisUtterance==='function' && typeof window.speechSynthesis?.speak==='function';
  if(!webKitSpeech){
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:NativeUtterance});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:createSpeechSynthesis(TextToSpeech)});
  }
  window.SpeechFlowNative={
    platform:Capacitor.getPlatform(),
    exportFile:options=>shareNativeFile({filesystem:Filesystem,share:Share},options),
    dismissKeyboard:()=>Keyboard.hide().catch(()=>{}),
  };
  function stopForBackground(){
    window.SpeechFlowWorkspace?.stopMicrophone();
    document.dispatchEvent(new Event('speechflow:background'));
    window.speechSynthesis.cancel();
  }
  // iOS permission dialogs also resign active; only a real background transition stops capture.
  if(Capacitor.getPlatform()==='ios')void App.addListener('pause',stopForBackground);
  else void App.addListener('appStateChange',({isActive})=>{if(!isActive)stopForBackground();});
  void App.addListener('backButton',()=>{
    const modal=document.querySelector('.modal:not(.hidden)');
    if(modal){modal.querySelector('button[id^="close"],#promptModalCancel,#voiceSettingsCancel')?.click();return;}
    if(document.body.dataset.workspaceMode==='present'){window.SpeechFlowWorkspace?.setMode('explore');return;}
    if(document.body.dataset.mobileInspector==='true'){document.getElementById('closeInspector')?.click();return;}
    if(!document.getElementById('bubbleColumn')?.inert){document.getElementById('sidebarBackdrop')?.click();return;}
    void App.minimizeApp();
  });
}

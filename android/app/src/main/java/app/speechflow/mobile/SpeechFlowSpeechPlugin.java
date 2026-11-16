package app.speechflow.mobile;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/** Finite native recognition sessions; only final transcripts enter the graph. */
@CapacitorPlugin(name="SpeechFlowSpeech", permissions={
    @Permission(alias="microphone", strings={Manifest.permission.RECORD_AUDIO})
})
public class SpeechFlowSpeechPlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private String session;
    private volatile String requestedSession;

    @PluginMethod public void start(PluginCall call) {
        requestedSession=call.getString("session");
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermission");
        } else begin(call);
    }

    @PermissionCallback private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) begin(call);
        else call.reject("Microphone permission denied. You can still type.", "PERMISSION_DENIED");
    }

    private void begin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.STARTED)) {
                call.reject("Return to SpeechFlow before enabling the microphone.", "UNAVAILABLE");return;
            }
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("No speech recognition service is installed. You can still type.", "UNAVAILABLE");return;
            }
            final String id=call.getString("session");
            if(id==null){call.reject("Missing recognition session");return;}
            if(!id.equals(requestedSession)){call.resolve();return;}
            end(session);
            session=id;
            recognizer=SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                private boolean active(){return id.equals(session);}
                public void onReadyForSpeech(Bundle params){if(active())emit(id,"started",null,null,1);}
                public void onBeginningOfSpeech(){}
                public void onRmsChanged(float value){}
                public void onBufferReceived(byte[] buffer){}
                public void onEndOfSpeech(){} // Wait for final results; silence is not a transcript.
                public void onPartialResults(Bundle results){}
                public void onEvent(int type, Bundle params){}
                public void onResults(Bundle results){
                    if(!active())return;
                    ArrayList<String> matches=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    float[] scores=results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                    float confidence=scores!=null&&scores.length>0&&scores[0]>=0?scores[0]:1;
                    if(matches!=null&&!matches.isEmpty())emit(id,"result",matches.get(0),null,confidence);
                    end(id);
                }
                public void onError(int code){
                    if(!active())return;
                    String error;
                    switch(code){
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: error="not-allowed";break;
                        case SpeechRecognizer.ERROR_AUDIO: error="audio-capture";break;
                        case SpeechRecognizer.ERROR_NO_MATCH:
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: error="no-speech";break;
                        case SpeechRecognizer.ERROR_CLIENT: error="aborted";break;
                        default: error="network";
                    }
                    emit(id,"error",null,error,1);end(id);
                }
            });
            Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,call.getString("language","en-US"));
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,false);
            try{recognizer.startListening(intent);call.resolve();}
            catch(Exception error){end(id);call.reject("Speech recognition could not start.","UNAVAILABLE");}
        });
    }
    private void emit(String id,String type,String text,String error,float confidence){
        JSObject result=new JSObject();result.put("session",id);result.put("type",type);
        if(text!=null)result.put("text",text);if(error!=null)result.put("error",error);
        result.put("confidence",confidence);notifyListeners("recognition",result);
    }
    private void end(String id){
        if(id==null||!id.equals(session))return;
        session=null;
        if(id.equals(requestedSession))requestedSession=null;
        if(recognizer!=null){SpeechRecognizer old=recognizer;recognizer=null;old.cancel();old.destroy();}
        emit(id,"ended",null,null,1);
    }
    @PluginMethod public void stop(PluginCall call){
        getActivity().runOnUiThread(()->{String id=call.getString("session");if(id!=null&&id.equals(requestedSession))requestedSession=null;end(id);call.resolve();});
    }
    @Override protected void handleOnStop(){getActivity().runOnUiThread(()->{requestedSession=null;end(session);});}
    @Override protected void handleOnDestroy(){getActivity().runOnUiThread(()->{requestedSession=null;end(session);});}
}

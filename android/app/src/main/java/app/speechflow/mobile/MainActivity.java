package app.speechflow.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpeechFlowSpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

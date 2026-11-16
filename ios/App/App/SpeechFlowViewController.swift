import Capacitor

class SpeechFlowViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeechFlowSpeechPlugin())
    }
}

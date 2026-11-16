import AVFoundation
import Capacitor
import Speech
import UIKit

@objc(SpeechFlowSpeechPlugin)
public class SpeechFlowSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechFlowSpeechPlugin"
    public let jsName = "SpeechFlowSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private var requestedSession: String?
    private var session: String?
    private var recognizer: SFSpeechRecognizer?
    private var task: SFSpeechRecognitionTask?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var engine: AVAudioEngine?
    private var hasTap = false
    private var timeout: DispatchWorkItem?

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let id = call.getString("session") else {call.reject("Missing recognition session");return}
            self.requestedSession = id
            SFSpeechRecognizer.requestAuthorization { status in
                guard status == .authorized else {
                    call.reject("Speech recognition permission denied. You can still type.", "PERMISSION_DENIED");return
                }
                AVCaptureDevice.requestAccess(for: .audio) { granted in
                    DispatchQueue.main.async {
                        guard self.requestedSession == id else {call.resolve();return}
                        guard granted else {call.reject("Microphone permission denied. You can still type.", "PERMISSION_DENIED");return}
                        self.begin(call, id: id)
                    }
                }
            }
        }
    }
    private func begin(_ call: CAPPluginCall, id: String) {
        guard UIApplication.shared.applicationState != .background else {call.reject("Return to SpeechFlow before enabling the microphone.", "UNAVAILABLE");return}
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: call.getString("language") ?? "en-US")), recognizer.isAvailable else {
            call.reject("Speech recognition is unavailable. You can still type.", "UNAVAILABLE");return
        }
        finish(session)
        session = id
        self.recognizer = recognizer
        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.engine = engine
        self.request = request
        do {
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try audio.setActive(true, options: .notifyOthersOnDeactivation)
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {throw NSError(domain: "SpeechFlow", code: 1)}
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
            hasTap = true
            task = recognizer.recognitionTask(with: request) { result, error in
                DispatchQueue.main.async {
                    guard self.session == id else {return}
                    if let result = result {
                        self.timeout?.cancel()
                        if result.isFinal {
                            self.deliver(result, id: id)
                            self.finish(id)
                        } else {
                            // Commit after a deliberate pause, never on every evolving partial.
                            let pending = DispatchWorkItem { [weak self] in
                                guard let self = self, self.session == id else {return}
                                self.deliver(result, id: id)
                                self.finish(id)
                            }
                            self.timeout = pending
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.4, execute: pending)
                        }
                    } else if error != nil {
                        self.emit(id: id, type: "error", error: "network")
                        self.finish(id)
                    }
                }
            }
            engine.prepare()
            try engine.start()
            emit(id: id, type: "started")
            call.resolve()
        } catch {
            finish(id)
            call.reject("Microphone could not start. Check your audio input.", "UNAVAILABLE")
        }
    }
    private func deliver(_ result: SFSpeechRecognitionResult, id: String) {
        let segments = result.bestTranscription.segments
        let confidence = segments.isEmpty ? 1.0 : Double(segments.map(\.confidence).reduce(0,+)) / Double(segments.count)
        emit(id: id, type: "result", text: result.bestTranscription.formattedString, confidence: confidence > 0 ? confidence : 1)
    }
    private func emit(id: String, type: String, text: String? = nil, error: String? = nil, confidence: Double = 1) {
        var data: JSObject = ["session": id, "type": type, "confidence": confidence]
        if let text = text {data["text"] = text}
        if let error = error {data["error"] = error}
        notifyListeners("recognition", data: data)
    }
    private func finish(_ id: String?) {
        guard let id = id, session == id else {return}
        session = nil
        if requestedSession == id {requestedSession = nil}
        timeout?.cancel();timeout = nil
        if let engine = engine {
            engine.stop()
            if hasTap {engine.inputNode.removeTap(onBus: 0)}
            hasTap = false
        }
        engine = nil
        request?.endAudio();request = nil
        task?.cancel();task = nil
        recognizer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        emit(id: id, type: "ended")
    }
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let id = call.getString("session")
            if self.requestedSession == id {self.requestedSession = nil}
            self.finish(id)
            call.resolve()
        }
    }
    public override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(background), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }
    @objc private func background() {requestedSession = nil;finish(session)}
    deinit {NotificationCenter.default.removeObserver(self)}
}

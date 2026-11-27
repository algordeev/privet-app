import Foundation
import AVFoundation
import Capacitor
import Speech

// Russian speech recognition for speaking exercises. On-device by default, so the learner's
// voice never leaves the iPhone. One listening session at a time: start() resolves once with
// the final transcriptions; "level" and "partial" events stream while it listens.
@objc(PrivetSpeechPlugin)
public class PrivetSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrivetSpeechPlugin"
    public let jsName = "PrivetSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    private struct Session {
        let call: CAPPluginCall
        let recognizer: SFSpeechRecognizer
        let request: SFSpeechAudioBufferRecognitionRequest
        var task: SFSpeechRecognitionTask?
        let startedAt: Date
        let onDevice: Bool
        let maxSeconds: Double
        let silenceSeconds: Double
        let noSpeechSeconds: Double
        let loudDb: Float
        var heardSpeech = false
        var lastActivity: Date
        var endedAt: Date?
        var endReason = ""
        var latest: SFSpeechRecognitionResult?
    }

    private let engine = AVAudioEngine()
    private var session: Session?
    private var timer: Timer?
    private var lastLevelSent = Date.distantPast
    private var savedCategory: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted(_:)),
            name: AVAudioSession.interruptionNotification, object: nil)
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    // MARK: Permissions and support

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(describeStatus(locale: call.getString("locale") ?? "ru-RU"))
    }

    @objc func authorize(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? "ru-RU"
        SFSpeechRecognizer.requestAuthorization { _ in
            self.requestMicrophone { _ in
                DispatchQueue.main.async { call.resolve(self.describeStatus(locale: locale)) }
            }
        }
    }

    // The app's page in iOS Settings, where a refused microphone can be allowed again.
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { return call.reject("No settings page", "UNAVAILABLE") }
            UIApplication.shared.open(url) { _ in call.resolve() }
        }
    }

    private func describeStatus(locale: String) -> JSObject {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))
        return [
            "speech": speechText(SFSpeechRecognizer.authorizationStatus()),
            "microphone": microphoneText(),
            "recognizer": recognizer != nil,
            "available": recognizer?.isAvailable ?? false,
            "onDevice": recognizer?.supportsOnDeviceRecognition ?? false
        ]
    }

    private func speechText(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "prompt"
        @unknown default: return "denied"
        }
    }

    private func microphoneText() -> String {
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted: return "granted"
            case .denied: return "denied"
            case .undetermined: return "prompt"
            @unknown default: return "denied"
            }
        }
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return "granted"
        case .denied: return "denied"
        case .undetermined: return "prompt"
        @unknown default: return "denied"
        }
    }

    private func requestMicrophone(_ done: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: done)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(done)
        }
    }

    // MARK: Listening

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.begin(call) }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.endAudio(reason: "stopped")
            call.resolve()
        }
    }

    private func begin(_ call: CAPPluginCall) {
        if session != nil { finish(reason: "replaced") }
        guard SFSpeechRecognizer.authorizationStatus() == .authorized, microphoneText() == "granted" else {
            return call.reject("Microphone or speech recognition not allowed", "NOT_AUTHORIZED")
        }
        let locale = call.getString("locale") ?? "ru-RU"
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)), recognizer.isAvailable else {
            return call.reject("Speech recognition unavailable for \(locale)", "UNAVAILABLE")
        }
        let onDevice = call.getBool("onDeviceOnly") ?? true
        if onDevice && !recognizer.supportsOnDeviceRecognition {
            return call.reject("On-device recognition unsupported for \(locale)", "NO_ON_DEVICE")
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = onDevice
        request.contextualStrings = call.getArray("contextualStrings", String.self) ?? []
        request.taskHint = .confirmation
        if #available(iOS 16.0, *) { request.addsPunctuation = false }

        do {
            try openAudioSession()
        } catch {
            restoreAudioSession()
            return call.reject("Could not open the microphone", "AUDIO_SESSION", error)
        }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            restoreAudioSession()
            return call.reject("No microphone input", "NO_INPUT")
        }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            let db = PrivetSpeechPlugin.decibels(buffer)
            DispatchQueue.main.async { self?.heard(level: db) }
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            restoreAudioSession()
            return call.reject("Could not start the microphone", "ENGINE", error)
        }

        let now = Date()
        session = Session(
            call: call, recognizer: recognizer, request: request, startedAt: now, onDevice: onDevice,
            maxSeconds: call.getDouble("maxSeconds") ?? 6,
            silenceSeconds: (call.getDouble("silenceMs") ?? 1200) / 1000,
            noSpeechSeconds: call.getDouble("noSpeechSeconds") ?? 4,
            loudDb: Float(call.getDouble("loudDb") ?? -38),
            lastActivity: now)
        session?.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async { self?.recognized(result, error) }
        }
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in self?.tick() }
        notifyListeners("state", data: ["state": "listening"])
    }

    private func heard(level db: Float) {
        guard var current = session, current.endedAt == nil else { return }
        if db > current.loudDb { current.lastActivity = Date() }
        session = current
        if Date().timeIntervalSince(lastLevelSent) > 0.06 {
            lastLevelSent = Date()
            notifyListeners("level", data: ["db": Double(db)])
        }
    }

    private func recognized(_ result: SFSpeechRecognitionResult?, _ error: Error?) {
        guard var current = session else { return }
        if let result = result {
            current.latest = result
            let text = result.bestTranscription.formattedString
            if !text.isEmpty {
                current.heardSpeech = true
                current.lastActivity = Date()
            }
            session = current
            notifyListeners("partial", data: ["text": text])
            if result.isFinal { finish(reason: current.endReason.isEmpty ? "final" : current.endReason) }
        } else if error != nil {
            // Ending with no words comes back as an error ("No speech detected").
            let reason = current.latest == nil ? "silence" : (current.endReason.isEmpty ? "final" : current.endReason)
            finish(reason: reason, error: error)
        }
    }

    private func tick() {
        guard let current = session else { timer?.invalidate(); timer = nil; return }
        let now = Date()
        if let ended = current.endedAt {
            // The recogniser normally delivers the final result within a few hundred ms.
            if now.timeIntervalSince(ended) > 2.5 { finish(reason: current.endReason) }
            return
        }
        let elapsed = now.timeIntervalSince(current.startedAt)
        if elapsed > current.maxSeconds {
            endAudio(reason: "max")
        } else if current.heardSpeech && now.timeIntervalSince(current.lastActivity) > current.silenceSeconds {
            endAudio(reason: "pause")
        } else if !current.heardSpeech && elapsed > current.noSpeechSeconds {
            endAudio(reason: "silence")
        }
    }

    // Stops the microphone; the recogniser then delivers its final result.
    private func endAudio(reason: String) {
        guard var current = session, current.endedAt == nil else { return }
        current.endedAt = Date()
        current.endReason = reason
        session = current
        stopEngine()
        current.request.endAudio()
        notifyListeners("state", data: ["state": "checking"])
    }

    private func finish(reason: String, error: Error? = nil) {
        guard let current = session else { return }
        session = nil
        timer?.invalidate()
        timer = nil
        stopEngine()
        current.task?.cancel()
        restoreAudioSession()
        let now = Date()
        var alternatives: [JSObject] = []
        var segments: [JSObject] = []
        if let result = current.latest {
            for transcription in result.transcriptions {
                let confidences = transcription.segments.map { Double($0.confidence) }
                let mean = confidences.isEmpty ? 0 : confidences.reduce(0, +) / Double(confidences.count)
                alternatives.append(["text": transcription.formattedString, "confidence": mean])
            }
            for segment in result.bestTranscription.segments {
                segments.append([
                    "text": segment.substring,
                    "confidence": Double(segment.confidence),
                    "alternatives": segment.alternativeSubstrings
                ])
            }
        }
        var payload: JSObject = [
            "reason": reason,
            "onDevice": current.onDevice,
            "final": current.latest?.isFinal ?? false,
            "alternatives": alternatives,
            "segments": segments,
            "listenedMs": Int(((current.endedAt ?? now).timeIntervalSince(current.startedAt)) * 1000),
            "checkMs": current.endedAt.map { Int(now.timeIntervalSince($0) * 1000) } ?? 0
        ]
        if let error = error { payload["error"] = error.localizedDescription }
        notifyListeners("state", data: ["state": "idle"])
        current.call.resolve(payload)
    }

    private func stopEngine() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
    }

    // MARK: Audio session

    private func openAudioSession() throws {
        let audio = AVAudioSession.sharedInstance()
        if savedCategory == nil { savedCategory = (audio.category, audio.mode, audio.categoryOptions) }
        // defaultToSpeaker keeps the model word on the loudspeaker, not the earpiece, while recording.
        try audio.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try audio.setActive(true)
    }

    private func restoreAudioSession() {
        let audio = AVAudioSession.sharedInstance()
        try? audio.setActive(false, options: .notifyOthersOnDeactivation)
        if let (category, mode, options) = savedCategory {
            try? audio.setCategory(category, mode: mode, options: options)
            savedCategory = nil
        }
    }

    @objc private func interrupted(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
        DispatchQueue.main.async { self.endAudio(reason: "interrupted") }
    }

    private static func decibels(_ buffer: AVAudioPCMBuffer) -> Float {
        guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return -160 }
        var sum: Float = 0
        for i in 0..<Int(buffer.frameLength) { sum += samples[i] * samples[i] }
        let rms = sqrt(sum / Float(buffer.frameLength))
        return rms > 0 ? 20 * log10(rms) : -160
    }
}

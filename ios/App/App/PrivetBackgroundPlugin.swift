import Capacitor
import UIKit

// Extra time after leaving the app, so a print that's still being sent can finish instead of waiting for the
// app to come back (src/backgroundTime.ts). iOS grants about 30 seconds; sending a long strip takes about 4,
// and the printer prints the rest from its own memory. "expired" fires if iOS ends the time first.
@objc(PrivetBackgroundPlugin)
public class PrivetBackgroundPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrivetBackgroundPlugin"
    public let jsName = "PrivetBackground"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "begin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    private var task: UIBackgroundTaskIdentifier = .invalid

    @objc func begin(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.task == .invalid {
                self.task = UIApplication.shared.beginBackgroundTask(withName: "Privet print") { [weak self] in
                    self?.notifyListeners("expired", data: [:])
                    self?.finish()
                }
            }
            call.resolve(["granted": self.task != .invalid])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.finish()
            call.resolve()
        }
    }

    private func finish() {
        guard task != .invalid else { return }
        UIApplication.shared.endBackgroundTask(task)
        task = .invalid
    }
}

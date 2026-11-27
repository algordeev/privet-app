import ActivityKit
import Capacitor
import Foundation

// The Live Activity for a lesson or a review (src/useLessonActivity.ts). It starts when one opens, because iOS only lets an
// activity start while the app is in front; the island and Lock Screen show it only once you leave the app.
// Needs iOS 16.2; on older iPhones every call quietly does nothing.
@objc(PrivetLiveActivityPlugin)
public class PrivetLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrivetLiveActivityPlugin"
    public let jsName = "PrivetLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    /// An hour away and the card says the lesson is paused. iOS removes it by itself after about 8 hours.
    private static let staleAfter: TimeInterval = 60 * 60

    override public func load() {
        // Leftovers from a run that ended without closing its lesson (the app was quit, or crashed).
        guard #available(iOS 16.2, *) else { return }
        Task { await Self.endAll() }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false]); return
        }
        let attributes = PrivetLessonAttributes(
            lessonId: call.getString("lessonId") ?? "",
            title: call.getString("title") ?? ""
        )
        let state = Self.state(from: call)
        Task {
            await Self.endAll()
            do {
                _ = try Activity.request(attributes: attributes, content: Self.content(state), pushType: nil)
                call.resolve(["started": true])
            } catch {
                call.resolve(["started": false])
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let state = Self.state(from: call)
        Task {
            for activity in Activity<PrivetLessonAttributes>.activities {
                await activity.update(Self.content(state))
            }
            call.resolve()
        }
    }

    /// Closing or finishing the lesson ends it at once. (A finished card would never be seen: iOS hides an app's
    /// own Live Activity while the app is open, and a lesson is always finished inside the app.)
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            await Self.endAll()
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private static func endAll() async {
        for activity in Activity<PrivetLessonAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    @available(iOS 16.2, *)
    private static func content(_ state: PrivetLessonAttributes.ContentState) -> ActivityContent<PrivetLessonAttributes.ContentState> {
        ActivityContent(state: state, staleDate: Date().addingTimeInterval(staleAfter))
    }

    @available(iOS 16.1, *)
    private static func state(from call: CAPPluginCall) -> PrivetLessonAttributes.ContentState {
        PrivetLessonAttributes.ContentState(
            done: call.getInt("done") ?? 0,
            total: max(1, call.getInt("total") ?? 1)
        )
    }
}

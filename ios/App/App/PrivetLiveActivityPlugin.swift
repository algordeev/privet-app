import ActivityKit
import Capacitor
import Foundation

// Privet's Live Activities: a lesson or review in progress (src/useLessonActivity.ts), and printing
// (src/printActivity.ts). Each starts while the app is in front (the only time iOS allows it: when a lesson
// opens, or a print starts); the island and Lock Screen show it only once you leave the app.
// Needs iOS 16.2; on older iPhones every call quietly does nothing.
@objc(PrivetLiveActivityPlugin)
public class PrivetLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrivetLiveActivityPlugin"
    public let jsName = "PrivetLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startPrint", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "printPrinted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endPrint", returnType: CAPPluginReturnPromise),
    ]

    /// When both run at once, iOS puts the higher score in the Dynamic Island (and first on the Lock Screen):
    /// a print is short and needs attention when it ends, so it wins over the lesson (user's request, 2026-11-28).
    private static let printRelevance: Double = 100
    private static let lessonRelevance: Double = 50

    /// An hour away and the card says the lesson is paused. iOS removes it by itself after about 8 hours.
    private static let staleAfter: TimeInterval = 60 * 60

    override public func load() {
        // Leftovers from a run that ended without closing its lesson (the app was quit, or crashed).
        guard #available(iOS 16.2, *) else { return }
        Task {
            await Self.endAll()
            await Self.endPrints()
        }
    }

    // MARK: Printing (src/printActivity.ts). The island counts down to `endsAt` by itself; once it passes, the card
    // goes stale and reads "Printed". printPrinted makes that exact when the printer says it's done.

    @objc func startPrint(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false]); return
        }
        let seconds = max(2, call.getDouble("seconds") ?? 10)
        let now = Date()
        let state = PrivetPrintAttributes.ContentState(startedAt: now, endsAt: now.addingTimeInterval(seconds), printed: false)
        let attributes = PrivetPrintAttributes(title: call.getString("title") ?? "Card")
        Task {
            await Self.endPrints()
            do {
                _ = try Activity.request(attributes: attributes,
                                         content: ActivityContent(state: state, staleDate: state.endsAt, relevanceScore: Self.printRelevance),
                                         pushType: nil)
                call.resolve(["started": true])
            } catch {
                call.resolve(["started": false])
            }
        }
    }

    @objc func printPrinted(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for activity in Activity<PrivetPrintAttributes>.activities {
                var state = activity.content.state
                state.printed = true
                state.endsAt = min(state.endsAt, Date())
                await activity.update(ActivityContent(state: state, staleDate: nil, relevanceScore: Self.printRelevance))
            }
            call.resolve()
        }
    }

    @objc func endPrint(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            await Self.endPrints()
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private static func endPrints() async {
        for activity in Activity<PrivetPrintAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
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
        ActivityContent(state: state, staleDate: Date().addingTimeInterval(staleAfter), relevanceScore: lessonRelevance)
    }

    @available(iOS 16.1, *)
    private static func state(from call: CAPPluginCall) -> PrivetLessonAttributes.ContentState {
        PrivetLessonAttributes.ContentState(
            done: call.getInt("done") ?? 0,
            total: max(1, call.getInt("total") ?? 1)
        )
    }
}

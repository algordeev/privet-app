import ActivityKit
import Foundation

// The lesson Live Activity's data. Built into both the app (PrivetLiveActivityPlugin starts and updates it)
// and the PrivetWidgets extension (which draws it in the Dynamic Island and on the Lock Screen).
// Agreed 2026-11-27: https://claude.ai/artifact/8GBaqd68M3urexcsbjrhkT
@available(iOS 16.1, *)
struct PrivetLessonAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Steps finished so far, and the lesson's step count: "6/12".
        var done: Int
        var total: Int
    }

    var lessonId: String
    var lessonNumber: Int
    var lessonTitle: String
}

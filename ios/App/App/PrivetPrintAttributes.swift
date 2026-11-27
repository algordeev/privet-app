import ActivityKit
import Foundation

// The printing Live Activity's data, built into both the app (PrivetLiveActivityPlugin) and PrivetWidgets.
// Agreed 2026-11-27: https://claude.ai/artifact/8GBaqd68M3urexcsbjrhkT (section 1).
// The printer keeps most of a print in its own memory, so the paper takes far longer than the sending. The island
// counts down from the estimated finish by itself (iOS animates the timer), with no updates from the paused app.
@available(iOS 16.1, *)
struct PrivetPrintAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var startedAt: Date
        /// The estimated end, from the printer's learnt speed. Once it passes, the island says "Printed".
        var endsAt: Date
        /// The printer said it has finished.
        var printed: Bool
    }

    /// What's printing, as named in the print sheet: "Alphabet strip", "Word card", …
    var title: String
}

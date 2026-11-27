import SwiftUI
import WidgetKit

// Privet's widget extension: the lesson Live Activity and the printing one (no home-screen widget).
@main
struct PrivetWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PrivetWidgetsLiveActivity()
        PrivetPrintLiveActivity()
    }
}

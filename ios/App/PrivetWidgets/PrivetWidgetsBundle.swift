import SwiftUI
import WidgetKit

// Privet's widget extension. For now it holds only the lesson Live Activity (no home-screen widget).
@main
struct PrivetWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PrivetWidgetsLiveActivity()
    }
}

import ActivityKit
import SwiftUI
import WidgetKit

// The printing Live Activity: a little paper strip, a mint progress ring, and "Printed ✓ Tear it off" at the end.
// Agreed 2026-11-27: https://claude.ai/artifact/8GBaqd68M3urexcsbjrhkT (section 1). The data comes from
// App/PrivetPrintAttributes.swift. The progress ring, bar and countdown are driven by iOS from the start and the
// estimated end, so they keep moving while Privet is paused. The card reads "Printed" once the printer says so,
// or once the estimated end has passed (the card goes stale then).

/// A strip of receipt paper with a torn (zigzag) bottom edge.
private struct PaperShape: Shape {
    func path(in rect: CGRect) -> Path {
        let teeth = 4
        let tooth = rect.width / CGFloat(teeth)
        let depth = rect.height * 0.12
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY - depth))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + rect.width * 0.12))
        path.addQuadCurve(to: CGPoint(x: rect.minX + rect.width * 0.12, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - rect.width * 0.12, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + rect.width * 0.12), control: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - depth))
        for i in stride(from: teeth, to: 0, by: -1) {
            let x = rect.minX + CGFloat(i) * tooth
            path.addLine(to: CGPoint(x: x - tooth / 2, y: rect.maxY))
            path.addLine(to: CGPoint(x: x - tooth, y: rect.maxY - depth))
        }
        path.closeSubpath()
        return path
    }
}

private struct PaperStrip: View {
    var width: CGFloat
    var body: some View {
        ZStack(alignment: .top) {
            PaperShape().fill(Color(red: 0xf4 / 255, green: 0xf1 / 255, blue: 0xe6 / 255))
            Text("Аа")
                .font(.system(size: width * 0.42, weight: .bold))
                .foregroundStyle(Palette.screen)
                .padding(.top, width * 0.22)
        }
        .frame(width: width, height: width * 1.2)
    }
}

private extension ActivityViewContext where Attributes == PrivetPrintAttributes {
    var done: Bool { state.printed || isStale }
    var interval: ClosedRange<Date> { state.startedAt...max(state.endsAt, state.startedAt.addingTimeInterval(1)) }
}

/// The mint ring in the compact island: fills over the print, then a tick.
private struct PrintRing: View {
    let context: ActivityViewContext<PrivetPrintAttributes>
    var size: CGFloat = 22
    var body: some View {
        if context.done {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(Palette.mint)
        } else {
            ProgressView(timerInterval: context.interval, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.circular)
            .tint(Palette.mint)
            .frame(width: size, height: size)
        }
    }
}

/// "12 s left" while printing (iOS counts it down), "Tear it off" once it's done.
private struct PrintStatus: View {
    let context: ActivityViewContext<PrivetPrintAttributes>
    var body: some View {
        if context.done {
            Text("Printed ✓ Tear it off")
        } else {
            HStack(spacing: 4) {
                Text("Printing ·")
                Text(timerInterval: context.interval, countsDown: true).monospacedDigit()
                Text("left")
            }
        }
    }
}

private struct PrintBar: View {
    let context: ActivityViewContext<PrivetPrintAttributes>
    var body: some View {
        if context.done {
            Capsule().fill(Palette.mint).frame(height: 7)
        } else {
            ProgressView(timerInterval: context.interval, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.linear)
            .tint(Palette.mint)
        }
    }
}

struct PrivetPrintLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrivetPrintAttributes.self) { context in
            HStack(spacing: 14) {
                PaperStrip(width: 40)
                VStack(alignment: .leading, spacing: 6) {
                    Text(context.attributes.title).font(.system(size: 15.5, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                    PrintStatus(context: context).font(.system(size: 13)).foregroundStyle(Color.white.opacity(0.75))
                    PrintBar(context: context)
                }
                PrintRing(context: context, size: 26)
            }
            .padding(16)
            .activityBackgroundTint(Color.black.opacity(0.72))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    PaperStrip(width: 38).padding(.leading, 6).padding(.top, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    PrintRing(context: context, size: 28).padding(.trailing, 6).padding(.top, 8)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.title).font(.system(size: 15, weight: .semibold)).lineLimit(1)
                        PrintStatus(context: context).font(.system(size: 13)).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 12) {
                        PrintBar(context: context)
                        // Opens Privet's print sheet, where Cancel is.
                        Text(context.done ? "Open" : "Cancel")
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Palette.track, in: Capsule())
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 4).padding(.top, 6)
                }
            } compactLeading: {
                PaperStrip(width: 18).padding(.leading, 2)
            } compactTrailing: {
                PrintRing(context: context)
            } minimal: {
                PrintRing(context: context)
            }
            .keylineTint(Palette.mint)
        }
    }
}

@available(iOS 17.0, *)
#Preview("Lock Screen", as: .content, using: PrivetPrintAttributes(title: "Alphabet strip")) {
    PrivetPrintLiveActivity()
} contentStates: {
    PrivetPrintAttributes.ContentState(startedAt: .now, endsAt: .now.addingTimeInterval(20), printed: false)
    PrivetPrintAttributes.ContentState(startedAt: .now, endsAt: .now, printed: true)
}

import ActivityKit
import SwiftUI
import WidgetKit

// The lesson (or review) Live Activity: the coral robot head with its green OLED face, and your place in it.
// Agreed 2026-11-27: https://claude.ai/artifact/8GBaqd68M3urexcsbjrhkT. The data comes from
// App/PrivetLessonAttributes.swift. It doesn't show the companion (the user dropped that line, 2026-11-27), so it
// looks the same whichever companion is connected, or none.
// Live Activities can't animate continuously, so the face changes only with the state:
// awake, or sleepy once the lesson has been left for an hour.

// Shared by both Live Activities (the lesson and printing).
enum Palette {
    static let coralLight = Color(red: 0xf6 / 255, green: 0xa1 / 255, blue: 0x8a / 255)
    static let coral = Color(red: 0xe6 / 255, green: 0x81 / 255, blue: 0x69 / 255)
    static let coralShade = Color(red: 0xc9 / 255, green: 0x6c / 255, blue: 0x55 / 255)
    static let screen = Color(red: 0x16 / 255, green: 0x2b / 255, blue: 0x22 / 255)
    static let face = Color(red: 0xd0 / 255, green: 0xf5 / 255, blue: 0xa5 / 255)
    static let mint = Color(red: 0x3f / 255, green: 0xd4 / 255, blue: 0x9a / 255)
    static let mintInk = Color(red: 0x08 / 255, green: 0x28 / 255, blue: 0x1c / 255)
    static let track = Color(red: 0x2a / 255, green: 0x3a / 255, blue: 0x33 / 255)
    static let muted = Color(red: 0xa7 / 255, green: 0xb0 / 255, blue: 0xa9 / 255)
}

private enum Mood { case awake, sleepy }

/// Privet's robot head: a coral block with a dark screen and two green eyes.
private struct RobotHead: View {
    var width: CGFloat
    var mood: Mood = .awake

    var body: some View {
        let height = width * 0.8
        let eyeGap = width * 0.2
        ZStack {
            RoundedRectangle(cornerRadius: width * 0.26, style: .continuous)
                .fill(LinearGradient(colors: [Palette.coralLight, Palette.coral], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: width * 0.26, style: .continuous)
                        .fill(Palette.coralShade).frame(height: height * 0.12).opacity(0.7).mask(
                            RoundedRectangle(cornerRadius: width * 0.26, style: .continuous).frame(height: height * 0.12))
                }
            RoundedRectangle(cornerRadius: width * 0.13, style: .continuous)
                .fill(Palette.screen)
                .padding(.horizontal, width * 0.13)
                .padding(.top, height * 0.15)
                .padding(.bottom, height * 0.21)
            HStack(spacing: eyeGap) {
                eye
                eye
            }
            .offset(y: -height * 0.03)
        }
        .frame(width: width, height: height)
    }

    @ViewBuilder private var eye: some View {
        switch mood {
        case .awake:
            Capsule().fill(Palette.face)
                .frame(width: width * 0.12, height: width * 0.17)
                .shadow(color: Palette.face.opacity(0.6), radius: width * 0.04)
        case .sleepy:
            Capsule().fill(Palette.face.opacity(0.7))
                .frame(width: width * 0.15, height: max(1.5, width * 0.04))
        }
    }
}

private extension ActivityViewContext where Attributes == PrivetLessonAttributes {
    var mood: Mood {
        if isStale { return .sleepy }
        return .awake
    }
    var stepText: String { "\(state.done)/\(state.total)" }
    var fraction: Double { Double(min(state.done, state.total)) / Double(max(1, state.total)) }
    var title: String { attributes.title }
}

private struct ProgressBar: View {
    var fraction: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.track)
                Capsule().fill(Palette.mint).frame(width: max(7, geo.size.width * fraction))
            }
        }
        .frame(height: 7)
    }
}

struct PrivetWidgetsLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrivetLessonAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.72))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    RobotHead(width: 46, mood: context.mood).padding(.leading, 4).padding(.top, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(context.stepText).font(.system(size: 22, weight: .bold)).monospacedDigit().foregroundStyle(Palette.mint)
                        Text("steps").font(.caption).foregroundStyle(Palette.muted)
                    }
                    .padding(.trailing, 4).padding(.top, 2)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.title).font(.system(size: 15, weight: .semibold)).lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 14)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 12) {
                        ProgressBar(fraction: context.fraction)
                        Text("Continue")
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Palette.mint, in: Capsule())
                            .foregroundStyle(Palette.mintInk)
                    }
                    .padding(.horizontal, 4).padding(.top, 6)
                }
            } compactLeading: {
                RobotHead(width: 24, mood: context.mood).padding(.leading, 2)
            } compactTrailing: {
                Text(context.stepText).font(.system(size: 14, weight: .semibold)).monospacedDigit().foregroundStyle(Palette.mint)
            } minimal: {
                RobotHead(width: 20, mood: context.mood)
            }
            .keylineTint(Palette.mint)
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<PrivetLessonAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                RobotHead(width: 46, mood: context.mood)
                Text(context.title).font(.system(size: 15.5, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                Spacer(minLength: 8)
                Text(context.stepText).font(.system(size: 17, weight: .semibold)).monospacedDigit().foregroundStyle(Palette.mint)
            }
            ProgressBar(fraction: context.fraction)
        }
        .padding(16)
    }
}

// Xcode previews of the Lock Screen card (halfway through a lesson). Previews need iOS 17.
@available(iOS 17.0, *)
#Preview("Lock Screen", as: .content, using: PrivetLessonAttributes(lessonId: "daily-life", title: "Lesson 5 · Daily life")) {
    PrivetWidgetsLiveActivity()
} contentStates: {
    PrivetLessonAttributes.ContentState(done: 6, total: 12)
}

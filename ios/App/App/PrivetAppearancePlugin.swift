import UIKit
import Capacitor

// Settings › Appearance on the iOS side. The web page draws its own light or dark theme; this makes
// iOS match it, so the status bar, the keyboard and system sheets follow the app's choice even when
// it differs from the iPhone's setting. "system" hands the choice back to the iPhone.
@objc(PrivetAppearancePlugin)
public class PrivetAppearancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrivetAppearancePlugin"
    public let jsName = "PrivetAppearance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    @objc func set(_ call: CAPPluginCall) {
        let style: UIUserInterfaceStyle
        switch call.getString("appearance") {
        case "light": style = .light
        case "dark": style = .dark
        default: style = .unspecified
        }
        DispatchQueue.main.async {
            self.bridge?.viewController?.view.window?.overrideUserInterfaceStyle = style
            call.resolve()
        }
    }
}

// What shows behind the web page (at launch, and past its edges): the app's page colour in light,
// Graphite in dark. Keep in step with src/darkColours.ts (GRAPHITE.bg) and the light paper #f8f6f0.
extension UIColor {
    static let privetPage = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x1a / 255, green: 0x1c / 255, blue: 0x1d / 255, alpha: 1)
            : UIColor(red: 0xf8 / 255, green: 0xf6 / 255, blue: 0xf0 / 255, alpha: 1)
    }
}

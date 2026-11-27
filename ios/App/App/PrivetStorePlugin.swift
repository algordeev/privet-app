import Foundation
import Capacitor
import StoreKit

// Privet Plus through StoreKit 2. Apple keeps the subscription state; the app asks for it on
// every launch and after every change, so there is no server and no account. Only transactions
// StoreKit has verified count.
@objc(PrivetStorePlugin)
public class PrivetStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrivetStorePlugin"
    public let jsName = "PrivetStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]

    private var updates: Task<Void, Never>?
    private let iso = ISO8601DateFormatter()

    override public func load() {
        // Renewals, refunds, Ask to Buy approvals and purchases made on another device arrive here.
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
                await self?.notifyEntitlements()
            }
        }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result { await transaction.finish() }
            }
        }
    }

    deinit { updates?.cancel() }

    @objc func products(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let found = try await Product.products(for: ids)
                var list: [JSObject] = []
                for product in found { list.append(await self.describe(product)) }
                call.resolve(["products": list])
            } catch {
                call.reject("Could not load products", "PRODUCTS", error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("Missing product id", "ARGUMENT") }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    return call.reject("Unknown product", "UNKNOWN_PRODUCT")
                }
                let status: String
                switch try await product.purchase() {
                case .success(.verified(let transaction)):
                    await transaction.finish()
                    status = "purchased"
                case .success(.unverified):
                    status = "unverified"
                case .pending:
                    status = "pending" // Ask to Buy or a payment that needs action; arrives later as an update.
                case .userCancelled:
                    status = "cancelled"
                @unknown default:
                    status = "cancelled"
                }
                call.resolve(["status": status, "entitlements": await self.currentEntitlements()])
            } catch {
                call.reject("Purchase failed", "PURCHASE", error)
            }
        }
    }

    @objc func entitlements(_ call: CAPPluginCall) {
        Task { call.resolve(["entitlements": await self.currentEntitlements()]) }
    }

    // Only from the Restore button: it can ask the user to sign in to their Apple Account.
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["entitlements": await self.currentEntitlements()])
            } catch {
                call.reject("Restore failed", "RESTORE", error)
            }
        }
    }

    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                return call.reject("No window", "NO_WINDOW")
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject("Could not open subscriptions", "MANAGE", error)
            }
        }
    }

    private func notifyEntitlements() async {
        notifyListeners("entitlementsChanged", data: ["entitlements": await currentEntitlements()])
    }

    // Active, verified, not refunded auto-renewable subscriptions, with whether each one renews.
    private func currentEntitlements() async -> [JSObject] {
        var list: [JSObject] = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  transaction.productType == .autoRenewable,
                  transaction.revocationDate == nil else { continue }
            var item: JSObject = [
                "productId": transaction.productID,
                "purchaseDate": iso.string(from: transaction.purchaseDate)
            ]
            if let expires = transaction.expirationDate { item["expirationDate"] = iso.string(from: expires) }
            if let renews = await willAutoRenew(transaction) { item["willAutoRenew"] = renews }
            list.append(item)
        }
        return list
    }

    private func willAutoRenew(_ transaction: Transaction) async -> Bool? {
        guard let product = try? await Product.products(for: [transaction.productID]).first,
              let statuses = try? await product.subscription?.status else { return nil }
        for status in statuses {
            guard case .verified(let renewal) = status.renewalInfo,
                  renewal.currentProductID == transaction.productID || renewal.autoRenewPreference == transaction.productID,
                  case .verified(let latest) = status.transaction,
                  latest.originalID == transaction.originalID else { continue }
            return renewal.willAutoRenew
        }
        return nil
    }

    private func describe(_ product: Product) async -> JSObject {
        var item: JSObject = [
            "id": product.id,
            "displayName": product.displayName,
            "displayPrice": product.displayPrice,
            "price": NSDecimalNumber(decimal: product.price).doubleValue,
            "currency": product.priceFormatStyle.currencyCode,
            // How the store writes prices ("en-US"), so prices the app works out match displayPrice.
            "locale": (product.priceFormatStyle.locale.identifier.split(separator: "@").first.map(String.init) ?? "")
                .replacingOccurrences(of: "_", with: "-")
        ]
        if let subscription = product.subscription {
            item["period"] = period(subscription.subscriptionPeriod)
            item["introEligible"] = await subscription.isEligibleForIntroOffer
            if let offer = subscription.introductoryOffer {
                item["introOffer"] = [
                    "displayPrice": offer.displayPrice,
                    "paymentMode": paymentMode(offer.paymentMode),
                    "period": period(offer.period),
                    "periodCount": offer.periodCount
                ] as JSObject
            }
        }
        return item
    }

    private func period(_ period: Product.SubscriptionPeriod) -> JSObject {
        let unit: String
        switch period.unit {
        case .day: unit = "day"
        case .week: unit = "week"
        case .month: unit = "month"
        case .year: unit = "year"
        @unknown default: unit = "day"
        }
        return ["unit": unit, "value": period.value]
    }

    private func paymentMode(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payUpFront: return "payUpFront"
        default: return "payAsYouGo"
        }
    }
}

// The app's own bridge, so the in-app plugin above is registered next to the npm plugins.
class PrivetBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PrivetStorePlugin())
        bridge?.registerPluginInstance(PrivetSpeechPlugin())
        bridge?.registerPluginInstance(PrivetAppearancePlugin())
        bridge?.registerPluginInstance(PrivetLiveActivityPlugin())
        bridge?.registerPluginInstance(PrivetBackgroundPlugin())
        // Behind the page: the app's page colour, light or dark (not a fixed cream).
        view.backgroundColor = .privetPage
        webView?.backgroundColor = .privetPage
        webView?.scrollView.backgroundColor = .privetPage
    }
}

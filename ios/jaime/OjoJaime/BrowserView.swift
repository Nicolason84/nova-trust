import SwiftUI
import WebKit
import UIKit

struct BrowserView: UIViewRepresentable {
    @ObservedObject var model: BrowserModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 248.0/255, green: 247.0/255, blue: 242.0/255, alpha: 1)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isInspectable = false
        model.webView = webView
        context.coordinator.webView = webView
        webView.load(URLRequest(url: URLPolicy.home))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        let model: BrowserModel
        weak var webView: WKWebView?
        private var downloads: [ObjectIdentifier: URL] = [:]
        private var privacyWindow: UIWindow?
        private let exportRoot = FileManager.default.temporaryDirectory.appendingPathComponent("ojo-jaime-exports", isDirectory: true)

        init(model: BrowserModel) {
            self.model = model
            super.init()
            NotificationCenter.default.addObserver(self, selector: #selector(obscureSnapshots),
                name: UIApplication.willResignActiveNotification, object: nil)
            NotificationCenter.default.addObserver(self, selector: #selector(revealSnapshots),
                name: UIApplication.didBecomeActiveNotification, object: nil)
            // This private temporary folder contains only exports made by this shell.
            // Remove any abandoned export from a previous process; never touch web data.
            try? FileManager.default.removeItem(at: exportRoot)
        }

        deinit { NotificationCenter.default.removeObserver(self) }

        @objc private func obscureSnapshots() {
            guard privacyWindow == nil, let scene = webView?.window?.windowScene else { return }
            // A separate scene window also covers native export sheets and JS dialogs.
            // Do not make it key: preserve the user's keyboard / focus on return.
            let window = UIWindow(windowScene: scene)
            window.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)
            let controller = UIViewController()
            controller.view.backgroundColor = UIColor(red: 23.0/255, green: 63.0/255, blue: 53.0/255, alpha: 1)
            let label = UILabel()
            label.text = "ojO"
            label.textColor = .white
            label.font = .systemFont(ofSize: 64, weight: .bold)
            label.translatesAutoresizingMaskIntoConstraints = false
            controller.view.addSubview(label)
            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: controller.view.centerXAnchor),
                label.centerYAnchor.constraint(equalTo: controller.view.centerYAnchor)
            ])
            window.rootViewController = controller
            privacyWindow = window
            window.isHidden = false
        }

        @objc private func revealSnapshots() {
            privacyWindow?.isHidden = true
            privacyWindow?.rootViewController = nil
            privacyWindow = nil
        }

        private var presenter: UIViewController? {
            var responder: UIResponder? = webView
            while let current = responder {
                if let controller = current as? UIViewController {
                    var front = controller
                    while let presented = front.presentedViewController { front = presented }
                    return front
                }
                responder = current.next
            }
            return nil
        }

        private func trustedFrame(_ frame: WKFrameInfo) -> Bool {
            frame.isMainFrame && frame.request.url.map(URLPolicy.isApp) == true
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if URLPolicy.isApp(url) {
                if action.shouldPerformDownload && trustedFrame(action.sourceFrame) {
                    decisionHandler(.download)
                } else if action.targetFrame == nil {
                    decisionHandler(.cancel)
                    webView.load(action.request)
                } else { decisionHandler(.allow) }
                return
            }
            if URLPolicy.isAppBlob(url), trustedFrame(action.sourceFrame), action.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            if ["tel", "mailto"].contains(url.scheme?.lowercased() ?? ""), trustedFrame(action.sourceFrame) {
                decisionHandler(.cancel)
                if action.navigationType == .linkActivated { UIApplication.shared.open(url) }
                else { confirmExternalComposer(url) }
                return
            }
            // External pages never enter the app's web data store or get native grants.
            // Only a real link activation from our top-level page may leave the app.
            if action.navigationType == .linkActivated, trustedFrame(action.sourceFrame) {
                if URLPolicy.isExternalHTTPS(url) {
                    decisionHandler(.cancel)
                    UIApplication.shared.open(url)
                    return
                }
            }
            decisionHandler(.cancel)
        }

        private func confirmExternalComposer(_ url: URL) {
            // Existing email drafts use window.location.href, which is navigation .other.
            // A native confirmation preserves that workflow without auto-launching apps.
            guard let presenter, !(presenter is UIAlertController) else { return }
            let mail = url.scheme?.lowercased() == "mailto"
            let alert = UIAlertController(title: mail ? "¿Abrir tu correo?" : "¿Abrir el teléfono?",
                message: mail ? "Se preparará un borrador para que lo revises. Tú decides si lo envías." : "Podrás revisar el número antes de llamar.",
                preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
            alert.addAction(UIAlertAction(title: "Abrir", style: .default) { _ in UIApplication.shared.open(url) })
            presenter.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            guard let url = response.response.url, URLPolicy.isApp(url) else {
                decisionHandler(.cancel); return
            }
            if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 400 {
                model.failure = "No se ha podido abrir esta página. Comprueba la conexión y vuelve a intentarlo."
                model.loading = false
                decisionHandler(.cancel)
            } else { decisionHandler(response.canShowMIMEType ? .allow : .download) }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.failure = nil; model.loading = true; model.canGoBack = webView.canGoBack
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.failure = nil; model.loading = false; model.canGoBack = webView.canGoBack
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            fail(error)
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            model.loading = false
            model.failure = "iOS ha cerrado esta página para liberar memoria. Puedes volver a abrirla."
        }
        private func fail(_ error: Error) {
            model.loading = false
            if (error as NSError).code != NSURLErrorCancelled {
                model.failure = "No se ha podido cargar tu espacio. Comprueba la conexión y vuelve a intentarlo."
            }
        }

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            let allowed = origin.protocol == "https" && origin.host.lowercased() == URLPolicy.host &&
                (origin.port == 0 || origin.port == 443) && trustedFrame(frame)
            decisionHandler(allowed ? .prompt : .deny)
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            guard trustedFrame(frame), let presenter else { completionHandler(); return }
            let alert = UIAlertController(title: "ojO Jaime", message: String(message.prefix(3000)), preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in completionHandler() })
            presenter.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            guard trustedFrame(frame), let presenter else { completionHandler(false); return }
            let alert = UIAlertController(title: "ojO Jaime", message: String(message.prefix(3000)), preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "Confirmar", style: .default) { _ in completionHandler(true) })
            presenter.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                     defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (String?) -> Void) {
            guard trustedFrame(frame), let presenter else { completionHandler(nil); return }
            let alert = UIAlertController(title: "ojO Jaime", message: String(prompt.prefix(1000)), preferredStyle: .alert)
            alert.addTextField { $0.text = defaultText }
            alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(nil) })
            alert.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
            presenter.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            model.loading = false; download.delegate = self
        }
        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            model.loading = false; download.delegate = self
        }
        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                      suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            guard let url = response.url, (URLPolicy.isApp(url) || URLPolicy.isAppBlob(url)),
                  response.expectedContentLength <= 64 * 1024 * 1024 else { completionHandler(nil); return }
            let folder = exportRoot.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
                    attributes: [.protectionKey: FileProtectionType.complete])
                let file = folder.appendingPathComponent(URLPolicy.safeFilename(suggestedFilename))
                downloads[ObjectIdentifier(download)] = file
                completionHandler(file)
            } catch { completionHandler(nil) }
        }
        func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse,
                      newRequest request: URLRequest, decisionHandler: @escaping (WKDownload.RedirectPolicy) -> Void) {
            decisionHandler(request.url.map(URLPolicy.isApp) == true ? .allow : .cancel)
        }
        func downloadDidFinish(_ download: WKDownload) {
            guard let file = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
            guard let presenter else { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()); return }
            try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: file.path)
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.completionWithItemsHandler = { _, _, _, _ in
                try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
            }
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
            }
            presenter.present(sheet, animated: true)
        }
        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            if let file = downloads.removeValue(forKey: ObjectIdentifier(download)) {
                try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
            }
            guard let presenter else { return }
            let alert = UIAlertController(title: "No se ha podido preparar el archivo",
                message: "El original sigue en tu espacio. Puedes volver a intentarlo.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Aceptar", style: .default))
            presenter.present(alert, animated: true)
        }
    }
}

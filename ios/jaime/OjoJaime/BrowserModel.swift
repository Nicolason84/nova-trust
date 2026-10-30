import SwiftUI
import WebKit
import Network

@MainActor
final class BrowserModel: ObservableObject {
    @Published var loading = false
    @Published var canGoBack = false
    @Published var online = true
    @Published var failure: String?
    weak var webView: WKWebView?
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "ojO.Jaime.network")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            Task { @MainActor [weak self] in self?.online = connected }
        }
        monitor.start(queue: queue)
    }

    deinit { monitor.cancel() }

    func goBack() { if webView?.canGoBack == true { failure = nil; webView?.goBack() } }
    func goHome() { failure = nil; webView?.load(URLRequest(url: URLPolicy.home)) }
    func reload() {
        failure = nil
        if let url = webView?.url, URLPolicy.isApp(url) { webView?.reload() }
        else { goHome() }
    }
    func stopCapture() {
        webView?.setCameraCaptureState(.none, completionHandler: nil)
        webView?.setMicrophoneCaptureState(.none, completionHandler: nil)
        webView?.pauseAllMediaPlayback(completionHandler: nil)
    }
}

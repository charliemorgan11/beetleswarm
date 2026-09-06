import SwiftUI
import WebKit

@main
struct BeetleSwarmApp: App {
    var body: some Scene {
        WindowGroup {
            GameScreen()
                .ignoresSafeArea()
                .statusBarHidden(true)
        }
    }
}

private struct GameScreen: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> GameViewController {
        GameViewController()
    }

    func updateUIViewController(_ uiViewController: GameViewController, context: Context) {}
}

private final class GameViewController: UIViewController, WKNavigationDelegate {
    private var webView: WKWebView!
    private var webRoot: URL?
    private var isPresentingError = false
    override var prefersStatusBarHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 48 / 255, green: 32 / 255, blue: 23 / 255, alpha: 1)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        NotificationCenter.default.addObserver(self, selector: #selector(pauseGame),
            name: UIApplication.willResignActiveNotification, object: nil)
        loadGame()
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    @objc private func pauseGame() {
        webView.evaluateJavaScript("window.beetleNative?.pause()", completionHandler: nil)
    }

    private func loadGame() {
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path)
        else { showLoadError(); return }
        webRoot = root.standardizedFileURL
        webView.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL, let root = webRoot,
           url.standardizedFileURL.path.hasPrefix(root.path + "/") {
            decisionHandler(.allow)
            return
        }
        if url.scheme == "mailto", navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) { showLoadError() }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!,
                 withError error: Error) { showLoadError() }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { loadGame() }

    private func showLoadError() {
        guard !isPresentingError else { return }
        isPresentingError = true
        let alert = UIAlertController(title: "Chart Lost",
            message: "The chart could not be opened. Try starting a new voyage.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Try Again", style: .default) { [weak self] _ in
            self?.isPresentingError = false
            self?.loadGame()
        })
        present(alert, animated: true)
    }
}

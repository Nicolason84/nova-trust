import Foundation

@main
enum PolicyChecks {
    static func main() {
        var count = 0
        func check(_ condition: @autoclosure () -> Bool, _ message: String) {
            count += 1
            guard condition() else { fatalError("FAIL: \(message)") }
        }
        func u(_ value: String) -> URL { URL(string: value)! }
        check(URLPolicy.isApp(URLPolicy.home), "home allowed")
        check(URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime/taurino.html")), "taurino allowed")
        check(URLPolicy.isApp(u("https://nicolason84.github.io:443/nova-trust/jaime/index.html?tab=files#top")), "default https port and local query allowed")
        check(!URLPolicy.isApp(u("http://nicolason84.github.io/nova-trust/jaime/")), "http denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io.evil.example/nova-trust/jaime/")), "lookalike host denied")
        check(!URLPolicy.isApp(u("https://other.github.io/nova-trust/jaime/")), "other GitHub owner denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime-evil/")), "prefix confusion denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime/../private/")), "dot traversal denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime/%2e%2e/private/")), "encoded traversal denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime/%252e%252e/private/")), "double encoded traversal denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime/%2Fprivate")), "encoded separator denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime/%5Cprivate")), "encoded backslash denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io/nova-trust/jaime/%00private")), "null byte denied")
        check(!URLPolicy.isApp(u("https://user:secret@nicolason84.github.io/nova-trust/jaime/")), "credentials denied")
        check(!URLPolicy.isApp(u("https://nicolason84.github.io:8443/nova-trust/jaime/")), "alternate port denied")
        check(!URLPolicy.isApp(u("file:///nova-trust/jaime/index.html")), "local file navigation denied")
        check(!URLPolicy.isApp(u("javascript:alert(1)")), "JavaScript scheme denied")
        check(URLPolicy.isAppBlob(u("blob:https://nicolason84.github.io/87adc5e7-88d9-4128-ae01-102e9a2fed03")), "same-origin export blob allowed")
        check(!URLPolicy.isAppBlob(u("blob:https://evil.example/abc")), "foreign blob denied")
        check(!URLPolicy.isAppBlob(u("blob:https://user@nicolason84.github.io/abc")), "credential blob denied")
        check(!URLPolicy.isAppBlob(u("blob:http://nicolason84.github.io/abc")), "insecure blob denied")
        check(!URLPolicy.isAppBlob(u("blob:https://nicolason84.github.io:8443/abc")), "foreign port blob denied")
        check(URLPolicy.isExternalHTTPS(u("https://www.las-ventas.com/resena-tarde/111001")), "official external https accepted for user-initiated Safari")
        check(!URLPolicy.isExternalHTTPS(u("https://user:secret@example.com/")), "external credential URL denied")
        check(!URLPolicy.isExternalHTTPS(u("javascript:alert(1)")), "external JavaScript denied")
        check(URLPolicy.safeFilename("../../secret.json") == "....secret.json", "filename cannot traverse")
        check(URLPolicy.safeFilename("..") == "archivo", "parent filename denied")
        check(URLPolicy.safeFilename("\n \t") == "archivo", "empty cleaned filename fallback")
        check(URLPolicy.safeFilename("nota:Jaime\\uno/voz.m4a") == "notaJaimeunovoz.m4a", "reserved filename separators removed")
        check(URLPolicy.safeFilename(String(repeating: "x", count: 300)).count == 160, "filename bounded")
        check(URLPolicy.safeFilename(String(repeating: "文", count: 160)).utf8.count <= 200, "Unicode filename bounded in filesystem bytes")
        print("PASS: \(count) native navigation / export policy checks")
    }
}

import Foundation

/// One web origin, one app subtree. No native message bridge or URL-supplied server.
enum URLPolicy {
    static let host = "nicolason84.github.io"
    static let root = "/nova-trust/jaime"
    static let home = URL(string: "https://nicolason84.github.io/nova-trust/jaime/start.html")!

    static func isApp(_ url: URL) -> Bool {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme?.lowercased() == "https", parts.host?.lowercased() == host,
              parts.user == nil, parts.password == nil,
              parts.port == nil || parts.port == 443 else { return false }
        let encoded = parts.percentEncodedPath.lowercased()
        guard !["%2f", "%5c", "%00", "%2e", "%25"].contains(where: encoded.contains) else { return false }
        let path = parts.path
        guard !path.contains("\\"), !path.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }),
              !path.split(separator: "/").contains(where: { $0 == "." || $0 == ".." }) else { return false }
        return path == root || path.hasPrefix(root + "/")
    }

    static func isAppBlob(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "blob" else { return false }
        let value = String(url.absoluteString.dropFirst(5))
        guard let parts = URLComponents(string: value),
              parts.scheme == "https", parts.host?.lowercased() == host,
              parts.user == nil, parts.password == nil,
              parts.port == nil || parts.port == 443,
              parts.query == nil, parts.fragment == nil,
              parts.path.count > 1 else { return false }
        return true
    }

    static func isExternalHTTPS(_ url: URL) -> Bool {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme?.lowercased() == "https", let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil else { return false }
        return !url.absoluteString.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 })
    }

    static func safeFilename(_ proposed: String) -> String {
        let scalars = proposed.unicodeScalars.filter { scalar in
            scalar.value >= 32 && scalar.value != 127 && !"/\\:".unicodeScalars.contains(scalar)
        }
        let value = String(String.UnicodeScalarView(scalars)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, value != ".", value != ".." else { return "archivo" }
        var bounded = ""
        for character in value.prefix(160) {
            if bounded.utf8.count + String(character).utf8.count > 200 { break }
            bounded.append(character)
        }
        return bounded.isEmpty ? "archivo" : bounded
    }
}

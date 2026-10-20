import Foundation
import Combine
import CoreFoundation

enum CanonError: Error { case invalid, stale, conflict }
struct Canon {
    let raw: Data
    let object: [String: Any]
    let sequence: Int
    let id: String
    let date: Date
    static let url = URL(string: "https://nicolason84.github.io/nova-trust/data/france-debt-rate-live.json")!
    static let country = "OJO_FRANCE_ORGANISM_V1#/identity"
    static let system = "OJO_FRANCE_ORGANISM_V1#/physiology/systems/finance"
    init(_ raw: Data) throws {
        guard raw.count <= 2_000_000,
              let d = try JSONSerialization.jsonObject(with: raw) as? [String: Any],
              d["schema"] as? String == "OJO_FRANCE_DEBT_RATE_LIVE_V1",
              let n = d["sequence"] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(),
              n.doubleValue == Double(n.intValue), n.intValue >= 0,
              let id = d["snapshot_id"] as? String, !id.isEmpty,
              let at = d["updated_at"] as? String, let date = ISO8601DateFormatter().date(from: at),
              date.timeIntervalSinceNow < 300,
              let binding = d["france_binding"] as? [String: Any],
              binding["country_object_id"] as? String == Self.country,
              binding["system_id"] as? String == Self.system,
              binding["organ_id"] as? String == "OJO_FRANCE_DEBT_RATE_LIVE_V1",
              binding["territorial_scope"] as? String == "NATIONAL_ONLY",
              let territorial = binding["territorial_imputation"] as? NSNumber,
              CFGetTypeID(territorial) == CFBooleanGetTypeID(), territorial.boolValue == false,
              binding["output_id"] as? String == "EXECUTIVE_OUTPUT",
              let policy = d["policy"] as? [String: Any],
              policy["political_recommendation"] as? String == "NONE",
              let claims = d["claims"] as? [[String: Any]], !claims.isEmpty,
              let sources = d["sources"] as? [[String: Any]], !sources.isEmpty,
              d["observed"] is [String: Any], d["evidence_graph"] is [String: Any] else { throw CanonError.invalid }
        var ids = Set<String>()
        for c in claims {
            guard let key = c["claim_id"] as? String, ids.insert(key).inserted,
                  let type = c["type"] as? String,
                  ["OBSERVED", "DERIVED", "HYPOTHESIS", "STRESS", "UNKNOWN"].contains(type),
                  c["country_object_id"] as? String == Self.country,
                  c["organ_id"] as? String == "OJO_FRANCE_DEBT_RATE_LIVE_V1",
                  c["system_id"] as? String == Self.system,
                  c["output_id"] as? String == "EXECUTIVE_OUTPUT",
                  c["proof"] is [[String: Any]] else { throw CanonError.invalid }
        }
        self.raw = raw; object = d; sequence = n.intValue; self.id = id; self.date = date
    }
    func checkReplacement(_ old: Canon?) throws {
        guard let old else { return }
        if sequence < old.sequence || date < old.date { throw CanonError.stale }
        if sequence == old.sequence {
            if !(object as NSDictionary).isEqual(to: old.object) { throw CanonError.conflict }
        } else if date <= old.date { throw CanonError.stale }
    }
    func value(_ path: String) -> Any? {
        path.split(separator: ".").reduce(object as Any?) { v, k in (v as? [String: Any])?[String(k)] }
    }
    func text(_ path: String) -> String { value(path) as? String ?? "Inconnu" }
    func number(_ path: String, decimals: Int = 1, suffix: String = "") -> String {
        guard let n = value(path) as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite else { return "Inconnu" }
        let f = NumberFormatter(); f.locale = Locale(identifier: "fr_FR"); f.minimumFractionDigits = decimals; f.maximumFractionDigits = decimals
        return (f.string(from: n) ?? "Inconnu") + suffix
    }
    var claims: [[String: Any]] { object["claims"] as? [[String: Any]] ?? [] }
    var sources: [[String: Any]] { object["sources"] as? [[String: Any]] ?? [] }
    var curve: [[String: Any]] { value("observed.yield_curve") as? [[String: Any]] ?? [] }
}

@MainActor final class CanonStore: ObservableObject {
    @Published var canon: Canon?
    @Published var transport = "Chargement du canon…"
    @Published var busy = false
    private let cache: URL
    private let session: URLSession
    private var cacheVerified = false
    init(cache: URL? = nil, seed: Data? = nil, session: URLSession = .shared) {
        self.cache = cache ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("france-canonical-projection-v1.json")
        self.session = session
        let fallback = seed ?? Bundle.main.url(forResource: "canonical-seed", withExtension: "json").flatMap { try? Data(contentsOf: $0) }
        if let raw = try? Data(contentsOf: self.cache), let c = try? Canon(raw) { canon = c; cacheVerified = true; transport = "Cache vérifié · âge conservé" }
        else if let raw = fallback, let c = try? Canon(raw) { canon = c; transport = "Snapshot fourni avec ce build · âge conservé" }
    }
    func refresh() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            var request = URLRequest(url: Canon.url); request.timeoutInterval = 15; request.cachePolicy = .reloadIgnoringLocalCacheData
            let (raw, response) = try await session.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw CanonError.invalid }
            let next = try Canon(raw); try next.checkReplacement(canon)
            if let current = canon, next.sequence == current.sequence {
                if !cacheVerified { try current.raw.write(to: cache, options: .atomic); cacheVerified = true }
                transport = "Canon revérifié · même snapshot et âge conservé"
                return
            }
            try raw.write(to: cache, options: .atomic); cacheVerified = true; canon = next; transport = "Canon récupéré · états de preuve inchangés"
        } catch { transport = canon == nil ? "Canon indisponible · aucun chiffre supposé" : "Dernier snapshot valide conservé · réseau ou version refusée" }
    }
}

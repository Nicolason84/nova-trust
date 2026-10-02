import SwiftUI
import Charts
import AVFoundation
import UIKit

let ink = Color(red: 0.027, green: 0.047, blue: 0.063)
let pearl = Color(red: 0.91, green: 0.92, blue: 0.87)
let copper = Color(red: 0.88, green: 0.66, blue: 0.44)
let jade = Color(red: 0.64, green: 0.82, blue: 0.73)

@main struct LaBeteApp: App {
    @StateObject private var store = CanonStore()
    var body: some Scene { WindowGroup { RootView().environmentObject(store).preferredColorScheme(.dark) } }
}

@MainActor final class Resonance: ObservableObject {
    @Published var active = false
    @Published var haptic = false
    @Published var volume: Float = 0.25 { didSet { player?.volume = min(0.5, max(0, volume)) } }
    @Published var message = "Silence. Une texture artistique, indépendante des chiffres."
    private var player: AVAudioPlayer?
    func toggle() {
        if active { stop(); return }
        do {
            // Ambient respects the silent switch; no recording category or microphone.
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            guard let u = Bundle.main.url(forResource: "resonance", withExtension: "wav") else { return }
            player = try AVAudioPlayer(contentsOf: u); player?.numberOfLoops = -1; player?.volume = volume
            active = player?.play() == true; message = active ? "Résonance active · volume doux" : "Lecture indisponible"
        } catch { stop(); message = "Son indisponible sur cet appareil" }
    }
    func stop() { player?.stop(); player = nil; active = false; message = "Silence. Touchez pour démarrer à nouveau."; try? AVAudioSession.sharedInstance().setActive(false) }
    func touch() { if haptic { UISelectionFeedbackGenerator().selectionChanged() } }
}

struct RootView: View {
    @EnvironmentObject var store: CanonStore
    @Environment(\.scenePhase) var phase
    @StateObject private var sound = Resonance()
    @State private var tab = 0
    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { PulseView(sound: sound) }.tabItem { Label("Pouls", systemImage: "waveform.path.ecg") }.tag(0)
            NavigationStack { ReadingView() }.tabItem { Label("Comprendre", systemImage: "circle.hexagongrid") }.tag(1)
            NavigationStack { EvidenceView() }.tabItem { Label("Preuves", systemImage: "point.3.connected.trianglepath.dotted") }.tag(2)
            NavigationStack { SoundView(sound: sound) }.tabItem { Label("Présence", systemImage: "waveform") }.tag(3)
        }.tint(copper)
        .task { await store.refresh() }
        .onChange(of: phase) { _, p in if p != .active { sound.stop() } else { Task { await store.refresh() } } }
        .onReceive(NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)) { _ in sound.stop() }
        .onReceive(NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)) { _ in sound.stop() }
    }
}

struct CanvasPage<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 22) { content }.padding(22).frame(maxWidth: 700, alignment: .leading).frame(maxWidth: .infinity) }
            .background(LinearGradient(colors: [ink, Color(red: 0.07, green: 0.105, blue: 0.12), ink], startPoint: .topLeading, endPoint: .bottomTrailing))
            .foregroundStyle(pearl).navigationTitle(title).navigationBarTitleDisplayMode(.inline)
    }
}
struct Panel<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View { VStack(alignment: .leading, spacing: 12) { content }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 22)).overlay(RoundedRectangle(cornerRadius: 22).stroke(copper.opacity(0.18))) }
}
struct Eyebrow: View { let value: String; var body: some View { Text(value.uppercased()).font(.caption.weight(.semibold)).tracking(2).foregroundStyle(copper) } }

struct PulseView: View {
    @EnvironmentObject var store: CanonStore
    @ObservedObject var sound: Resonance
    var body: some View {
        CanvasPage(title: "France · La Bête") {
            Eyebrow(value: "SUPRA × ojO / Finances publiques")
            Text("La France\na un pouls.").font(.system(.largeTitle, design: .serif).weight(.medium)).accessibilityIdentifier("pulse-title")
            if let c = store.canon {
                HStack(alignment: .firstTextBaseline) {
                    Text(c.number("observed.tec10_pct", decimals: 3, suffix: " %")).font(.system(size: 46, weight: .light, design: .rounded)).minimumScaleFactor(0.7).lineLimit(1)
                    Spacer(); Text("TEC 10\nOBSERVÉ").font(.caption).foregroundStyle(jade)
                }
                Text("Le taux de marché à 10 ans, observé le \(c.text("observed.tec10_date")).").font(.subheadline).foregroundStyle(pearl.opacity(0.7))
                Panel {
                    Eyebrow(value: "Ce qui change")
                    Text("10 ans : \(c.number("decision_delta.delta_bps.10", suffix: " pb")) depuis l’observation précédente.").font(.title3)
                    Text(c.text("decision_delta.status") + " · " + c.text("decision_delta.confidence")).font(.caption).foregroundStyle(jade)
                    NavigationLink("Voir la preuve Banque de France") { EvidenceView(focus: "TEC10") }.accessibilityIdentifier("pulse-proof")
                }
                BeastScene(sound: sound).frame(height: 290).clipShape(RoundedRectangle(cornerRadius: 26))
                Panel {
                    Eyebrow(value: "Horizon · incertitude")
                    Text("La transmission passe par les émissions et le refinancement, progressivement.")
                    Text("Échéancier : \(c.text("maturity_ladder.mode")). Coût moyen du stock : inconnu dans ce feed.").font(.subheadline).foregroundStyle(pearl.opacity(0.75))
                    Text("Un signal national ne prouve aucun effet régional.").font(.caption)
                }
                Panel {
                    Eyebrow(value: "Trois horloges")
                    Text("Marché : \(c.text("observed.tec10_date"))\nÉtat matériel : \(c.text("updated_at"))")
                    Text("Âge matériel : \(max(0, Int(Date().timeIntervalSince(c.date) / 60))) min").font(.caption)
                    Text("Runner : non observé par ce client. Ouvrir l’app ne prouve aucune exécution serveur.").font(.caption).foregroundStyle(copper)
                    Text(store.transport).font(.caption)
                }
                ShareLink(item: String(data: c.raw, encoding: .utf8) ?? "", preview: SharePreview("France · snapshot canonique")) { Label("Partager le snapshot et ses preuves", systemImage: "square.and.arrow.up") }
            } else { Panel { Text(store.transport); Button("Réessayer") { Task { await store.refresh() } } } }
            Button { Task { await store.refresh() } } label: { Label(store.busy ? "Vérification…" : "Actualiser le canon", systemImage: "arrow.clockwise") }.disabled(store.busy)
        }.refreshable { await store.refresh() }
    }
}

struct ReadingView: View {
    @EnvironmentObject var store: CanonStore
    @State private var historyIndex = 0
    var body: some View {
        CanvasPage(title: "Comprendre") {
            Eyebrow(value: "D’un signal à la transmission")
            Text("Le temps change\nla lecture.").font(.system(.largeTitle, design: .serif))
            if let c = store.canon {
                let history = c.value("curve_history") as? [[String: Any]] ?? []
                let index = min(historyIndex, max(0, history.count - 1))
                let curve = history.isEmpty ? c.curve : history[index]["curve"] as? [[String: Any]] ?? []
                Panel {
                    Eyebrow(value: "Courbe TEC · %")
                    Text(history.isEmpty ? c.text("observed.yield_curve_date") : history[index]["date"] as? String ?? "Inconnu").font(.caption)
                    Chart(Array(curve.enumerated()), id: \.offset) { _, p in
                        if let x = p["tenor_years"] as? Double, let y = p["rate_pct"] as? Double { LineMark(x: .value("Années", x), y: .value("Taux %", y)).foregroundStyle(copper); PointMark(x: .value("Années", x), y: .value("Taux %", y)).foregroundStyle(jade) }
                    }.frame(height: 180).accessibilityLabel("Courbe TEC en pour cent, échéance en années")
                    if history.count > 1 { Stepper("Observation \(index + 1) / \(history.count)", value: $historyIndex, in: 0...(history.count - 1)) }
                    ForEach(Array(curve.enumerated()), id: \.offset) { _, p in Text("\(p["tenor_years"].map { String(describing: $0) } ?? "Inconnu") ans · \(p["rate_pct"].map { String(describing: $0) } ?? "Inconnu") %").font(.caption) }
                }
                Panel {
                    Eyebrow(value: "Refinancement · horizons canoniques")
                    ForEach(Array((c.value("refinancing_twin.views") as? [[String: Any]] ?? []).enumerated()), id: \.offset) { _, v in
                        Text("\(v["horizon_months"].map { String(describing: $0) } ?? "Inconnu") mois · \(v["maturity_stock_bne"].map { String(describing: $0) } ?? "Inconnu") Md€ d’encours").font(.headline)
                        Text(v["coverage"] as? String ?? "UNKNOWN").font(.caption).foregroundStyle(copper)
                    }
                    Text(c.text("maturity_ladder.note")).font(.caption)
                }
                Panel {
                    Eyebrow(value: "Échéancier conservé · encours")
                    ForEach(Array((c.value("maturity_ladder.years") as? [[String: Any]] ?? []).enumerated()), id: \.offset) { _, v in
                        Text("\(v["year"].map { String(describing: $0) } ?? "Inconnu") · OAT \(v["oat_nominal_bne"].map { String(describing: $0) } ?? "Inconnu") Md€ · OATi \(v["oati_bne"].map { String(describing: $0) } ?? "Inconnu") · OAT€i \(v["oatei_bne"].map { String(describing: $0) } ?? "Inconnu")").font(.subheadline)
                    }
                }
                Panel {
                    Eyebrow(value: "Stress +100 pb · vintage PAP 2026")
                    Text("Sensibilité publiée, pas une prévision.")
                    let values = c.value("sensitivity.pap2026.annual_extra_charge_bne") as? [Double] ?? []
                    Chart(Array(values.enumerated()), id: \.offset) { i, y in BarMark(x: .value("Année depuis choc", i + 1), y: .value("Md€ supplémentaires", y)).foregroundStyle(copper.gradient) }.frame(height: 150)
                    ForEach(Array(values.enumerated()), id: \.offset) { i, y in Text("Année \(i + 1) · \(y, specifier: "%.1f") Md€ / an").font(.caption) }
                    NavigationLink("Provenance et modèle") { EvidenceView(focus: "PAP_STRESS") }
                    let shapes = c.value("sensitivity.stress_shapes") as? [String: [String: Any]] ?? [:]
                    ForEach(shapes.keys.sorted(), id: \.self) { key in
                        DisclosureGroup(shapes[key]?["label"] as? String ?? key) { Text(String(describing: shapes[key]?["tenor_shock_bps"] ?? "Inconnu")).font(.caption); Text("Chocs par tenor en pb. Aucun nouveau calcul financier mobile.").font(.caption) }
                    }
                }
                Panel {
                    Eyebrow(value: "Exécution budgétaire")
                    Text(c.text("budget_execution.titre_document"))
                    Text("Publié : \(c.text("budget_execution.date_publication")) · \(c.text("budget_execution.publication_date_state"))").font(.caption)
                    if let u = URL(string: c.text("budget_execution.url_fichier")), u.scheme == "https" { Link("Lire le PDF DGFiP", destination: u) }
                }
            } else { Text(store.transport) }
        }.onAppear { historyIndex = max(0, (store.canon?.value("curve_history") as? [Any])?.count ?? 1) - 1 }
    }
}

struct EvidenceView: View {
    @EnvironmentObject var store: CanonStore
    var focus: String? = nil
    var body: some View {
        CanvasPage(title: "Preuves") {
            Eyebrow(value: "Chaque signal a une origine")
            Text("Ouvrir la boîte\nde preuves.").font(.system(.largeTitle, design: .serif))
            if let c = store.canon {
                ForEach(Array(c.claims.filter { focus == nil || $0["claim_id"] as? String == focus }.enumerated()), id: \.offset) { _, claim in
                    Panel {
                        Eyebrow(value: (claim["type"] as? String ?? "UNKNOWN") + " · " + (claim["state"] as? String ?? "UNKNOWN"))
                        Text(claim["label"] as? String ?? "Claim sans libellé").font(.title3)
                        Text("Vintage : \(claim["date"] as? String ?? "Inconnu") · confiance : \(claim["confidence"] as? String ?? "UNKNOWN")").font(.caption)
                        Text("Observation : \(claim["observation_id"] as? String ?? "Inconnu")\nTransformation : \(claim["transformation_id"] as? String ?? "Inconnu")").font(.caption).textSelection(.enabled)
                        ForEach(Array((claim["proof"] as? [[String: Any]] ?? []).enumerated()), id: \.offset) { _, p in SourceView(source: p) }
                    }
                }
                if focus == nil {
                    ForEach(Array(c.sources.enumerated()), id: \.offset) { _, p in Panel { SourceView(source: p) } }
                    Panel {
                        Eyebrow(value: "ProofGraph · relations canoniques")
                        ForEach(Array((c.value("evidence_graph.edges") as? [[String: String]] ?? []).enumerated()), id: \.offset) { _, e in Text("\(e["from"] ?? "?") → \(e["relation"] ?? "?") → \(e["to"] ?? "?")").font(.caption) }
                    }
                    Panel { Eyebrow(value: "Ce qui ferait changer la lecture"); ForEach(Array((c.value("what_would_change_the_reading") as? [[String: Any]] ?? []).enumerated()), id: \.offset) { _, x in Text(x["reading"] as? String ?? ""); Text((x["change_conditions"] as? [String] ?? []).joined(separator: "\n")).font(.caption).foregroundStyle(copper) } }
                }
                Text("\(c.id) · séquence \(c.sequence)\n\(c.text("updated_at"))\nFrance → Finances publiques → Dette / Taux / Refinancement").font(.caption).textSelection(.enabled)
            }
        }
    }
}
struct SourceView: View {
    let source: [String: Any]
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(source["label"] as? String ?? source["publisher"] as? String ?? "Source").font(.headline)
            Text("\(source["health"] as? String ?? "UNKNOWN") · \(source["vintage"] as? String ?? source["observation_date"] as? String ?? "Vintage non précisé")").font(.caption).foregroundStyle(jade)
            Text("Vérifiée : \(source["checked_at"] as? String ?? "Non renseigné")").font(.caption)
            if let reason = source["reason"] as? String ?? source["error"] as? String { Text(reason).font(.caption).foregroundStyle(copper) }
            if let condition = source["replacement_condition"] as? String { Text("Remplacement : " + condition).font(.caption) }
            if let u = URL(string: source["url"] as? String ?? ""), u.scheme == "https" { Link("Ouvrir la source officielle ↗", destination: u) }
        }
    }
}
struct SoundView: View {
    @ObservedObject var sound: Resonance
    var body: some View {
        CanvasPage(title: "Présence") {
            Eyebrow(value: "La Bête, à votre rythme")
            Text("Une respiration.\nÀ votre demande.").font(.system(.largeTitle, design: .serif))
            Panel { Button(sound.active ? "Arrêter la résonance" : "Faire résonner") { sound.toggle() }.buttonStyle(.borderedProminent).accessibilityIdentifier("resonance-toggle"); Text(sound.message); Slider(value: $sound.volume, in: 0...0.5); Text("Volume borné · le mode silencieux est respecté").font(.caption) }
            Panel { Toggle("Retour tactile sur sélection", isOn: $sound.haptic).onChange(of: sound.haptic) { _, on in if on { sound.touch() } }; Text("Bref feedback de geste uniquement. La vibration nécessite un appareil compatible ; elle n’est pas certifiée par le simulateur.").font(.caption) }
            Text("Le son s’arrête en arrière-plan ou lors d’une interruption. Il ne reprend jamais seul. Aucun accès au microphone ni à la caméra.").font(.subheadline).foregroundStyle(pearl.opacity(0.7))
        }
    }
}

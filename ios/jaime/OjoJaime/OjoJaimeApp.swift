import SwiftUI

@main
struct OjoJaimeApp: App {
    var body: some Scene {
        WindowGroup { JaimeRootView() }
    }
}

struct JaimeRootView: View {
    @StateObject private var browser = BrowserModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var showAbout = false
    @State private var showNavigationConfirmation = false
    @State private var pendingNavigation: PendingNavigation = .reload
    private let forest = Color(red: 23.0/255, green: 63.0/255, blue: 53.0/255)

    private enum PendingNavigation {
        case home, reload
        var title: String {
            switch self {
            case .home: return "Ir al inicio"
            case .reload: return "Recargar"
            }
        }
    }

    private var versionLabel: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "Versión iOS \(version) · compilación \(build)"
    }

    private func requestNavigation(_ action: PendingNavigation) {
        pendingNavigation = action
        showNavigationConfirmation = true
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                HStack {
                    Button { browser.goBack() } label: {
                        Image(systemName: "chevron.left").frame(width: 44, height: 44)
                    }
                    .disabled(!browser.canGoBack)
                    .accessibilityLabel("Volver")
                    Spacer()
                    Text("ojO · Jaime").font(.headline)
                    Spacer()
                    Menu {
                        Button { requestNavigation(.home) } label: { Label("Ir al inicio", systemImage: "house") }
                        Button { requestNavigation(.reload) } label: { Label("Recargar", systemImage: "arrow.clockwise") }
                        Button { showAbout = true } label: { Label("Acerca de esta app", systemImage: "info.circle") }
                    } label: {
                        Image(systemName: "ellipsis.circle").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Opciones de la app")
                }
                .padding(.horizontal, 8).foregroundStyle(.white).background(forest)
                if !browser.online {
                    Label("Sin conexión. Algunas páginas guardadas pueden abrirse.", systemImage: "wifi.slash")
                        .font(.caption).padding(9).frame(maxWidth: .infinity)
                        .foregroundStyle(.primary).background(Color.orange.opacity(0.13))
                }
                if browser.loading { ProgressView().progressViewStyle(.linear).tint(forest) }
                ZStack {
                    BrowserView(model: browser)
                    if let failure = browser.failure {
                        VStack(spacing: 18) {
                            Image(systemName: "arrow.triangle.2.circlepath").font(.largeTitle).foregroundStyle(forest)
                            Text("Vamos a intentarlo de nuevo").font(.title2.bold()).multilineTextAlignment(.center)
                            Text(failure).foregroundStyle(.secondary).multilineTextAlignment(.center)
                            Button("Volver a cargar") { requestNavigation(.reload) }.buttonStyle(.borderedProminent).tint(forest)
                        }
                        .padding(30).frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color(uiColor: .systemBackground))
                    }
                }
            }
            if scenePhase != .active {
                forest.ignoresSafeArea()
                VStack(spacing: 14) {
                    Text("ojO").font(.system(size: 64, weight: .bold, design: .rounded))
                    Text("Tu espacio, a tu ritmo.").font(.headline)
                }.foregroundStyle(.white).accessibilityElement(children: .combine)
            }
        }
        .background(forest.ignoresSafeArea())
        .onChange(of: scenePhase) { phase in
            if phase == .background { browser.stopCapture() }
        }
        .alert("¿Has guardado lo importante?", isPresented: $showNavigationConfirmation) {
            Button("Seguir aquí", role: .cancel) {}
            Button(pendingNavigation.title) {
                switch pendingNavigation {
                case .home: browser.goHome()
                case .reload: browser.reload()
                }
            }
        } message: {
            Text("Antes de salir de esta página, guarda tus borradores y termina las grabaciones. Lo que aún no hayas guardado puede perderse.")
        }
        .sheet(isPresented: $showAbout) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("Tu mismo ojO, en una app para iPhone.").font(.title2.bold())
                        Text("Abre el espacio de Jaime mediante una conexión segura. Su contenido se actualiza desde la versión publicada de ojO.")
                        Text("Tus datos en esta app están separados de Safari y de la app añadida a la pantalla de inicio. No se importan automáticamente. Conserva tus originales y las copias cifradas que hayas exportado.")
                        Text("El micrófono y la cámara solo se solicitan cuando utilizas esas funciones. Los archivos se eligen con el selector de iOS. El asistente y la mensajería conservan el estado de conexión que indica cada pantalla.")
                        Text("Mis mejoras usa el componente compartido de ojO. Allí eliges si quieres recordar opciones, observar fallos y preparar propuestas. Consulta en esa pantalla el estado de conexión y de cada propuesta. Preparar un archivo técnico no lo envía; esta app no instala cambios por su cuenta.")
                        Text("Los enlaces externos se abren con el navegador o la app que hayas elegido en iOS. No hay notificaciones proactivas ni VPN activadas. La primera apertura y el contenido nuevo necesitan Internet; el audio no se descarga automáticamente.")
                        Text("Las notas habituales y borradores locales no son un archivo cifrado. Usa Mi archivo para los documentos que quieras guardar con una frase de protección.")
                        Text(versionLabel).font(.caption).foregroundStyle(.secondary)
                    }.padding(24)
                }
                .navigationTitle("Acerca de ojO")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Listo") { showAbout = false } } }
            }.presentationDragIndicator(.visible)
        }
    }
}

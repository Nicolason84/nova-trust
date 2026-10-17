import SwiftUI
import SceneKit
import UIKit
import simd

let armNames = ["Marché", "Refinancement", "Émissions", "Intérêts", "Stock", "Maturité", "Déficit", "Temps"]
let armDetails = ["Courbe des taux : signal observé, pas causalité.", "Échéances : vitesse de transmission au stock.", "Besoin nouveau : volume exposé aux conditions courantes.", "Charge : résultat budgétaire de la transmission.", "Dette existante : mémoire des coupons passés.", "Durée de vie : amortisseur temporel du portefeuille.", "Besoin de financement : flux à couvrir.", "Persistance : variable qui transforme un signal en coût durable."]

struct BeastScene: View {
    @Environment(\.accessibilityReduceMotion) var reduced
    @Environment(\.scenePhase) var phase
    @ObservedObject var sound: Resonance
    @State private var selected = 0
    @State private var reset = UUID()
    @State private var simplified = false
    var body: some View {
        VStack(spacing: 8) {
            if reduced || simplified || ProcessInfo.processInfo.isLowPowerModeEnabled {
                ZStack {
                    ForEach(0..<5) { i in Circle().stroke(copper.opacity(0.15 + Double(i) * 0.03), lineWidth: 1).padding(CGFloat(i) * 16) }
                    Text("FRANCE").font(.system(.title2, design: .serif)).tracking(4)
                }.frame(maxHeight: .infinity).accessibilityLabel("Mode léger : stock central et cinq horizons")
            } else {
                NativeBeast(selected: $selected, reset: reset, moving: phase == .active).accessibilityLabel("Bête 3D native. Glisser pour tourner, pincer pour zoomer. Sélection des huit bras ci-dessous.")
            }
            HStack { Button("Recentrer") { reset = UUID(); sound.touch() }; Spacer(); Button(simplified ? "3D" : "Mode léger") { simplified.toggle(); sound.touch() } }.font(.caption)
            Picker("Bras de la Bête", selection: $selected) { ForEach(0..<8) { i in Text(armNames[i]).tag(i) } }.pickerStyle(.menu).onChange(of: selected) { _, _ in sound.touch() }
            Text(armDetails[selected]).font(.caption).foregroundStyle(pearl.opacity(0.75)).frame(minHeight: 30)
        }.padding(12).background(ink.opacity(0.45))
    }
}

struct NativeBeast: UIViewRepresentable {
    @Binding var selected: Int
    let reset: UUID
    let moving: Bool
    func makeCoordinator() -> Coordinator { Coordinator(selected: $selected) }
    func makeUIView(context: Context) -> SCNView {
        let view = SCNView(); view.accessibilityIdentifier = "beast-scene"; view.backgroundColor = .clear; view.antialiasingMode = .multisampling2X
        view.preferredFramesPerSecond = 30; view.allowsCameraControl = true
        view.defaultCameraController.interactionMode = .orbitTurntable
        view.defaultCameraController.minimumVerticalAngle = -75; view.defaultCameraController.maximumVerticalAngle = 75
        view.defaultCameraController.inertiaEnabled = false
        let scene = SCNScene(); view.scene = scene
        let root = SCNNode(); root.name = "organism"; scene.rootNode.addChildNode(root)
        let cam = SCNNode(); cam.camera = SCNCamera(); cam.camera?.fieldOfView = 44; cam.position = SCNVector3(0, 1.0, 17); cam.look(at: SCNVector3Zero); scene.rootNode.addChildNode(cam); view.pointOfView = cam
        context.coordinator.camera = cam; context.coordinator.lastReset = reset
        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light?.type = .ambient; ambient.light?.color = UIColor(red: 0.55, green: 0.70, blue: 0.75, alpha: 1); ambient.light?.intensity = 500; scene.rootNode.addChildNode(ambient)
        let key = SCNNode(); key.light = SCNLight(); key.light?.type = .omni; key.light?.intensity = 1300; key.position = SCNVector3(4, 5, 7); scene.rootNode.addChildNode(key)
        let core = SCNNode(geometry: SCNSphere(radius: 2.1)); core.geometry?.firstMaterial = material(UIColor(red: 0.18, green: 0.32, blue: 0.37, alpha: 1)); root.addChildNode(core)
        let inner = SCNNode(geometry: SCNSphere(radius: 2.15)); let wire = material(.systemMint); wire.fillMode = .lines; wire.transparency = 0.10; inner.geometry?.firstMaterial = wire; root.addChildNode(inner)
        for i in 0..<5 {
            let ring = SCNNode(geometry: SCNTorus(ringRadius: CGFloat(2.8 + Double(i) * 0.62), pipeRadius: 0.024))
            let m = material(i < 2 ? .systemTeal : UIColor(red: 0.88, green: 0.66, blue: 0.44, alpha: 1)); m.transparency = 0.30; ring.geometry?.firstMaterial = m; ring.eulerAngles = SCNVector3(0.22 * Double(i), 0, 0.13 * Double(i)); root.addChildNode(ring)
        }
        for i in 0..<8 {
            let a = Double(i) * .pi / 4
            var last: SCNVector3?
            for step in 0...24 {
                let t = Double(step) / 24, r = 1.85 + 2.8 * t
                let p = SCNVector3(r * cos(a) + sin(a * 1.7) * 0.65 * t * t, r * sin(a) * 0.55 + cos(a * 1.3) * 0.7 * t * t, r * sin(a) * 0.55 + sin(a * 2) * 0.3 * t)
                if let start = last {
                    let dx = p.x - start.x, dy = p.y - start.y, dz = p.z - start.z
                    let length = sqrt(dx * dx + dy * dy + dz * dz)
                    let segment = SCNNode(geometry: SCNCapsule(capRadius: 0.065, height: CGFloat(length + 0.13)))
                    segment.name = "arm-\(i)"; segment.geometry?.firstMaterial = material(i % 2 == 0 ? .systemMint : .systemTeal)
                    segment.position = SCNVector3((start.x + p.x) / 2, (start.y + p.y) / 2, (start.z + p.z) / 2)
                    segment.simdOrientation = simd_quatf(from: SIMD3<Float>(0, 1, 0), to: simd_normalize(SIMD3<Float>(dx, dy, dz)))
                    root.addChildNode(segment)
                }
                last = p
            }
        }
        let pulse = SCNAction.sequence([.scale(to: 1.025, duration: 3), .scale(to: 1, duration: 3)])
        core.runAction(.repeatForever(pulse), forKey: "breath")
        view.addGestureRecognizer(UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:))))
        return view
    }
    func updateUIView(_ view: SCNView, context: Context) {
        view.isPlaying = moving; view.scene?.isPaused = !moving
        if context.coordinator.lastReset != reset {
            context.coordinator.lastReset = reset
            if let cam = context.coordinator.camera { cam.position = SCNVector3(0, 1, 17); cam.look(at: SCNVector3Zero); view.pointOfView = cam; view.defaultCameraController.stopInertia() }
        }
    }
    func material(_ color: UIColor) -> SCNMaterial { let m = SCNMaterial(); m.diffuse.contents = color; m.metalness.contents = 0.45; m.roughness.contents = 0.25; m.emission.contents = color.withAlphaComponent(0.08); return m }
    final class Coordinator: NSObject {
        var selected: Binding<Int>; var camera: SCNNode?; var lastReset: UUID?
        init(selected: Binding<Int>) { self.selected = selected }
        @objc func tap(_ recognizer: UITapGestureRecognizer) {
            guard let v = recognizer.view as? SCNView else { return }
            for hit in v.hitTest(recognizer.location(in: v), options: nil) {
                if let name = hit.node.name, name.hasPrefix("arm-"), let i = Int(name.dropFirst(4)), (0..<8).contains(i) { selected.wrappedValue = i; break }
            }
        }
    }
}

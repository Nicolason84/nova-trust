import XCTest

final class NativeUITests: XCTestCase {
    func capture(_ name: String) { let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }
    func testNativeNavigationAndPresence() {
        let app = XCUIApplication(); app.launch()
        XCTAssertTrue(app.staticTexts["pulse-title"].waitForExistence(timeout: 20)); capture("CAPTURE_NATIVE_IPHONE")
        XCTAssertEqual(app.webViews.count, 0)
        app.buttons["Recentrer"].tap()
        app.tabBars.buttons["Comprendre"].tap(); XCTAssertTrue(app.staticTexts["Le temps change\nla lecture."].waitForExistence(timeout: 5)); capture("IPHONE_READING")
        app.tabBars.buttons["Preuves"].tap(); XCTAssertTrue(app.staticTexts["Ouvrir la boîte\nde preuves."].waitForExistence(timeout: 5)); capture("IPHONE_PROOFS")
        app.tabBars.buttons["Présence"].tap(); XCTAssertTrue(app.buttons["resonance-toggle"].exists)
        app.buttons["resonance-toggle"].tap(); capture("IPHONE_AUDIO_OPT_IN")
        XCUIDevice.shared.press(.home); app.activate()
        XCTAssertEqual(app.buttons["resonance-toggle"].label, "Faire résonner")
        XCUIDevice.shared.orientation = .landscapeLeft; capture("IPHONE_LANDSCAPE")
        XCUIDevice.shared.orientation = .portrait
        app.tabBars.buttons["Pouls"].tap(); app.swipeDown(); app.swipeDown(); XCTAssertTrue(app.staticTexts["pulse-title"].waitForExistence(timeout: 5))
    }
    func testSceneGesturesAndFallback() {
        let app = XCUIApplication(); app.launch(); XCTAssertTrue(app.staticTexts["pulse-title"].waitForExistence(timeout: 15))
        app.swipeUp()
        let scene = app.descendants(matching: .any)["beast-scene"].firstMatch
        XCTAssertTrue(scene.exists)
        let start = scene.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.4))
        let end = scene.coordinate(withNormalizedOffset: CGVector(dx: 0.65, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: end); capture("IPHONE_3D_ROTATED")
        app.buttons["Recentrer"].tap(); app.buttons["Mode léger"].tap(); capture("IPHONE_LIGHT_MODE")
        XCTAssertEqual(app.webViews.count, 0)
    }
}

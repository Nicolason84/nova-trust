import XCTest

final class LaunchPerformanceTests: XCTestCase {
    // Simulator and Release build measurements. No physical-phone score or
    // claim about human comprehension, network freshness, or gesture latency.
    func testLaunchUntilResponsive() {
        let app = XCUIApplication()
        let options = XCTMeasureOptions()
        options.iterationCount = 3
        measure(metrics: [XCTApplicationLaunchMetric(waitUntilResponsive: true)], options: options) {
            app.launch()
            XCTAssertTrue(app.staticTexts["pulse-title"].waitForExistence(timeout: 20))
            app.terminate()
        }
    }
}

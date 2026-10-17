import XCTest
import Foundation
import Combine
@testable import LaBete

// The URL loader failure is controlled. This is not an OS network-outage
// or physical-device claim. Production uses the existing foreground URLSession.
final class FixtureURLProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var bytes = Data()
    private static var status = 200
    private static var error: Error?
    static func configure(_ data: Data = Data(), status: Int = 200, error: Error? = nil) {
        lock.lock(); defer { lock.unlock() }
        bytes = data; self.status = status; self.error = error
    }
    override class func canInit(with request: URLRequest) -> Bool { request.url == Canon.url }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock(); let data = Self.bytes, status = Self.status, error = Self.error; Self.lock.unlock()
        if let error { client?.urlProtocol(self, didFailWithError: error); return }
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@MainActor final class ClientLifecycleTests: XCTestCase {
    private var folder: URL!
    private var session: URLSession!
    override func setUp() async throws {
        folder = FileManager.default.temporaryDirectory.appendingPathComponent("FranceClientTests-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FixtureURLProtocol.self]
        session = URLSession(configuration: configuration)
    }
    override func tearDown() async throws {
        session.invalidateAndCancel()
        try FileManager.default.removeItem(at: folder)
    }
    var cache: URL { folder.appendingPathComponent("projection.json") }
    func seed() throws -> Data {
        try Data(contentsOf: XCTUnwrap(Bundle(for: CanonTests.self).url(forResource: "canonical-seed", withExtension: "json")))
    }
    func fresh(_ raw: Data) throws -> Data {
        let old = try Canon(raw)
        var object = try JSONSerialization.jsonObject(with: raw) as! [String: Any]
        object["sequence"] = old.sequence + 1
        object["snapshot_id"] = "TEST_NEWER_PROJECTION"
        object["updated_at"] = ISO8601DateFormatter().string(from: old.date.addingTimeInterval(1))
        return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }
    func testUnavailableNetworkRetainsExactCachedBytesAndOriginalAge() async throws {
        let raw = try seed(), old = try Canon(raw)
        try raw.write(to: cache)
        let store = CanonStore(cache: cache, seed: Data(), session: session)
        FixtureURLProtocol.configure(error: URLError(.notConnectedToInternet))
        await store.refresh()
        XCTAssertEqual(store.canon?.raw, raw); XCTAssertEqual(store.canon?.date, old.date)
        XCTAssertEqual(try Data(contentsOf: cache), raw)
        XCTAssertTrue(store.transport.contains("Dernier snapshot valide")); XCTAssertFalse(store.busy)
        let reopened = CanonStore(cache: cache, seed: Data(), session: session)
        XCTAssertEqual(reopened.canon?.raw, raw); XCTAssertEqual(reopened.canon?.id, old.id)
        XCTAssertTrue(reopened.transport.contains("Cache vérifié"))
    }
    func testInvalidStaleConflictingAndHTTPFailuresCannotReplaceLastGood() async throws {
        let raw = try seed(), old = try Canon(raw)
        try raw.write(to: cache)
        let store = CanonStore(cache: cache, seed: Data(), session: session)
        var object = old.object
        object["sequence"] = old.sequence - 1
        let stale = try JSONSerialization.data(withJSONObject: object)
        object = old.object; object["snapshot_id"] = "CONFLICT"
        let conflict = try JSONSerialization.data(withJSONObject: object)
        for response in [(Data("{}".utf8), 200), (stale, 200), (conflict, 200), (raw, 503)] {
            FixtureURLProtocol.configure(response.0, status: response.1)
            await store.refresh()
            XCTAssertEqual(store.canon?.raw, raw); XCTAssertEqual(store.canon?.date, old.date)
            XCTAssertEqual(try Data(contentsOf: cache), raw)
            XCTAssertTrue(store.transport.contains("Dernier snapshot valide"))
        }
    }
    func testFreshReplacementPersistsItsExactBytesAndProvenance() async throws {
        let raw = try seed(), newer = try fresh(raw)
        let store = CanonStore(cache: cache, seed: raw, session: session)
        FixtureURLProtocol.configure(newer)
        await store.refresh()
        XCTAssertEqual(store.canon?.raw, newer); XCTAssertEqual(try Data(contentsOf: cache), newer)
        XCTAssertEqual(store.canon?.sequence, try Canon(raw).sequence + 1)
        let reopened = CanonStore(cache: cache, seed: raw, session: session)
        XCTAssertEqual(reopened.canon?.id, "TEST_NEWER_PROJECTION")
        XCTAssertEqual(reopened.canon?.date, try Canon(newer).date)
    }
    func testSameSnapshotReverificationDoesNotRepublishPresentation() async throws {
        let raw = try seed()
        let store = CanonStore(cache: cache, seed: raw, session: session)
        var publications = 0
        let subscription = store.$canon.dropFirst().sink { _ in publications += 1 }
        FixtureURLProtocol.configure(raw)
        await store.refresh(); await store.refresh()
        XCTAssertEqual(publications, 0); XCTAssertEqual(try Data(contentsOf: cache), raw)
        XCTAssertTrue(store.transport.contains("même snapshot"))
        withExtendedLifetime(subscription) {}
    }
    func testCorruptCacheFallsBackWithoutManufacturingNumbers() async throws {
        let raw = try seed()
        try Data("corrupt".utf8).write(to: cache)
        let store = CanonStore(cache: cache, seed: raw, session: session)
        XCTAssertEqual(store.canon?.raw, raw)
        XCTAssertTrue(store.transport.contains("Snapshot fourni"))
        FixtureURLProtocol.configure(raw); await store.refresh()
        XCTAssertEqual(try Data(contentsOf: cache), raw)
        let unavailable = CanonStore(cache: folder.appendingPathComponent("missing.json"), seed: Data(), session: session)
        FixtureURLProtocol.configure(error: URLError(.notConnectedToInternet)); await unavailable.refresh()
        XCTAssertNil(unavailable.canon); XCTAssertTrue(unavailable.transport.contains("aucun chiffre supposé"))
    }
    func testCacheWriteFailurePreservesInMemoryLastGood() async throws {
        let raw = try seed(), newer = try fresh(raw)
        let impossible = folder.appendingPathComponent("nonexistent/projection.json")
        let store = CanonStore(cache: impossible, seed: raw, session: session)
        FixtureURLProtocol.configure(newer); await store.refresh()
        XCTAssertEqual(store.canon?.raw, raw)
        XCTAssertTrue(store.transport.contains("Dernier snapshot valide"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: impossible.path))
    }
}

@MainActor final class NativeAudioTests: XCTestCase {
    func testOptInEngineIsBoundedMeasuredAndStopsExplicitly() async throws {
        let sound = Resonance()
        XCTAssertFalse(sound.active); XCTAssertNil(sound.engineMeasurement)
        sound.volume = 1.0; sound.toggle()
        XCTAssertTrue(sound.active)
        try await Task.sleep(for: .milliseconds(250))
        let measurement = try XCTUnwrap(sound.engineMeasurement)
        XCTAssertTrue(measurement.playing); XCTAssertEqual(measurement.channels, 1)
        XCTAssertEqual(measurement.sampleRate, 22050, accuracy: 1)
        XCTAssertEqual(measurement.durationSeconds, 20, accuracy: 0.01)
        XCTAssertGreaterThan(measurement.elapsedSeconds, 0)
        XCTAssertLessThanOrEqual(measurement.actualVolume, 0.5)
        let path = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("NATIVE_AUDIO_ENGINE_IOS.json")
        try JSONEncoder().encode(measurement).write(to: path, options: .atomic)
        sound.stop(); XCTAssertFalse(sound.active); XCTAssertNil(sound.engineMeasurement)
        sound.volume = -1; sound.toggle()
        XCTAssertEqual(sound.engineMeasurement?.actualVolume, 0)
        sound.stop(); XCTAssertFalse(sound.active)
    }
}

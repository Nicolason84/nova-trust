import XCTest
@testable import LaBete

final class CanonTests: XCTestCase {
    func raw() throws -> Data { try Data(contentsOf: XCTUnwrap(Bundle(for: Self.self).url(forResource: "canonical-seed", withExtension: "json"))) }
    func changed(_ mutate: (inout [String: Any]) -> Void) throws -> Data { var d = try JSONSerialization.jsonObject(with: raw()) as! [String: Any]; mutate(&d); return try JSONSerialization.data(withJSONObject: d, options: [.sortedKeys]) }
    func testCanonicalParityAndUnknowns() throws {
        let bytes = try raw(), c = try Canon(bytes)
        XCTAssertEqual(c.raw, bytes); XCTAssertEqual(c.text("france_binding.country_object_id"), Canon.country)
        XCTAssertEqual(c.text("france_binding.system_id"), Canon.system)
        XCTAssertEqual(c.number("absent", decimals: 3), "Inconnu")
        XCTAssertEqual(c.text("budget_execution.date_publication"), "2026-09-03")
        XCTAssertEqual(c.claims.count, (c.object["claims"] as? [[String: Any]])?.count)
        let u = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("CANONICAL_PARITY_IOS.json")
        try c.raw.write(to: u, options: .atomic)
    }
    func testStaleAndConflictRejected() throws {
        let old = try Canon(raw())
        let older = try Canon(changed { $0["sequence"] = old.sequence - 1 })
        XCTAssertThrowsError(try older.checkReplacement(old))
        let conflict = try Canon(changed { $0["snapshot_id"] = "OTHER" })
        XCTAssertThrowsError(try conflict.checkReplacement(old))
        XCTAssertNoThrow(try Canon(raw()).checkReplacement(old))
    }
    func testNewerAcceptedOnlyWithNewTimestamp() throws {
        let old = try Canon(raw())
        let fresh = try Canon(changed { $0["sequence"] = old.sequence + 1; $0["snapshot_id"] = "FRESH"; $0["updated_at"] = ISO8601DateFormatter().string(from: old.date.addingTimeInterval(1)) })
        XCTAssertNoThrow(try fresh.checkReplacement(old))
        let unadvanced = try Canon(changed { $0["sequence"] = old.sequence + 1 })
        XCTAssertThrowsError(try unadvanced.checkReplacement(old))
    }
    func testIdentityPolicyAndBooleanSequenceRejected() throws {
        XCTAssertThrowsError(try Canon(changed { $0["schema"] = "KRIMI" }))
        XCTAssertThrowsError(try Canon(changed { $0["sequence"] = true }))
        XCTAssertThrowsError(try Canon(changed { var b = $0["france_binding"] as! [String: Any]; b["territorial_imputation"] = true; $0["france_binding"] = b }))
        XCTAssertThrowsError(try Canon(changed { var p = $0["policy"] as! [String: Any]; p["political_recommendation"] = "BUY"; $0["policy"] = p }))
        XCTAssertThrowsError(try Canon(changed { $0["updated_at"] = "2099-01-01T00:00:00Z" }))
    }
    func testFullIdentityBindingRejected() throws {
        XCTAssertThrowsError(try Canon(changed { var b = $0["france_binding"] as! [String: Any]; b["output_id"] = "FOREIGN"; $0["france_binding"] = b }))
        XCTAssertThrowsError(try Canon(changed { var b = $0["france_binding"] as! [String: Any]; b["territorial_imputation"] = 0; $0["france_binding"] = b }))
        XCTAssertThrowsError(try Canon(changed { var a = $0["claims"] as! [[String: Any]]; a[0]["system_id"] = "FOREIGN"; $0["claims"] = a }))
    }
    func testAllClaimTypesRetained() throws {
        for type in ["OBSERVED", "DERIVED", "HYPOTHESIS", "STRESS", "UNKNOWN"] {
            let c = try Canon(changed { var a = $0["claims"] as! [[String: Any]]; a[0]["type"] = type; $0["claims"] = a })
            XCTAssertEqual(c.claims[0]["type"] as? String, type)
        }
        XCTAssertThrowsError(try Canon(changed { var a = $0["claims"] as! [[String: Any]]; a[0]["type"] = "PROPHECY"; $0["claims"] = a }))
    }
    func testNullAndZeroStayDistinct() throws {
        let c = try Canon(changed { var o = $0["observed"] as! [String: Any]; o["test_null"] = NSNull(); o["test_zero"] = 0; $0["observed"] = o })
        XCTAssertEqual(c.number("observed.test_null"), "Inconnu")
        XCTAssertEqual(c.number("observed.test_zero", decimals: 1), "0,0")
    }
}

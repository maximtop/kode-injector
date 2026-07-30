import Foundation
import XCTest
@testable import SafariNativeBridge

final class SafariSnapshotCacheTests: XCTestCase {
    func testFileFingerprintChangesWhenFileIsReplaced() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        defer { try? FileManager.default.removeItem(at: directory) }
        let fileURL = directory.appendingPathComponent("source.js")
        try Data("one".utf8).write(to: fileURL)
        let original = try XCTUnwrap(SafariFileFingerprint.read(from: fileURL))

        try Data("changed content".utf8).write(to: fileURL, options: .atomic)
        let changed = try XCTUnwrap(SafariFileFingerprint.read(from: fileURL))

        XCTAssertNotEqual(original, changed)
        XCTAssertNil(SafariFileFingerprint.read(from: directory))
    }

    func testReturnsMatchingSnapshotBeforeExpiry() {
        var current = Date(timeIntervalSince1970: 100)
        let cache = SafariSnapshotCache(now: { current })
        let snapshot = makeSnapshot("one")

        cache.store(snapshot, for: "file:///one.js")
        XCTAssertEqual(
            cache.snapshot(for: "file:///one.js", digest: snapshot.digest),
            snapshot
        )

        current = current.addingTimeInterval(31)
        XCTAssertNil(cache.snapshot(for: "file:///one.js", digest: snapshot.digest))
    }

    func testRejectsWrongDigestAndEvictsLeastRecentlyUsedSnapshot() {
        var current = Date(timeIntervalSince1970: 100)
        let cache = SafariSnapshotCache(maximumEntries: 2, now: { current })
        let first = makeSnapshot("first")
        let second = makeSnapshot("second")
        let third = makeSnapshot("third")

        cache.store(first, for: "file:///first.js")
        current = current.addingTimeInterval(1)
        cache.store(second, for: "file:///second.js")
        current = current.addingTimeInterval(1)
        XCTAssertNotNil(cache.snapshot(for: "file:///first.js", digest: first.digest))
        XCTAssertNil(cache.snapshot(for: "file:///first.js", digest: second.digest))
        current = current.addingTimeInterval(1)
        cache.store(third, for: "file:///third.js")

        XCTAssertNotNil(cache.snapshot(for: "file:///first.js", digest: first.digest))
        XCTAssertNil(cache.snapshot(for: "file:///second.js", digest: second.digest))
        XCTAssertNotNil(cache.snapshot(for: "file:///third.js", digest: third.digest))
    }

    func testHonorsTotalByteLimit() {
        let cache = SafariSnapshotCache(maximumEntries: 2, maximumBytes: 5)
        let first = makeSnapshot("123")
        let second = makeSnapshot("456")

        cache.store(first, for: "file:///first.js")
        cache.store(second, for: "file:///second.js")

        XCTAssertNil(cache.snapshot(for: "file:///first.js", digest: first.digest))
        XCTAssertNotNil(cache.snapshot(for: "file:///second.js", digest: second.digest))
    }

    func testReturnsSnapshotOnlyForMatchingFileFingerprint() {
        let cache = SafariSnapshotCache()
        let snapshot = makeSnapshot("cached")
        let original = makeFingerprint(size: snapshot.totalBytes, modificationNanoseconds: 1)
        let changed = makeFingerprint(size: snapshot.totalBytes, modificationNanoseconds: 2)

        cache.store(snapshot, for: "file:///cached.js", fingerprint: original)

        XCTAssertEqual(
            cache.snapshot(for: "file:///cached.js", fingerprint: original),
            snapshot
        )
        XCTAssertNil(cache.snapshot(for: "file:///cached.js", fingerprint: changed))
    }

    private func makeSnapshot(_ value: String) -> SafariReadSnapshot {
        let bytes = Data(value.utf8)
        return SafariReadSnapshot(
            bytes: bytes,
            digest: value,
            totalBytes: bytes.count,
            chunkCount: bytes.isEmpty ? 0 : 1
        )
    }

    private func makeFingerprint(
        size: Int,
        modificationNanoseconds: Int64
    ) -> SafariFileFingerprint {
        SafariFileFingerprint(
            device: 1,
            inode: 2,
            size: Int64(size),
            modificationSeconds: 3,
            modificationNanoseconds: modificationNanoseconds,
            statusChangeSeconds: 4,
            statusChangeNanoseconds: 5
        )
    }
}

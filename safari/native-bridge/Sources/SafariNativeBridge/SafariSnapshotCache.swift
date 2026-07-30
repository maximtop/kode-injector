import Foundation
import Darwin

struct SafariFileFingerprint: Equatable, Sendable {
    let device: UInt64
    let inode: UInt64
    let size: Int64
    let modificationSeconds: Int64
    let modificationNanoseconds: Int64
    let statusChangeSeconds: Int64
    let statusChangeNanoseconds: Int64

    static func read(from fileURL: URL) -> SafariFileFingerprint? {
        var information = stat()
        let result = fileURL.withUnsafeFileSystemRepresentation { path in
            guard let path else {
                return Int32(-1)
            }
            return Darwin.fstatat(AT_FDCWD, path, &information, 0)
        }
        guard result == 0,
              information.st_mode & S_IFMT == S_IFREG else {
            return nil
        }
        return SafariFileFingerprint(
            device: UInt64(information.st_dev),
            inode: UInt64(information.st_ino),
            size: Int64(information.st_size),
            modificationSeconds: Int64(information.st_mtimespec.tv_sec),
            modificationNanoseconds: Int64(information.st_mtimespec.tv_nsec),
            statusChangeSeconds: Int64(information.st_ctimespec.tv_sec),
            statusChangeNanoseconds: Int64(information.st_ctimespec.tv_nsec)
        )
    }
}

final class SafariSnapshotCache: @unchecked Sendable {
    private struct Entry {
        let fileURL: String
        let snapshot: SafariReadSnapshot
        let fingerprint: SafariFileFingerprint?
        let expiresAt: Date
        var lastAccessedAt: Date
    }

    private let maximumEntries: Int
    private let maximumBytes: Int
    private let lifetime: TimeInterval
    private let now: () -> Date
    private let lock = NSLock()
    private var entries: [Entry] = []

    init(
        maximumEntries: Int = 2,
        maximumBytes: Int = 10 * 1024 * 1024,
        lifetime: TimeInterval = 30,
        now: @escaping () -> Date = Date.init
    ) {
        self.maximumEntries = maximumEntries
        self.maximumBytes = maximumBytes
        self.lifetime = lifetime
        self.now = now
    }

    func store(
        _ snapshot: SafariReadSnapshot,
        for fileURL: String,
        fingerprint: SafariFileFingerprint? = nil
    ) {
        lock.lock()
        defer { lock.unlock() }

        let current = now()
        removeExpired(at: current)
        entries.removeAll { $0.fileURL == fileURL }
        guard snapshot.totalBytes <= maximumBytes else {
            return
        }
        entries.append(Entry(
            fileURL: fileURL,
            snapshot: snapshot,
            fingerprint: fingerprint,
            expiresAt: current.addingTimeInterval(lifetime),
            lastAccessedAt: current
        ))
        evictIfNeeded()
    }

    func snapshot(for fileURL: String, digest: String) -> SafariReadSnapshot? {
        lock.lock()
        defer { lock.unlock() }

        let current = now()
        removeExpired(at: current)
        guard let index = entries.firstIndex(where: {
            $0.fileURL == fileURL && $0.snapshot.digest == digest
        }) else {
            return nil
        }
        entries[index].lastAccessedAt = current
        return entries[index].snapshot
    }

    func snapshot(
        for fileURL: String,
        fingerprint: SafariFileFingerprint
    ) -> SafariReadSnapshot? {
        lock.lock()
        defer { lock.unlock() }

        let current = now()
        removeExpired(at: current)
        guard let index = entries.firstIndex(where: {
            $0.fileURL == fileURL && $0.fingerprint == fingerprint
        }) else {
            return nil
        }
        entries[index].lastAccessedAt = current
        return entries[index].snapshot
    }

    private func removeExpired(at date: Date) {
        entries.removeAll { $0.expiresAt <= date }
    }

    private func evictIfNeeded() {
        while entries.count > maximumEntries || totalBytes > maximumBytes {
            guard let oldestIndex = entries.indices.min(by: {
                entries[$0].lastAccessedAt < entries[$1].lastAccessedAt
            }) else {
                return
            }
            entries.remove(at: oldestIndex)
        }
    }

    private var totalBytes: Int {
        entries.reduce(0) { $0 + $1.snapshot.totalBytes }
    }
}

import Foundation
import XCTest
@testable import SafariNativeBridge

final class NativeMessageTests: XCTestCase {
    func testDecodesSupportedRequests() throws {
        let digest = String(repeating: "a", count: 64)
        let cases: [(String, SafariNativeOperation)] = [
            (#"{"protocolVersion":1,"requestId":"ping_1","operation":"ping"}"#, .ping),
            (#"{"protocolVersion":1,"requestId":"meta_1","operation":"readMetadata","fileUrl":"file:///tmp/test.js"}"#, .readMetadata),
            (#"{"protocolVersion":1,"requestId":"chunk_1","operation":"readChunk","fileUrl":"file:///tmp/test.js","digest":"\#(digest)","chunkIndex":0}"#, .readChunk),
            (#"{"protocolVersion":1,"requestId":"authorize_1","operation":"authorizeFolder","fileUrl":"file:///tmp/test.js"}"#, .authorizeFolder),
        ]

        for (json, operation) in cases {
            let request = try SafariNativeMessageCodec.decodeRequest(Data(json.utf8))
            XCTAssertEqual(request.operation, operation)
        }
    }

    func testRejectsUnknownKeys() {
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"ping_1","operation":"ping","extra":true}"#,
            code: .invalidMessage
        )
    }

    func testRejectsUnknownOperationWithSpecificError() {
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"unknown_1","operation":"unknown"}"#,
            code: .unsupportedOperation
        )
    }

    func testRejectsFieldsThatDoNotMatchOperation() {
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"ping_1","operation":"ping","fileUrl":"file:///tmp/test.js"}"#,
            code: .invalidMessage
        )
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"meta_1","operation":"readMetadata"}"#,
            code: .invalidMessage
        )
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"chunk_1","operation":"readChunk","fileUrl":"file:///tmp/test.js"}"#,
            code: .invalidMessage
        )
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"authorize_1","operation":"authorizeFolder"}"#,
            code: .invalidMessage
        )
    }

    func testRejectsInvalidRequestIdentifiers() {
        for requestId in ["", "contains space", String(repeating: "a", count: 65)] {
            let json = #"{"protocolVersion":1,"requestId":"\#(requestId)","operation":"ping"}"#
            assertDecodeError(json, code: .invalidRequestId)
        }
    }

    func testRejectsOversizedRequestsBeforeDecoding() {
        let data = Data(repeating: 0x20, count: SafariNativeLimit.requestBytes + 1)
        XCTAssertThrowsError(try SafariNativeMessageCodec.decodeRequest(data)) { error in
            XCTAssertEqual((error as? SafariNativeBridgeError)?.code, .messageTooLarge)
        }
    }

    func testRejectsInvalidDigestAndChunkIndex() {
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"chunk_1","operation":"readChunk","fileUrl":"file:///tmp/test.js","digest":"ABC","chunkIndex":0}"#,
            code: .invalidMessage
        )
        assertDecodeError(
            #"{"protocolVersion":1,"requestId":"chunk_1","operation":"readChunk","fileUrl":"file:///tmp/test.js","digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","chunkIndex":10}"#,
            code: .invalidMessage
        )
    }

    func testErrorCodesRemainClosedAndCodable() throws {
        for code in SafariNativeErrorCode.allCases {
            let response = SafariErrorResponse(requestId: "error_1", code: code)
            let encoded = try SafariNativeMessageCodec.encodeResponse(response)
            let object = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
            let error = try XCTUnwrap(object["error"] as? [String: String])
            XCTAssertEqual(error["code"], code.rawValue)
        }
    }

    func testRejectsResponsesAtOneMiB() {
        let response = OversizedResponse(payload: String(
            repeating: "a",
            count: SafariNativeLimit.responseBytes
        ))
        XCTAssertThrowsError(try SafariNativeMessageCodec.encodeResponse(response)) { error in
            XCTAssertEqual((error as? SafariNativeBridgeError)?.code, .messageTooLarge)
        }
    }

    func testMetadataResponseCarriesTheFirstChunkWithinTheResponseLimit() throws {
        let bytes = Data(
            repeating: 0x61,
            count: SafariNativeLimit.rawChunkBytes
        )
        let response = SafariReadMetadataResponse(
            requestId: "metadata_1",
            snapshot: SafariReadSnapshot(
                bytes: bytes,
                digest: String(repeating: "a", count: 64),
                totalBytes: bytes.count,
                chunkCount: 1
            )
        )

        let encoded = try SafariNativeMessageCodec.encodeResponse(response)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        )

        XCTAssertEqual(object["firstChunk"] as? String, bytes.base64EncodedString())
        XCTAssertLessThan(encoded.count, SafariNativeLimit.responseBytes)
    }

    private func assertDecodeError(
        _ json: String,
        code: SafariNativeErrorCode,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertThrowsError(
            try SafariNativeMessageCodec.decodeRequest(Data(json.utf8)),
            file: file,
            line: line
        ) { error in
            XCTAssertEqual(
                (error as? SafariNativeBridgeError)?.code,
                code,
                file: file,
                line: line
            )
        }
    }
}

private struct OversizedResponse: Encodable {
    let payload: String
}

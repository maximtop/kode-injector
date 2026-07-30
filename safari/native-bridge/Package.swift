// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SafariNativeBridge",
    platforms: [
        .macOS(.v12),
    ],
    products: [
        .library(
            name: "SafariNativeBridge",
            targets: ["SafariNativeBridge"]
        ),
    ],
    targets: [
        .target(
            name: "SafariNativeBridge",
            resources: [
                .process("Resources"),
            ]
        ),
        .testTarget(
            name: "SafariNativeBridgeTests",
            dependencies: ["SafariNativeBridge"]
        ),
    ]
)

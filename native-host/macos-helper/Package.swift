// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "KodeInjectorHelper",
    platforms: [
        .macOS(.v12),
    ],
    products: [
        .executable(
            name: "KodeInjectorHelper",
            targets: ["KodeInjectorHelper"]
        ),
    ],
    targets: [
        .executableTarget(name: "KodeInjectorHelper"),
        .testTarget(
            name: "KodeInjectorHelperTests",
            dependencies: ["KodeInjectorHelper"]
        ),
    ]
)

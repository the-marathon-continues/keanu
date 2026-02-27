// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "KeanuKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "KeanuProtocol", targets: ["KeanuProtocol"]),
        .library(name: "KeanuKit", targets: ["KeanuKit"]),
        .library(name: "KeanuChatUI", targets: ["KeanuChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "KeanuProtocol",
            path: "Sources/KeanuProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "KeanuKit",
            dependencies: [
                "KeanuProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/KeanuKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "KeanuChatUI",
            dependencies: [
                "KeanuKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/KeanuChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "KeanuKitTests",
            dependencies: ["KeanuKit", "KeanuChatUI"],
            path: "Tests/KeanuKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])

// swift-tools-version: 6.2
// Package manifest for the Keanu macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "Keanu",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "KeanuIPC", targets: ["KeanuIPC"]),
        .library(name: "KeanuDiscovery", targets: ["KeanuDiscovery"]),
        .executable(name: "Keanu", targets: ["Keanu"]),
        .executable(name: "keanu-mac", targets: ["KeanuMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/KeanuKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "KeanuIPC",
            dependencies: [],
            path: "Sources/KeanuIPC",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "KeanuDiscovery",
            dependencies: [
                .product(name: "KeanuKit", package: "KeanuKit"),
            ],
            path: "Sources/KeanuDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Keanu",
            dependencies: [
                "KeanuIPC",
                "KeanuDiscovery",
                .product(name: "KeanuKit", package: "KeanuKit"),
                .product(name: "KeanuChatUI", package: "KeanuKit"),
                .product(name: "KeanuProtocol", package: "KeanuKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            path: "Sources/Keanu",
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/Keanu.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "KeanuMacCLI",
            dependencies: [
                "KeanuDiscovery",
                .product(name: "KeanuKit", package: "KeanuKit"),
                .product(name: "KeanuProtocol", package: "KeanuKit"),
            ],
            path: "Sources/KeanuMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "KeanuIPCTests",
            dependencies: [
                "KeanuIPC",
                "Keanu",
                "KeanuDiscovery",
                .product(name: "KeanuProtocol", package: "KeanuKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])

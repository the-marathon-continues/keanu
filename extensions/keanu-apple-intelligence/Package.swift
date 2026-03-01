// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "KEANUAppleIntelligence",
    platforms: [
        .macOS(.v26),
        .iOS(.v26)
    ],
    products: [
        .library(name: "KEANUCore", targets: ["KEANUCore"]),
        .library(name: "KEANUIntents", targets: ["KEANUIntents"]),
        .library(name: "KEANUBridge", targets: ["KEANUBridge"]),
        .library(name: "KEANUFoundation", targets: ["KEANUFoundation"]),
    ],
    targets: [
        // Core routing engine, context manager, signal protocol
        .target(
            name: "KEANUCore",
            dependencies: []
        ),
        // App Intents: Apple calls INTO KEANU
        .target(
            name: "KEANUIntents",
            dependencies: ["KEANUCore"]
        ),
        // Apple Intelligence Bridge: KEANU calls INTO Apple
        .target(
            name: "KEANUBridge",
            dependencies: ["KEANUCore"]
        ),
        // Foundation Models integration: on-device LLM + tool calling
        .target(
            name: "KEANUFoundation",
            dependencies: ["KEANUCore", "KEANUBridge"]
        ),
        .testTarget(
            name: "KEANUTests",
            dependencies: ["KEANUCore", "KEANUIntents", "KEANUBridge", "KEANUFoundation"],
            path: "Tests"
        ),
    ]
)

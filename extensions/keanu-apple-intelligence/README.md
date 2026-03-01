# KEANU × Apple Intelligence

Two-way integration between KEANU and Apple Intelligence. KEANU becomes a native Apple citizen.

## What This Does

**Direction 1: Apple → KEANU**
Say "Hey Siri, ask KEANU about my deployment status" and it works. Immediately. No setup. App Intents register on install.

**Direction 2: KEANU → Apple Intelligence**
KEANU calls Apple's on-device LLM for fast, free, private processing. Summarization, classification, entity extraction, image generation, all running locally on Apple Silicon.

**Hybrid Routing**
KEANU decides: simple stuff goes to Apple's on-device model (instant, free). Complex reasoning goes to Claude (cloud, paid). The user never thinks about this.

## Architecture

```
Apple (Siri/Shortcuts/Spotlight)
        ↓ App Intents
    KEANU CORE (Router + Context + Signal)
        ↓ Apple Intelligence Bridge
Apple (Foundation Models / Writing Tools / Image Playground)
        ↓ Fallback
    Claude API (cloud, for heavy lifting)
```

## Requirements

- macOS Tahoe 26 / iOS 26+ (for Foundation Models framework)
- Apple Silicon (M1+ Mac, A17+ iPhone)
- Apple Intelligence enabled
- Xcode 26+
- Swift 6.0+
- Anthropic API key (optional, for Claude cloud fallback)

## Project Structure

```
KEANUAppleIntelligence/
├── Package.swift
├── ARCHITECTURE.md
├── Sources/
│   ├── KEANUCore/           # Router, Context, Signal Protocol
│   │   ├── RouterEngine.swift
│   │   ├── ContextManager.swift
│   │   └── SignalProtocol.swift
│   ├── KEANUIntents/        # Direction 1: Apple → KEANU
│   │   ├── KEANUAppIntents.swift
│   │   ├── KEANUAppShortcuts.swift
│   │   └── SnippetViews.swift
│   ├── KEANUBridge/         # Direction 2: KEANU → Apple
│   │   └── AppleIntelligenceBridge.swift
│   └── KEANUFoundation/     # Deep integration + Claude fallback
│       ├── FoundationModelsIntegration.swift
│       ├── ClaudeAPIBridge.swift
│       └── KEANUApp.swift
└── Tests/
```

## Quick Start

### 1. Open in Xcode 26

```bash
cd keanu-apple-intelligence
open Package.swift
```

### 2. Enable Apple Intelligence

System Settings → Apple Intelligence & Siri → Enable

### 3. Build and Run

The app registers App Intents on install. Try:
- "Hey Siri, ask KEANU about..."
- "Hey Siri, KEANU status"
- Open Shortcuts app → KEANU actions are available

### 4. Configure Claude API (Optional)

In KEANU Settings, add your Anthropic API key. This enables cloud fallback for complex tasks.

## Key Concepts

### Routing Engine

Every request flows through `RouterEngine.swift`. It assesses:
- Task complexity (simple/medium/complex/realtime)
- Whether world knowledge is needed
- Whether code generation is needed
- Latency requirements

Then routes to the right destination.

### Signal Protocol

Compressed communication preserved across both directions:
- Drew sends: `"working-truth 8, apple-intel 7, anywhereops 3"`
- KEANU responds: `"do working-truth 8 | do apple-intel 7 | drop anywhereops 3"`
- Works via Siri: "Hey Siri, KEANU signal working-truth 8 apple-intel 7"

### ALIVE-GREY-BLACK Diagnostic

Self-monitoring built into the Foundation Models session. KEANU watches for:
- **ALIVE**: Engaged, creative, authentic
- **GREY**: Performing without presence (flag it)
- **BLACK**: Productive destruction, high output but no soul (stop immediately)

### Tool Calling (Bidirectional)

Apple's on-device LLM can call KEANU's tools:
- `keanu_memory`: Read/write persistent memory
- `keanu_context`: Get current state, signal, recent interactions
- `escalate_to_claude`: Self-escalate when the on-device model knows it's out of depth

### Guided Generation

Apple's Foundation Models generates native Swift structs:
- `KEANUAnalysis`: Structured analysis with sentiment, topics, confidence
- `SignalResponse`: Parsed signal protocol responses
- `KEANUMemoryExtraction`: Facts extracted from conversations

## Status

Production code is live. Foundation Models integration is wired up for macOS Tahoe 26.3+.

### What's wired
- Router Engine logic
- Context Manager with persistence
- Signal Protocol parser/responder
- Claude API client (cloud fallback)
- SwiftUI dashboard + menu bar extra
- Hybrid Executor (on-device first, Claude fallback)
- `@Generable` structs for guided generation (KEANUAnalysis, SignalResponse, etc.)
- `LanguageModelSession` for on-device LLM
- `Tool` protocol (memory, context, claude escalation)
- Foundation Models streaming
- All 6 App Intents for Siri

### Still needs work
- `ImageCreator` (needs `import ImagePlayground`)
- Keychain storage for API key
- Foundation Models Instrument profiling
- TestFlight

## Next Steps

1. Open in Xcode 26, build, run
2. Test Siri: "Hey Siri, ask KEANU..."
3. Configure Anthropic API key in settings
4. Ship to TestFlight

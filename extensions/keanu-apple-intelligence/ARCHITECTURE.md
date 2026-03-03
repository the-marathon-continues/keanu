# KEANU × Apple Intelligence: Two-Way Integration Architecture

## Overview

KEANU becomes a native Apple Intelligence citizen. Two directions, one agent.

```
┌─────────────────────────────────────────────────────────┐
│                    APPLE ECOSYSTEM                      │
│                                                         │
│  Siri ──┐    Shortcuts ─
─┐    Spotlight ──┐             │
│         │                │                │             │
│         ▼                ▼                ▼             │
│    ┌──────────────────────────────────────────┐         │
│    │         App Intents Layer                 │        │
│    │    (Apple calls INTO KEANU)               │        │
│    └──────────────────┬───────────────────────┘         │
│                       │                                 │
│                       ▼                                 │
│    ┌──────────────────────────────────────────┐         │
│    │           KEANU CORE                      │        │
│    │                                           │        │
│    │  ┌─────────┐  ┌──────────┐  ┌─────────┐ │          │
│    │  │ Router  │  │ Context  │  │ Signal  │ │          │
│    │  │ Engine  │  │ Manager  │  │ Protocol│ │          │
│    │  └────┬────┘  └────┬─────┘  └────┬────┘ │          │
│    │       │            │             │       │         │
│    └───────┼────────────┼─────────────┼──────┘          │
│            │            │             │                 │
│            ▼            ▼             ▼                 │
│    ┌──────────────────────────────────────────┐         │
│    │       Apple Intelligence Bridge           │        │
│    │    (KEANU calls INTO Apple)                │       │
│    └──────────────────┬───────────────────────┘         │
│                       │                                 │
│         ┌─────────────┼──────────────┐                  │
│         ▼             ▼              ▼                  │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐         │
│  │ Foundation │ │ Writing  │ │ Image          │         │
│  │ Models     │ │ Tools    │ │ Playground     │         │
│  │ (On-Device │ │ API      │ │ /ImageCreator  │         │
│  │  LLM)      │ │          │ │                │         │
│  └────────────┘ └──────────┘ └────────────────┘         │
│                                                         │
│  + Claude API (cloud, for heavy reasoning)              │
└─────────────────────────────────────────────────────────┘
```

## Direction 1: Apple → KEANU (Inbound)

**How**: App Intents framework + App Shortcuts

The system (Siri, Shortcuts, Spotlight, Action Button) triggers KEANU actions.

### Exposed Intents

| Intent              | Siri Phrase               | What It Does                                           |
| ------------------- | ------------------------- | ------------------------------------------------------ |
| `AskKEANUIntent`    | "Ask KEANU about..."      | Routes a query through KEANU's reasoning pipeline      |
| `KEANUStatusIntent` | "KEANU status"            | Returns current signal, active projects, context state |
| `KEANURouteIntent`  | "Route this to KEANU"     | Takes clipboard/selected text, processes through KEANU |
| `KEANUMemoryIntent` | "KEANU remember..."       | Stores context in KEANU's persistent memory            |
| `KEANUSignalIntent` | "KEANU signal"            | Returns compressed signal state (emoji protocol)       |
| `KEANUActionIntent` | "KEANU do/refine/drop..." | Executes signal protocol commands                      |

### App Shortcuts (Zero-Config Siri)

These are available immediately on install, no setup needed:

- "Hey Siri, ask KEANU"
- "Hey Siri, what's KEANU thinking?"
- "Hey Siri, KEANU status check"

## Direction 2: KEANU → Apple Intelligence (Outbound)

**How**: Foundation Models framework + Apple Intelligence APIs

KEANU leverages Apple's on-device AI for local processing, privacy, and speed.

### Capabilities KEANU Can Call

| Capability        | Framework                      | Use Case                                                    |
| ----------------- | ------------------------------ | ----------------------------------------------------------- |
| On-device LLM     | Foundation Models              | Fast local summarization, classification, entity extraction |
| Guided Generation | Foundation Models              | Structured Swift output from natural language               |
| Tool Calling      | Foundation Models              | Let Apple's LLM invoke KEANU's tools                        |
| Writing Tools     | WritingTools API               | Rewrite/proofread/summarize text                            |
| Image Generation  | ImagePlayground / ImageCreator | Generate images on-device                                   |
| Smart Reply       | System APIs                    | Context-aware reply suggestions                             |

### Hybrid Routing: Apple On-Device vs Claude Cloud

KEANU decides where to route based on task complexity:

```
Task Complexity Assessment
├── Simple (summarize, classify, extract) → Apple Foundation Models (on-device, instant, free)
├── Medium (multi-step reasoning, context) → Apple FM + KEANU routing layer
└── Complex (deep reasoning, world knowledge, code) → Claude API (cloud)
```

## Requirements

- macOS Tahoe 26 / iOS 26+ (Foundation Models framework)
- Apple Silicon (M1+ for macOS, A17+ for iOS)
- Apple Intelligence enabled on device
- Xcode 26+
- Swift 6.0+

## Key Design Decisions

1. **Privacy first**: On-device by default. Claude API only when Apple FM can't handle it.
2. **KEANU is the router**: All requests flow through KEANU's routing engine, which decides local vs cloud.
3. **Signal protocol preserved**: The emoji/compressed signal system works across both directions.
4. **Persistent context**: KEANU maintains conversation state across Siri interactions using App Intent sessions.
5. **Tool calling bidirectional**: Apple's FM can call KEANU tools, and KEANU can call Apple's capabilities.

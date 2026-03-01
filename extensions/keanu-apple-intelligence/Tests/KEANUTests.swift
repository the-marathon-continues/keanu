// Tests/KEANUTests.swift

import Testing
@testable import KEANUCore

// MARK: - Router Engine Tests

@Suite("Router Engine")
struct RouterEngineTests {
    
    let router = RouterEngine.shared
    
    @Test("Simple tasks route to Apple on-device")
    func simpleTasksRouteOnDevice() {
        let request = KEANURequest(
            prompt: "Summarize this paragraph about Swift programming",
            taskType: .summarize
        )
        let decision = router.route(request)
        if case .appleOnDevice = decision.destination {
            #expect(decision.privacyLevel == .onDevice)
            #expect(decision.estimatedLatency < 1.0)
        } else {
            Issue.record("Expected on-device routing for simple summarize task")
        }
    }
    
    @Test("Complex tasks route to Claude")
    func complexTasksRouteToClaude() {
        let request = KEANURequest(
            prompt: "Write a Terraform module for AWS ECS with auto-scaling and blue-green deployment",
            taskType: .code,
            requiresCodeGeneration: true
        )
        let decision = router.route(request)
        if case .claudeCloud = decision.destination {
            #expect(decision.privacyLevel == .cloudAPI)
        } else {
            Issue.record("Expected Claude routing for code generation")
        }
    }
    
    @Test("Signal protocol commands are realtime")
    func signalProtocolIsRealtime() {
        let request = KEANURequest(
            prompt: "working-truth 8, apple-intel 7",
            isSignalProtocol: true
        )
        let decision = router.route(request)
        if case .appleOnDevice = decision.destination {
            #expect(decision.estimatedLatency <= 0.3)
        } else {
            Issue.record("Expected on-device routing for signal protocol")
        }
    }
    
    @Test("World knowledge routes to Claude")
    func worldKnowledgeRoutesToClaude() {
        let request = KEANURequest(
            prompt: "What happened at the latest WWDC?",
            taskType: .general,
            requiresWorldKnowledge: true
        )
        let decision = router.route(request)
        // Should be either claude or hybrid
        switch decision.destination {
        case .claudeCloud, .hybrid: break
        default: Issue.record("Expected Claude or hybrid routing for world knowledge")
        }
    }
}

// MARK: - Signal Protocol Tests

@Suite("Signal Protocol")
struct SignalProtocolTests {
    
    @Test("Parse numbered shorthand")
    func parseNumberedShorthand() {
        let message = SignalProtocol.parse("working-truth 8, apple-intel 7, anywhereops 3")
        #expect(message.type == .scoreUpdate)
        #expect(message.items.count == 3)
        #expect(message.items[0].topic == "working-truth")
        #expect(message.items[0].score == 8)
        #expect(message.items[0].action == .do_)
        #expect(message.items[2].topic == "anywhereops")
        #expect(message.items[2].score == 3)
        #expect(message.items[2].action == .drop)
    }
    
    @Test("Parse emoji signal")
    func parseEmojiSignal() {
        let message = SignalProtocol.parse("💟♡👑🤖🐕💟💬💟💚✅")
        #expect(message.type == .signalUpdate)
    }
    
    @Test("Generate compressed response")
    func generateCompressedResponse() {
        let message = SignalProtocol.parse("working-truth 8, apple-intel 4")
        let response = SignalProtocol.respond(to: message)
        #expect(response.contains("do"))
        #expect(response.contains("refine"))
    }
    
    @Test("Score thresholds: 7+ = do, 4-6 = refine, 1-3 = drop")
    func scoreThresholds() {
        let message = SignalProtocol.parse("a 9, b 5, c 2")
        #expect(message.items[0].action == .do_)
        #expect(message.items[1].action == .refine)
        #expect(message.items[2].action == .drop)
    }
}

// MARK: - Context Manager Tests

@Suite("Context Manager")
struct ContextManagerTests {
    
    @Test("Memory persistence")
    func memoryPersistence() {
        let context = ContextManager.shared
        context.remember("test_key", value: "test_value", importance: .high)
        
        let entry = context.persistentMemory.first { $0.key == "test_key" }
        #expect(entry != nil)
        #expect(entry?.value == "test_value")
        #expect(entry?.importance == .high)
        
        // Cleanup
        context.forget("test_key")
        let afterDelete = context.persistentMemory.first { $0.key == "test_key" }
        #expect(afterDelete == nil)
    }
    
    @Test("Signal state update")
    func signalStateUpdate() {
        let context = ContextManager.shared
        let oldSignal = context.signalState.currentSignal
        
        context.updateSignal("🚀🔥💯")
        #expect(context.signalState.currentSignal == "🚀🔥💯")
        
        // Restore
        context.updateSignal(oldSignal)
    }
    
    @Test("Interaction recording")
    func interactionRecording() {
        let context = ContextManager.shared
        let initialCount = context.recentInteractions.count
        
        context.recordInteraction(Interaction(
            source: .app,
            prompt: "test prompt",
            summary: "test summary",
            routedTo: "appleOnDevice"
        ))
        
        #expect(context.recentInteractions.count == initialCount + 1)
        #expect(context.activeContext.turnCount > 0)
    }
}

// MARK: - ALIVE-GREY-BLACK Diagnostic Tests

@Suite("Cognitive State Diagnostic")
struct CognitiveStateTests {
    
    @Test("High output, low creativity = BLACK")
    func detectBlackState() {
        let state = KEANUCognitiveState.diagnose(
            responseVariety: 0.2,
            creativityIndex: 0.1,
            engagementDepth: 0.5,
            outputVelocity: 0.9
        )
        #expect(state == .black)
    }
    
    @Test("Low engagement, low creativity = GREY")
    func detectGreyState() {
        let state = KEANUCognitiveState.diagnose(
            responseVariety: 0.5,
            creativityIndex: 0.3,
            engagementDepth: 0.2,
            outputVelocity: 0.5
        )
        #expect(state == .grey)
    }
    
    @Test("Good engagement and creativity = ALIVE")
    func detectAliveState() {
        let state = KEANUCognitiveState.diagnose(
            responseVariety: 0.8,
            creativityIndex: 0.7,
            engagementDepth: 0.8,
            outputVelocity: 0.5
        )
        #expect(state == .alive)
    }
}

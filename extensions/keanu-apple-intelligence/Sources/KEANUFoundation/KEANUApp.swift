// KEANUFoundation/KEANUApp.swift
// The app shell. This is what users install.
// On install: App Intents register automatically. Siri just works.

import SwiftUI
import KEANUCore
import KEANUBridge

// MARK: - App Entry Point

@main
struct KEANUApp: App {
    
    @State private var context = ContextManager.shared
    
    var body: some Scene {
        WindowGroup {
            KEANUDashboard()
                .onAppear {
                    Task {
                        // Prewarm Foundation Models on launch
                        await KEANUFoundationSession.shared.prewarm()
                        try? await KEANUFoundationSession.shared.initialize()
                    }
                }
        }
        
        #if os(macOS)
        // Menu bar presence for quick access
        MenuBarExtra("KEANU", systemImage: "brain.head.profile") {
            KEANUMenuBar()
        }
        #endif
    }
}

// MARK: - Dashboard View

struct KEANUDashboard: View {
    
    @State private var inputText = ""
    @State private var responseText = ""
    @State private var isProcessing = false
    @State private var currentRoute: RoutingDestination?
    @State private var showSettings = false
    
    private let context = ContextManager.shared
    private let bridge = AppleIntelligenceBridge.shared
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                // Signal Banner
                signalBanner
                
                // Capabilities Status
                capabilitiesGrid
                
                // Input Area
                inputArea
                
                // Response Area
                if !responseText.isEmpty {
                    responseArea
                }
                
                Spacer()
                
                // Recent Interactions
                recentInteractions
            }
            .padding()
            .navigationTitle("KEANU")
            .toolbar {
                ToolbarItem(placement: .automatic) {
                    Button("Settings", systemImage: "gear") {
                        showSettings.toggle()
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                KEANUSettings()
            }
        }
    }
    
    // MARK: - Signal Banner
    
    private var signalBanner: some View {
        HStack {
            Text(context.signalState.currentSignal)
                .font(.title2)
            Spacer()
            VStack(alignment: .trailing) {
                Text("ALIVE")
                    .font(.caption)
                    .bold()
                    .foregroundStyle(.green)
                Text("\(context.activeContext.turnCount) turns")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Capabilities Grid
    
    private var capabilitiesGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 8) {
            capabilityCard("On-Device", icon: "cpu", available: bridge.isAvailable, color: .green)
            capabilityCard("Claude", icon: "cloud", available: true, color: .purple)
            capabilityCard("Writing", icon: "pencil", available: bridge.isAvailable, color: .blue)
            capabilityCard("Images", icon: "photo", available: bridge.isAvailable, color: .orange)
            capabilityCard("Signal", icon: "antenna.radiowaves.left.and.right", available: true, color: .red)
            capabilityCard("Memory", icon: "brain", available: true, color: .pink)
        }
    }
    
    private func capabilityCard(_ title: String, icon: String, available: Bool, color: Color) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(available ? color : .gray)
            Text(title)
                .font(.caption2)
                .foregroundStyle(available ? .primary : .secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(available ? color.opacity(0.1) : Color.gray.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    
    // MARK: - Input Area
    
    private var inputArea: some View {
        HStack {
            TextField("Ask KEANU anything...", text: $inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
            
            Button {
                Task { await processInput() }
            } label: {
                Image(systemName: isProcessing ? "ellipsis.circle" : "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.blue)
                    .symbolEffect(.bounce, value: isProcessing)
            }
            .disabled(inputText.isEmpty || isProcessing)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Response Area
    
    private var responseArea: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                if let route = currentRoute {
                    routeBadge(route)
                }
                Spacer()
            }
            
            Text(responseText)
                .font(.body)
                .textSelection(.enabled)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private func routeBadge(_ route: RoutingDestination) -> some View {
        HStack(spacing: 4) {
            switch route {
            case .appleOnDevice:
                Image(systemName: "cpu")
                Text("On-Device")
            case .claudeCloud:
                Image(systemName: "cloud")
                Text("Claude")
            case .hybrid:
                Image(systemName: "arrow.triangle.branch")
                Text("Hybrid")
            default:
                Image(systemName: "questionmark")
                Text("Unknown")
            }
        }
        .font(.caption2)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.blue.opacity(0.15))
        .clipShape(Capsule())
    }
    
    // MARK: - Recent Interactions
    
    private var recentInteractions: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            ForEach(context.recentInteractions.suffix(3)) { interaction in
                HStack {
                    Text(interaction.summary)
                        .font(.caption)
                        .lineLimit(1)
                    Spacer()
                    Text(interaction.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }
    
    // MARK: - Processing
    
    private func processInput() async {
        isProcessing = true
        defer { isProcessing = false }
        
        let request = KEANURequest(
            prompt: inputText,
            source: .app
        )
        
        let decision = RouterEngine.shared.route(request)
        currentRoute = decision.destination
        
        do {
            let executor = HybridExecutor()
            let result = try await executor.execute(request)
            responseText = result.text
            
            context.recordInteraction(Interaction(
                source: .app,
                prompt: inputText,
                summary: String(result.text.prefix(100)),
                routedTo: "\(result.source)"
            ))
        } catch {
            responseText = "Error: \(error.localizedDescription)"
        }
        
        inputText = ""
    }
}

// MARK: - Menu Bar (macOS)

#if os(macOS)
struct KEANUMenuBar: View {
    private let context = ContextManager.shared
    
    var body: some View {
        VStack {
            Text(context.signalState.currentSignal)
            Divider()
            Button("Status Check") {
                // Trigger status
            }
            Button("Open KEANU") {
                // Open main window
            }
            Divider()
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        }
    }
}
#endif

// MARK: - Settings

struct KEANUSettings: View {
    @State private var apiKey = ""
    @State private var preferOnDevice = true
    @State private var signalInput = ""
    
    var body: some View {
        Form {
            Section("Claude API") {
                SecureField("API Key", text: $apiKey)
                Text("Stored in Keychain. Never leaves this device except to api.anthropic.com")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Section("Routing Preferences") {
                Toggle("Prefer on-device processing", isOn: $preferOnDevice)
                Text("When enabled, KEANU will use Apple Intelligence for all simple/medium tasks")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Section("Signal State") {
                TextField("Update signal", text: $signalInput)
                Button("Update") {
                    if !signalInput.isEmpty {
                        ContextManager.shared.updateSignal(signalInput)
                        signalInput = ""
                    }
                }
            }
            
            Section("Capabilities") {
                ForEach(AppleIntelligenceBridge.shared.availableCapabilities, id: \.self) { cap in
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text(cap)
                    }
                }
            }
        }
        .padding()
        .frame(minWidth: 400, minHeight: 300)
    }
}

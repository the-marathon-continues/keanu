import Testing
import Foundation
@testable import KeanuExtensionKit

@Suite("Extension Event Tests")
struct ExtensionEventTests {

    @Test("DNS Query Event encodes and decodes correctly")
    func dnsQueryEventCodable() throws {
        let event = DNSQueryEvent(
            timestamp: Date(),
            domain: "example.com",
            queryType: "A",
            sourceApp: "com.apple.Safari"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(ExtensionEvent.dnsQuery(event))

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ExtensionEvent.self, from: data)

        if case .dnsQuery(let decodedEvent) = decoded {
            #expect(decodedEvent.domain == "example.com")
            #expect(decodedEvent.queryType == "A")
            #expect(decodedEvent.sourceApp == "com.apple.Safari")
        } else {
            Issue.record("Expected DNS query event")
        }
    }

    @Test("Process Exec Event encodes and decodes correctly")
    func processExecEventCodable() throws {
        let event = ProcessExecEvent(
            path: "/usr/bin/ls",
            args: ["-la", "/tmp"],
            processId: 1234,
            parentProcessId: 1,
            userId: 501,
            userName: "andrew"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(ExtensionEvent.processExec(event))

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ExtensionEvent.self, from: data)

        if case .processExec(let decodedEvent) = decoded {
            #expect(decodedEvent.path == "/usr/bin/ls")
            #expect(decodedEvent.args == ["-la", "/tmp"])
            #expect(decodedEvent.processId == 1234)
        } else {
            Issue.record("Expected process exec event")
        }
    }

    @Test("Extension Policy has sensible defaults")
    func policyDefaults() {
        let policy = ExtensionPolicy.default

        #expect(policy.mode == .observe)
        #expect(policy.monitorSelf == false)
        #expect(policy.excludedPaths.contains("/System/"))
        #expect(policy.retention.maxDNSQueries == 1000)
    }
}

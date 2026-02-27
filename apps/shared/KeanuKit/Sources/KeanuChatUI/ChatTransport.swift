import Foundation

public enum KeanuChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(KeanuChatEventPayload)
    case agent(KeanuAgentEventPayload)
    case seqGap
}

public protocol KeanuChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> KeanuChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [KeanuChatAttachmentPayload]) async throws -> KeanuChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> KeanuChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<KeanuChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension KeanuChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "KeanuChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> KeanuChatSessionsListResponse {
        throw NSError(
            domain: "KeanuChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}

import Foundation

public enum KeanuRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum KeanuReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct KeanuRemindersListParams: Codable, Sendable, Equatable {
    public var status: KeanuReminderStatusFilter?
    public var limit: Int?

    public init(status: KeanuReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct KeanuRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct KeanuReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct KeanuRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [KeanuReminderPayload]

    public init(reminders: [KeanuReminderPayload]) {
        self.reminders = reminders
    }
}

public struct KeanuRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: KeanuReminderPayload

    public init(reminder: KeanuReminderPayload) {
        self.reminder = reminder
    }
}

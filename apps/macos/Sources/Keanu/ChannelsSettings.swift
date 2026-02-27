import AppKit
import SwiftUI

struct ChannelsSettings: View {
    struct ChannelItem: Identifiable, Hashable {
        let id: String
        let title: String
        let detailTitle: String
        let systemImage: String
        let sortOrder: Int
    }

    @Bindable var store: ChannelsStore
    @State var selectedChannel: ChannelItem?
    @State var showDetail: Bool = false
    @State var showSetupWizard: Bool = false
    @State var setupWizardChannelId: String?

    init(store: ChannelsStore = .shared) {
        self.store = store
    }
}

import SwiftUI

struct DashboardRootView: View {
    @State private var selection: DashboardSection = .pulse
    private var awareness = KeanuAwarenessStore.shared

    var body: some View {
        NavigationSplitView {
            DashboardSidebar(selection: self.$selection)
        } detail: {
            self.detailView
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationTitle(self.selection.label)
        .frame(minWidth: 720, minHeight: 480)
    }

    @ViewBuilder
    private var detailView: some View {
        switch self.selection {
        case .pulse:
            DashboardPulseView()
        case .signal:
            DashboardSignalView()
        case .detections:
            DashboardDetectionsView()
        default:
            self.placeholder
        }
    }

    private var placeholder: some View {
        VStack(spacing: 12) {
            Image(systemName: self.selection.icon)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text(self.selection.label)
                .font(.title2)
                .foregroundStyle(.secondary)
            if self.awareness.receiving {
                Text(self.awareness.coefEmoji)
                    .font(.title)
            } else {
                Text("Waiting for signal...")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct DashboardSidebar: View {
    @Binding var selection: DashboardSection

    var body: some View {
        List(selection: self.$selection) {
            ForEach(DashboardSection.SectionGroup.allCases, id: \.self) { group in
                Section(group.rawValue) {
                    ForEach(DashboardSection.allCases.filter { $0.group == group }) { section in
                        Label(section.label, systemImage: section.icon)
                            .tag(section)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .frame(minWidth: 180)
    }
}

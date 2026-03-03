import Foundation

/// Resource bundle accessor for Keanu app target.
///
/// SPM generates `Bundle.module` for packages, but Xcode projects need this defined manually.
/// For the main app, `Bundle.module` maps to `Bundle.main` since resources are in the app bundle.
extension Bundle {
    /// The bundle containing Keanu app resources.
    static let module: Bundle = .main
}

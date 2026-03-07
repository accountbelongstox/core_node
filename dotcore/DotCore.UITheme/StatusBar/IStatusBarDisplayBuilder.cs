namespace DotCore.UITheme.StatusBar;

/// <summary>
/// Builds status bar display from app state snapshot and i18n. App provides implementation (subclass / D3-specific).
/// </summary>
public interface IStatusBarDisplayBuilder
{
    /// <summary>Build display data from current state and i18n. Pure: no side effects.</summary>
    IStatusBarDisplay Build(object stateSnapshot, object i18nProvider);
}

using System.Windows;
using DotCore.UITheme;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Fluent 2 Mica backdrop for Win11 (solid background fallback elsewhere). Delegates to DotCore.UITheme.WindowBackdrop.
/// Windows using ShellWindowStyle / DialogWindowStyle get it automatically; call again after replacing WindowChrome.
/// </summary>
public static class MicaBackdropHelper
{
    /// <summary>Tries to enable Mica on the window. Returns true if the backdrop is active.</summary>
    public static bool TryApplyMica(Window window) =>
        WindowBackdrop.TryApplyMica(window, ThemeManager.CurrentVariant == ThemeVariant.Dark);
}

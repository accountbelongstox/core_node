using System.Windows;
using System.Windows.Input;

namespace DotCore.UITheme;

/// <summary>
/// Attached behavior used by ShellWindowStyle / DialogWindowStyle: wires SystemCommands (close, minimize,
/// maximize, restore) for template caption buttons, applies the Mica backdrop and follows theme changes.
/// </summary>
public static class WindowChromeBehavior
{
    public static readonly DependencyProperty IsEnabledProperty = DependencyProperty.RegisterAttached(
        "IsEnabled", typeof(bool), typeof(WindowChromeBehavior), new PropertyMetadata(false, OnIsEnabledChanged));

    public static bool GetIsEnabled(DependencyObject d) => (bool)d.GetValue(IsEnabledProperty);
    public static void SetIsEnabled(DependencyObject d, bool value) => d.SetValue(IsEnabledProperty, value);

    private static void OnIsEnabledChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not Window window || e.NewValue is not true) return;
        window.CommandBindings.Add(new CommandBinding(SystemCommands.CloseWindowCommand, (_, _) => SystemCommands.CloseWindow(window)));
        window.CommandBindings.Add(new CommandBinding(SystemCommands.MinimizeWindowCommand, (_, _) => SystemCommands.MinimizeWindow(window),
            (_, a) => a.CanExecute = window.ResizeMode != ResizeMode.NoResize));
        window.CommandBindings.Add(new CommandBinding(SystemCommands.MaximizeWindowCommand, (_, _) => SystemCommands.MaximizeWindow(window),
            (_, a) => a.CanExecute = window.ResizeMode is ResizeMode.CanResize or ResizeMode.CanResizeWithGrip));
        window.CommandBindings.Add(new CommandBinding(SystemCommands.RestoreWindowCommand, (_, _) => SystemCommands.RestoreWindow(window)));

        EventHandler<ThemeVariant> onTheme = (_, mode) => WindowBackdrop.SetDarkMode(window, mode == ThemeVariant.Dark);
        window.SourceInitialized += (_, _) => WindowBackdrop.TryApplyMica(window, ThemeManager.CurrentVariant == ThemeVariant.Dark);
        ThemeManager.ThemeChanged += onTheme;
        window.Closed += (_, _) => ThemeManager.ThemeChanged -= onTheme;
    }
}

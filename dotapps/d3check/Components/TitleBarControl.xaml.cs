using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace DotApps.d3check.Components;

public partial class TitleBarControl : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(TitleBarControl), new PropertyMetadata(""));

    public string Title
    {
        get => (string)GetValue(TitleProperty);
        set => SetValue(TitleProperty, value);
    }

    /// <summary>Expose for i18n: fill items and bind selection to config.</summary>
    public ComboBox LanguageComboBox => CboLanguage;

    public event EventHandler? RestoreSizeRequested;
    public event EventHandler? RestartRequested;

    public TitleBarControl()
    {
        InitializeComponent();
    }

    private void TitleBarBorder_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;
        if (e.ClickCount == 2)
        {
            var w = Window.GetWindow(this);
            if (w != null)
                w.WindowState = w.WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        }
        else
        {
            Window.GetWindow(this)?.DragMove();
        }
    }

    private void BtnMinimize_Click(object sender, RoutedEventArgs e) =>
        Window.GetWindow(this)!.WindowState = WindowState.Minimized;

    private void BtnMaximize_Click(object sender, RoutedEventArgs e)
    {
        var w = Window.GetWindow(this);
        if (w != null)
            w.WindowState = w.WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }

    private void BtnClose_Click(object sender, RoutedEventArgs e) => Window.GetWindow(this)?.Close();

    private void BtnRestoreSize_Click(object sender, RoutedEventArgs e) => RestoreSizeRequested?.Invoke(this, EventArgs.Empty);

    private void BtnRestart_Click(object sender, RoutedEventArgs e) => RestartRequested?.Invoke(this, EventArgs.Empty);
}

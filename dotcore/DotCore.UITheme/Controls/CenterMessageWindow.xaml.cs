using System.Windows;
using System.Windows.Threading;

namespace DotCore.UITheme.Controls;

/// <summary>
/// Reusable centered message window: shows a message in the center of the owner window.
/// Use Show() for non-modal toast; supports auto-close and OK button.
/// Theme brushes (PanelBackgroundBrush, TextPrimaryBrush) must be in application resources.
/// </summary>
public partial class CenterMessageWindow : Window
{
    private DispatcherTimer? _autoCloseTimer;

    public CenterMessageWindow()
    {
        InitializeComponent();
    }

    /// <summary>
    /// Show a centered message on the given owner. Non-modal. Optionally auto-close after specified seconds.
    /// </summary>
    /// <param name="owner">Owner window (centered on this); if null, uses Application.MainWindow.</param>
    /// <param name="message">Body text.</param>
    /// <param name="title">Window title; if null, empty.</param>
    /// <param name="autoCloseSeconds">If &gt; 0, close automatically after this many seconds.</param>
    public static void Show(Window? owner, string message, string? title = null, int autoCloseSeconds = 0)
    {
        var w = new CenterMessageWindow();
        w.Owner = owner ?? Application.Current?.MainWindow;
        w.TxtTitle.Text = title ?? "";
        w.TxtMessage.Text = message ?? "";
        if (string.IsNullOrEmpty(w.TxtTitle.Text))
            w.TxtTitle.Visibility = Visibility.Collapsed;
        w.Show();
        if (autoCloseSeconds > 0)
        {
            w._autoCloseTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(autoCloseSeconds) };
            w._autoCloseTimer.Tick += (_, _) =>
            {
                w._autoCloseTimer?.Stop();
                w._autoCloseTimer = null;
                w.Close();
            };
            w._autoCloseTimer.Start();
        }
    }

    private void BtnOk_Click(object sender, RoutedEventArgs e)
    {
        _autoCloseTimer?.Stop();
        _autoCloseTimer = null;
        Close();
    }
}

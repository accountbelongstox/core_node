// PY-REF: pyapps/d3-check/ui/components/title_bar.py
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Common;
using DotCore.UITheme;

namespace DotApps.d3d4tester.Components;

public partial class TitleBarControl : UserControl
{
    private const string GlyphMaximize = "";
    private const string GlyphRestore = "";
    private const string GlyphLightTheme = "";
    private const string GlyphDarkTheme = "";

    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(nameof(Title), typeof(string), typeof(TitleBarControl), new PropertyMetadata(""));

    private Window? _window;

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
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _window = Window.GetWindow(this);
        if (_window != null)
            _window.StateChanged += OnWindowStateChanged;
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        ThemeService.Instance.ThemeChanged += OnThemeChanged;
        RefreshVisualState();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        if (_window != null)
            _window.StateChanged -= OnWindowStateChanged;
        D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
        ThemeService.Instance.ThemeChanged -= OnThemeChanged;
    }

    private void OnWindowStateChanged(object? sender, EventArgs e) => RefreshVisualState();

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.Invoke(RefreshVisualState);

    private void OnThemeChanged(object? sender, ThemeVariant e) => RefreshVisualState();

    private void RefreshVisualState()
    {
        var p = D3D4TesterI18n.Provider;
        var maximized = _window?.WindowState == WindowState.Maximized;
        var dark = ThemeService.Instance.Current == ThemeVariant.Dark;
        BtnMaximize.Content = maximized ? GlyphRestore : GlyphMaximize;
        BtnMaximize.ToolTip = p.GetUiText(maximized ? I18nKeys.TitleBarRestore : I18nKeys.TitleBarMaximize);
        BtnTheme.Content = dark ? GlyphLightTheme : GlyphDarkTheme;
        BtnTheme.ToolTip = p.GetUiText(dark ? I18nKeys.TitleBarThemeToLight : I18nKeys.TitleBarThemeToDark);
        BtnRestoreSize.ToolTip = p.GetUiText(I18nKeys.TitleBarRestoreSize);
        BtnRestart.ToolTip = p.GetUiText(I18nKeys.TitleBarRestart);
        BtnMinimize.ToolTip = p.GetUiText(I18nKeys.TitleBarMinimize);
        BtnClose.ToolTip = p.GetUiText(I18nKeys.TitleBarClose);
        CboLanguage.ToolTip = p.GetUiText(I18nKeys.TitleBarLanguage);
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

    private void BtnTheme_Click(object sender, RoutedEventArgs e) => ThemeService.Instance.Toggle();
}

// PY-REF: pyapps/d3-check/ui/components/system_tray.py
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.Common;
using DotCore.Foundations;
using DotCore.UITheme.Tray;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// System tray for the main window: show, maximize, restart, Debug &gt; Tab 0..4, exit; tooltip = window title; notifications.
/// Menu actions only trigger EventCenter events (handlers run on the UI thread). Menu text follows the language.
/// 1:1 Python ui/components/system_tray.py.
/// </summary>
public sealed class TrayIconService : IDisposable
{
    private const string GlyphShow = "";
    private const string GlyphMaximize = "";
    private const string GlyphRestart = "";
    private const string GlyphDebug = "";
    private const string GlyphExit = "";
    private const string IconTextStyleKey = "IconTextStyle";

    private readonly Action<int> _switchToTab;
    private NotifyTrayIcon? _icon;
    private MenuItem? _showItem;
    private MenuItem? _maximizeItem;
    private MenuItem? _restartItem;
    private MenuItem? _debugItem;
    private MenuItem? _exitItem;
    private readonly List<MenuItem> _tabItems = new();

    /// <param name="switchToTab">Main window switch_to_tab (runs on the UI thread).</param>
    public TrayIconService(Action<int> switchToTab)
    {
        _switchToTab = switchToTab;
    }

    public bool IsRunning => _icon?.IsVisible == true;

    /// <summary>Create the icon and menu (UI thread). Idempotent. 1:1 Python SystemTray.start.</summary>
    public bool Start(ImageSource image, string tooltip)
    {
        if (_icon != null) return _icon.IsVisible;
        _icon = new NotifyTrayIcon { ContextMenu = BuildMenu() };
        _icon.Activated += (_, _) => EventCenter.TriggerWindowShow();
        RefreshText();
        if (!_icon.Show(image, tooltip))
        {
            ColorPrinter.Yellow("[TRAY] System tray failed to start (shell rejected the icon)");
            return false;
        }
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        ColorPrinter.Green("[TRAY] System tray started");
        return true;
    }

    /// <summary>Remove the icon. 1:1 Python SystemTray.stop.</summary>
    public void Stop()
    {
        if (_icon == null) return;
        D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
        _icon.Dispose();
        _icon = null;
        ColorPrinter.Blue("[TRAY] System tray stopped");
    }

    public void Dispose() => Stop();

    /// <summary>1:1 Python update_tooltip.</summary>
    public void UpdateTooltip(string text) => _icon?.SetTooltip(text);

    /// <summary>1:1 Python show_notification(title, message).</summary>
    public void ShowNotification(string title, string message) => _icon?.ShowNotification(title, message);

    private ContextMenu BuildMenu()
    {
        _showItem = CreateItem(GlyphShow, (_, _) => { EventCenter.TriggerWindowShow(); ColorPrinter.Blue("[TRAY] Show window requested"); });
        _maximizeItem = CreateItem(GlyphMaximize, (_, _) => { EventCenter.TriggerWindowMaximize(); ColorPrinter.Blue("[TRAY] Maximize requested"); });
        _restartItem = CreateItem(GlyphRestart, (_, _) => { EventCenter.TriggerAppRestart(); ColorPrinter.Blue("[TRAY] Restart requested"); });
        _debugItem = CreateItem(GlyphDebug, null);
        for (int i = 0; i < AppConstants.TabCount; i++)
        {
            int index = i;
            var tabItem = new MenuItem();
            tabItem.Click += (_, _) =>
            {
                _switchToTab(index);
                ColorPrinter.Gray($"[TRAY] Debug: switch to tab {index}");
            };
            _tabItems.Add(tabItem);
            _debugItem.Items.Add(tabItem);
        }
        _exitItem = CreateItem(GlyphExit, (_, _) => { EventCenter.TriggerAppExit(); ColorPrinter.Blue("[TRAY] Exit requested"); });

        var menu = new ContextMenu();
        menu.Items.Add(_showItem);
        menu.Items.Add(_maximizeItem);
        menu.Items.Add(_restartItem);
        menu.Items.Add(new Separator());
        menu.Items.Add(_debugItem);
        menu.Items.Add(new Separator());
        menu.Items.Add(_exitItem);
        return menu;
    }

    private static MenuItem CreateItem(string glyph, RoutedEventHandler? onClick)
    {
        var icon = new TextBlock { Text = glyph };
        if (Application.Current?.TryFindResource(IconTextStyleKey) is Style style)
            icon.Style = style;
        var item = new MenuItem { Icon = icon };
        if (onClick != null) item.Click += onClick;
        return item;
    }

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e)
    {
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher == null) return;
        dispatcher.BeginInvoke(() =>
        {
            RefreshText();
            UpdateTooltip(D3D4TesterI18n.Provider.GetUiText(I18nKeys.MainWindowTitle));
        });
    }

    private void RefreshText()
    {
        var p = D3D4TesterI18n.Provider;
        if (_showItem != null) _showItem.Header = p.GetUiText(I18nKeys.SystemTrayShowSoftware);
        if (_maximizeItem != null) _maximizeItem.Header = p.GetUiText(I18nKeys.SystemTrayMaximize);
        if (_restartItem != null) _restartItem.Header = p.GetUiText(I18nKeys.SystemTrayRestart);
        if (_debugItem != null) _debugItem.Header = p.GetUiText(I18nKeys.SystemTrayDebug);
        if (_exitItem != null) _exitItem.Header = p.GetUiText(I18nKeys.SystemTrayExit);
        var tabFormat = p.GetUiText(I18nKeys.SystemTrayDebugTab);
        for (int i = 0; i < _tabItems.Count; i++)
            _tabItems[i].Header = tabFormat.Replace("{index}", i.ToString());
    }
}

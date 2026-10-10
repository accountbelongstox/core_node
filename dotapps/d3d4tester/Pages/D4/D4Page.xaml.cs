// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/panels/d4_panel.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/diablo3_macro_ui.py
using System.Collections.Generic;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.D4.Agent;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels;
using DotApps.d3d4tester.Windows;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Pages.D4;

/// <summary>
/// D4 Functions page (tab[2]). 1:1 Python dotapps/d3d4tester/reference/py_d3check/ui/panels/d4_panel.py: EXP Farming start/stop, live status grid
/// (bound to <see cref="D4ViewModel"/>), Debug Images window toggle, D4 log fed by ColorPrint while the tab is selected.
/// DOT-only second sub-tab: the vision AI test (<see cref="D4AgentView"/>), whose [D4Agent] lines stay out of the EXP farming log.
/// </summary>
public partial class D4Page : UserControl
{
    private const string D4Marker = "D4";
    private const int MaxBufferedLines = 500;
    private const int DrainIntervalMs = 100;
    private const string GlyphStart = "";
    private const string GlyphStop = "";

    private readonly D4ViewModel _viewModel = new();
    private readonly List<string> _logBuffer = new();
    private readonly object _logLock = new();
    private readonly DispatcherTimer _drainTimer;
    private bool _readyLogged;

    public D4Page()
    {
        InitializeComponent();
        DataContext = _viewModel;
        _drainTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(DrainIntervalMs) };
        _drainTimer.Tick += (_, _) => DrainLogQueue();
        _viewModel.LogRequested += AddLog;
        _viewModel.PropertyChanged += OnViewModelPropertyChanged;
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _viewModel.Attach();
        D4DebugWindow.OpenStateChanged += OnDebugWindowOpenStateChanged;
        OnDebugWindowOpenStateChanged(D4DebugWindow.Current != null);
        RefreshI18n();
        UpdateStartStopIcon();
        if (!_readyLogged)
        {
            _readyLogged = true;
            AddLog(D3D4TesterI18n.Provider.GetUiText(I18nKeys.D4ExpFarmingStatusReady));
        }
        _drainTimer.Start();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _drainTimer.Stop();
        _viewModel.Detach();
        D4DebugWindow.OpenStateChanged -= OnDebugWindowOpenStateChanged;
        UnregisterAsLogTarget();
    }

    /// <summary>Receive ColorPrint output while the D4 tab is selected (MainWindow routes logs per tab). 1:1 Python _reregister_log_callback.</summary>
    public void RegisterAsLogTarget()
    {
        ColorPrinter.UnregisterCallback(OnColorPrintMessage);
        ColorPrinter.RegisterCallback(OnColorPrintMessage);
    }

    public void UnregisterAsLogTarget() => ColorPrinter.UnregisterCallback(OnColorPrintMessage);

    /// <summary>Called from MainWindow when language changes.</summary>
    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblD4Title.Text = p.GetUiText(I18nKeys.D4PanelTitle);
        LblNavExpFarming.Text = p.GetUiText(I18nKeys.D4PanelSubTabsExpFarming);
        LblNavAgent.Text = p.GetUiText(I18nKeys.D4AgentNav);
        if (AgentView.IsLoaded) AgentView.RefreshI18n();
        LblExpFarmingTitle.Text = p.GetUiText(I18nKeys.D4ExpFarmingTitle);
        LblExpFarmingSubtitle.Text = p.GetUiText(I18nKeys.D4PageSubtitle);
        TxtDebugButton.Text = p.GetUiText(I18nKeys.D4PageDebugButton);
        TxtStartD4.Text = p.GetUiText(I18nKeys.D4PageStartD4Button);
        TxtFixD4License.Text = p.GetUiText(I18nKeys.D4PageFixLicenseButton);
        BtnFixD4License.ToolTip = p.GetUiText(I18nKeys.D4PageFixLicenseTooltip);
        LblGameStatusTitle.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusTitle);
        LblLogTitle.Text = p.GetUiText(I18nKeys.D4ExpFarmingLogTitle);
        TxtClearLog.Text = p.GetUiText(I18nKeys.D4PageClearLog);
        _viewModel.RefreshI18n();
        D4DebugWindow.Current?.RefreshI18n();
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(D4ViewModel.IsExpFarmingRunning)) UpdateStartStopIcon();
    }

    /// <summary>Accent while the debug window is open (Python debug_btn accent / primary).</summary>
    private void OnDebugWindowOpenStateChanged(bool open) =>
        BtnExpFarmingDebug.Style = (Style)FindResource(open ? "PrimaryButtonStyle" : "SecondaryButtonStyle");

    private void UpdateStartStopIcon() => IconStartStop.Text = _viewModel.IsExpFarmingRunning ? GlyphStop : GlyphStart;

    /// <summary>Open or close the D4 debug image window. 1:1 Python _toggle_debug_window.</summary>
    private void BtnExpFarmingDebug_Click(object sender, RoutedEventArgs e)
    {
        if (D4DebugWindow.Current is { } open)
        {
            open.Close();
            ColorPrinter.Yellow("[D4Panel] Debug window closed");
            return;
        }
        D4DebugWindow.Open(Window.GetWindow(this));
        ColorPrinter.Green("[D4Panel] Debug window opened");
        ColorPrinter.Blue("[D4Panel] Debug window will be updated automatically by timer");
    }

    /// <summary>Ensure D4 runs from Battle.net (D4 tab + Play, window poll), off the UI thread; disabled while running (re-entry guard).</summary>
    private async void BtnStartD4_Click(object sender, RoutedEventArgs e)
    {
        BtnStartD4.IsEnabled = false;
        try
        {
            await Task.Run(LoginTryController.EnsureD4RunningFromBattlenet);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[D4Panel] Start D4 failed: {ex.Message}");
        }
        finally
        {
            BtnStartD4.IsEnabled = true;
        }
    }

    /// <summary>Fix "unable to find a valid license" then launch D4, off the UI thread; disabled while running (re-entry guard).</summary>
    private async void BtnFixD4License_Click(object sender, RoutedEventArgs e)
    {
        BtnFixD4License.IsEnabled = false;
        BtnStartD4.IsEnabled = false;
        try
        {
            await Task.Run(D4LicenseFixController.Run);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[D4Panel] Fix D4 license failed: {ex.Message}");
        }
        finally
        {
            BtnFixD4License.IsEnabled = true;
            BtnStartD4.IsEnabled = true;
        }
    }

    private void BtnClearLog_Click(object sender, RoutedEventArgs e) => TxtExpFarmingLog.Clear();

    private void NavExpFarming_Click(object sender, MouseButtonEventArgs e) => ShowSubTab(agent: false);

    private void NavAgent_Click(object sender, MouseButtonEventArgs e) => ShowSubTab(agent: true);

    /// <summary>Switch the right side between EXP farming and the vision AI test.</summary>
    private void ShowSubTab(bool agent)
    {
        ExpFarmingContent.Visibility = agent ? Visibility.Collapsed : Visibility.Visible;
        AgentView.Visibility = agent ? Visibility.Visible : Visibility.Collapsed;
        NavExpFarming.Style = (Style)FindResource(agent ? "D4NavItemStyle" : "D4NavItemSelectedStyle");
        NavAgent.Style = (Style)FindResource(agent ? "D4NavItemSelectedStyle" : "D4NavItemStyle");
        BarExpFarming.Visibility = agent ? Visibility.Hidden : Visibility.Visible;
        BarAgent.Visibility = agent ? Visibility.Visible : Visibility.Hidden;
    }

    private void AddLog(string message)
    {
        lock (_logLock)
            _logBuffer.Add(message);
    }

    /// <summary>Only D4 lines; no UI access here (any thread). 1:1 Python add_log_message.</summary>
    private void OnColorPrintMessage(string message, string colorType, string? logLevel)
    {
        if (!message.Contains(D4Marker, StringComparison.Ordinal) || message.Contains(D4AgentConstants.LogTag, StringComparison.Ordinal)) return;
        lock (_logLock)
        {
            _logBuffer.Add(message);
            if (_logBuffer.Count > MaxBufferedLines)
                _logBuffer.RemoveRange(0, _logBuffer.Count - MaxBufferedLines);
        }
    }

    private void DrainLogQueue()
    {
        List<string> copy;
        lock (_logLock)
        {
            if (_logBuffer.Count == 0) return;
            copy = new List<string>(_logBuffer);
            _logBuffer.Clear();
        }
        foreach (var line in copy)
            TxtExpFarmingLog.AppendText(line + "\n");
        TxtExpFarmingLog.ScrollToEnd();
    }
}

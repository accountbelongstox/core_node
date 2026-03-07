using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3check.Constants;
using DotApps.d3check.I18n;
using DotApps.d3check.ViewModels;
using DotCore.Foundations;

namespace DotApps.d3check.Pages.D4;

/// <summary>
/// D4 Functions page. Logic 1:1 with Python ui/panels/d4_panel.py (tab[2]).
/// EXP Farming: start/stop toggle, game status grid, debug button, log. No backend yet; state is local.
/// </summary>
public partial class D4Page : UserControl
{
    private bool _expFarmingRunning;
    private readonly List<string> _logBuffer = new();
    private readonly object _logLock = new();

    public D4Page()
    {
        InitializeComponent();
        DataContext = new D4ViewModel();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        ColorPrinter.UnregisterCallback(OnColorPrintMessage);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        RefreshI18n();
        AddLog(D3CheckI18n.Provider.GetUiText(I18nKeys.D4ExpFarmingStatusReady));
        UpdateGameStatusDisplay();
        ColorPrinter.RegisterCallback(OnColorPrintMessage);
        var timer = new System.Windows.Threading.DispatcherTimer
        {
            Interval = System.TimeSpan.FromMilliseconds(200)
        };
        timer.Tick += (_, _) => DrainLogQueue();
        timer.Start();
    }

    /// <summary>Called from MainWindow when language changes.</summary>
    public void RefreshI18n()
    {
        var p = D3CheckI18n.Provider;
        if (LblD4Title == null) return;
        LblD4Title.Text = p.GetUiText(I18nKeys.D4PanelTitle);
        BtnExpFarmingNav.Content = p.GetUiText(I18nKeys.D4PanelSubTabsExpFarming);
        LblExpFarmingTitle.Text = p.GetUiText(I18nKeys.D4ExpFarmingTitle);
        BtnExpFarmingStartStop.Content = _expFarmingRunning
            ? p.GetUiText(I18nKeys.D4ExpFarmingStopButton)
            : p.GetUiText(I18nKeys.D4ExpFarmingStartButton);
        LblGameStatusTitle.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusTitle);
        LblGameState.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusGameState);
        LblTeamCount.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusTeamCount);
        LblDungeonProgress.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusDungeonProgress);
        LblD4RunningStatus.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusD4RunningStatus);
        LblScreenCoordinates.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusScreenCoordinates);
        LblScreenSize.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusScreenSize);
        LblMapSwitchCount.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusMapSwitchCount);
        LblMapSwitchState.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusMapSwitchState);
        LblReserved4.Text = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusReserved);
        LblLogTitle.Text = p.GetUiText(I18nKeys.D4ExpFarmingLogTitle);
    }

    private void BtnExpFarmingStartStop_Click(object sender, RoutedEventArgs e)
    {
        var p = D3CheckI18n.Provider;
        if (!_expFarmingRunning)
        {
            AddLog("Checking team status...");
            AddLog("(Dot: no D4 backend; starting UI-only)");
            _expFarmingRunning = true;
            BtnExpFarmingStartStop.Content = p.GetUiText(I18nKeys.D4ExpFarmingStopButton);
            BtnExpFarmingStartStop.Background = (System.Windows.Media.Brush)FindResource("ButtonDangerBrush");
            AddLog($"[{p.GetUiText(I18nKeys.D4ExpFarmingStatusRunning)}] EXP Farming started");
            ColorPrinter.Green("[D4] EXP Farming started (UI-only)");
        }
        else
        {
            _expFarmingRunning = false;
            BtnExpFarmingStartStop.Content = p.GetUiText(I18nKeys.D4ExpFarmingStartButton);
            BtnExpFarmingStartStop.Background = (System.Windows.Media.Brush)FindResource("ButtonSuccessBrush");
            AddLog($"[{p.GetUiText(I18nKeys.D4ExpFarmingStatusStopped)}] EXP Farming stopped");
            ColorPrinter.Yellow("[D4] EXP Farming stopped");
        }
        RefreshI18n();
        UpdateGameStatusDisplay();
    }

    private void BtnExpFarmingDebug_Click(object sender, RoutedEventArgs e)
    {
        var logSnapshot = GetLogSnapshot();
        var win = new Window
        {
            Title = D3CheckI18n.Provider.GetUiText(I18nKeys.D4ExpFarmingLogTitle) + " – Debug",
            Width = 560,
            Height = 400,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = Window.GetWindow(this)
        };
        var box = new System.Windows.Controls.TextBox
        {
            Text = logSnapshot,
            IsReadOnly = true,
            TextWrapping = TextWrapping.Wrap,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Margin = new Thickness(8),
            FontFamily = new System.Windows.Media.FontFamily("Consolas"),
            FontSize = 12
        };
        win.Content = box;
        win.Show();
        ColorPrinter.Blue("[D4] Debug window opened");
    }

    /// <summary>Snapshot of current log for debug window: page log text + in-memory buffer.</summary>
    private string GetLogSnapshot()
    {
        string panelText = "";
        if (TxtExpFarmingLog != null)
            panelText = TxtExpFarmingLog.Text ?? "";
        List<string> buf;
        lock (_logLock)
            buf = new List<string>(_logBuffer);
        if (buf.Count == 0)
            return panelText;
        return panelText + (string.IsNullOrEmpty(panelText) ? "" : "\n") + string.Join("\n", buf);
    }

    private void AddLog(string message)
    {
        lock (_logLock)
            _logBuffer.Add(message);
    }

    private void OnColorPrintMessage(string message, string colorType, string? logLevel)
    {
        if (message.Contains("[D4]", System.StringComparison.Ordinal) || message.Contains("D4", System.StringComparison.Ordinal))
        {
            lock (_logLock)
            {
                _logBuffer.Add(message);
                if (_logBuffer.Count > 500)
                    _logBuffer.RemoveRange(0, _logBuffer.Count - 500);
            }
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
        if (TxtExpFarmingLog == null) return;
        foreach (var line in copy)
            TxtExpFarmingLog.AppendText(line + "\n");
        TxtExpFarmingLog.ScrollToEnd();
    }

    private void UpdateGameStatusDisplay()
    {
        var p = D3CheckI18n.Provider;
        var unknown = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusUnknown);
        var running = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusRunning);
        var stopped = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusStopped);

        TxtCurrentMap.Text = unknown;
        TxtGameState.Text = _expFarmingRunning ? p.GetUiText(I18nKeys.D4ExpFarmingStatusRunning) : p.GetUiText(I18nKeys.D4ExpFarmingStatusStopped);
        TxtTeamCount.Text = "0 (0/0)";
        TxtDungeonProgress.Text = unknown;
        TxtD4RunningStatus.Text = _expFarmingRunning ? running : stopped;
        TxtScreenCoordinates.Text = unknown;
        TxtScreenSize.Text = unknown;
        TxtMapSwitchCount.Text = "0";
        TxtMapSwitchState.Text = "Normal";
        TxtReserved4.Text = TxtReserved5.Text = TxtReserved6.Text = TxtReserved7.Text = TxtReserved8.Text = TxtReserved9.Text = "-";
    }
}

// PY-REF: pyapps/d3-check/ui/panels/log_panel.py
using System.IO;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.ViewModels;
using DotCore.Foundations;
using Microsoft.Win32;

namespace DotApps.d3d4tester.Pages.RunLog;

/// <summary>
/// Run log tab. Logic 1:1 with Python ui/panels/log_panel.py: test buttons, clear/save, show-debug/auto-scroll/level filter, scan, log output.
/// </summary>
public partial class RunLogPage : UserControl
{
    private const string LevelAll = "ALL";
    private static readonly string[] LevelValues = { LevelAll, AppConstants.LogLevelDebug, AppConstants.LogLevelInfo, AppConstants.LogLevelWarning, AppConstants.LogLevelError, AppConstants.LogLevelCritical };
    private static readonly Dictionary<string, int> LevelRank = new(StringComparer.OrdinalIgnoreCase)
    {
        [AppConstants.LogLevelDebug] = 0,
        [AppConstants.LogLevelInfo] = 1,
        [AppConstants.LogLevelWarning] = 2,
        [AppConstants.LogLevelError] = 3,
        [AppConstants.LogLevelCritical] = 4,
    };
    private static readonly Regex UiLogPrefix = new(@"^\[(?:ROSBOT|ROSBOT~[^\]]*|LogAnalyzer)\]\s*", RegexOptions.Compiled);
    private static readonly string[] TestButtonKeys =
    {
        I18nKeys.LogPanelBagTest, I18nKeys.LogPanelYellowUpgrade, I18nKeys.LogPanelItemReforge, I18nKeys.LogPanelTestPathfinding,
        I18nKeys.AuxDebugBloodShard, I18nKeys.AuxDebugQuickPickup, I18nKeys.AuxDebugBlacksmith, I18nKeys.AuxDebugKanaiReforge,
        I18nKeys.AuxDebugKanaiUpgrade, I18nKeys.AuxDebugKanaiConvert, I18nKeys.AuxDebugAutoSalvage, I18nKeys.AuxDebugDropEquipment,
        I18nKeys.AuxDebugSoundFeedback, I18nKeys.AuxDebugSmartPause, I18nKeys.RosbotDebugBattlenetUi, I18nKeys.RosbotDebugRosbot,
        I18nKeys.RosbotDebugGameStatus,
    };
    private static readonly Dictionary<string, (string Start, string Complete)> SelfTestTexts = new(StringComparer.Ordinal)
    {
        [I18nKeys.LogPanelBagTest] = (I18nKeys.LogPanelBagTestStart, I18nKeys.LogPanelBagTestComplete),
        [I18nKeys.LogPanelYellowUpgrade] = (I18nKeys.LogPanelYellowUpgradeStart, I18nKeys.LogPanelYellowUpgradeComplete),
        [I18nKeys.LogPanelItemReforge] = (I18nKeys.LogPanelItemReforgeStart, I18nKeys.LogPanelItemReforgeComplete),
        [I18nKeys.LogPanelTestPathfinding] = (I18nKeys.LogPanelTestPathfindingStart, I18nKeys.LogPanelTestPathfindingComplete),
    };

    public RunLogPage()
    {
        InitializeComponent();
        DataContext = new RunLogViewModel();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (CmbLogLevel.Items.Count == 0)
        {
            foreach (var level in LevelValues) CmbLogLevel.Items.Add(level);
            ConfigBinding.BindCheckBox(ChkShowDebugLogs, ConfigKeys.LogSettingsShowDebugLogs, true);
            ConfigBinding.BindCheckBox(ChkAutoScroll, ConfigKeys.LogSettingsAutoScroll, true);
            ConfigBinding.BindComboBox(CmbLogLevel, ConfigKeys.LogSettingsLogLevel, LevelValues, AppConstants.LogLevelDefault);
            RosbotDebugService.RegisterTestAction();
            BattlenetUiAnalyzeService.RegisterTestAction();
            GameStatusDebugService.RegisterTestAction();
            Ctl.GameAssistantController.RegisterTestActions();
        }
        BuildTestButtons();
        RefreshI18n();
    }

    /// <summary>Remove a leading [ROSBOT], [ROSBOT~*] or [LogAnalyzer] tag for UI display. 1:1 Python log_panel._strip_ui_log_prefix.</summary>
    public static string StripUiLogPrefix(string message) => UiLogPrefix.Replace(message, "");

    private void OnUnloaded(object sender, RoutedEventArgs e) => UnregisterAsLogTarget();

    /// <summary>Called from MainWindow when language changes.</summary>
    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblTestFunctions.Text = p.GetUiText(I18nKeys.LogPanelTestFunctions);
        TxtClearLogs.Text = p.GetUiText(I18nKeys.LogPanelClearLogs);
        TxtSaveLogs.Text = p.GetUiText(I18nKeys.LogPanelSaveLog);
        ChkShowDebugLogs.Content = p.GetUiText(I18nKeys.LogPanelShowDebugLogs);
        ChkAutoScroll.Content = p.GetUiText(I18nKeys.LogPanelAutoScroll);
        BtnScanLogArea.Content = p.GetUiText(I18nKeys.LogPanelScanLogArea);
        LblLogOutput.Text = p.GetUiText(I18nKeys.LogPanelLogOutput);
        ResourceMonitor.RefreshI18n();
        foreach (var child in TestButtonsGrid.Children)
            if (child is Button { Tag: string key } btn) btn.Content = p.GetUiText(key);
    }

    /// <summary>Register this page as ColorPrint target (Log tab selected). Called from MainWindow.</summary>
    public void RegisterAsLogTarget()
    {
        ColorPrinter.UnregisterCallback(OnLogMessage);
        ColorPrinter.RegisterCallback(OnLogMessage);
    }

    public void UnregisterAsLogTarget() => ColorPrinter.UnregisterCallback(OnLogMessage);

    private void BuildTestButtons()
    {
        if (TestButtonsGrid.Children.Count > 0) return;
        foreach (var key in TestButtonKeys)
        {
            var btn = new Button { Tag = key, Margin = new Thickness(0, 0, 8, 8), HorizontalAlignment = HorizontalAlignment.Stretch };
            btn.Click += (_, _) => RunTestAction(key);
            TestButtonsGrid.Children.Add(btn);
        }
    }

    private static void RunTestAction(string key)
    {
        if (TestActionRegistry.TryInvoke(key)) return;
        var p = D3D4TesterI18n.Provider;
        if (SelfTestTexts.TryGetValue(key, out var texts))
        {
            var title = p.GetUiText(key);
            ColorPrinter.Blue($"[{title}] {p.GetUiText(texts.Start)}");
            ColorPrinter.Green($"[{title}] {p.GetUiText(texts.Complete)}");
            return;
        }
        var name = key[(key.LastIndexOf('.') + 1)..].Replace("debug_", "");
        ColorPrinter.Blue($"[AuxPanel] Debug: {name} (placeholder)");
    }

    private void OnLogMessage(string message, string colorType, string? logLevel)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(() => OnLogMessage(message, colorType, logLevel));
            return;
        }
        var level = string.IsNullOrEmpty(logLevel) ? AppConstants.LogLevelInfo : logLevel.ToUpperInvariant();
        var opts = ConfigOptionsProvider.GetOptions<LogSettingsOptions>();
        if (level == AppConstants.LogLevelDebug && !opts.ShowDebugLogs) return;
        var filter = CmbLogLevel.SelectedItem as string ?? LevelAll;
        if (filter != LevelAll)
        {
            var msgRank = LevelRank.TryGetValue(level, out var r) ? r : LevelRank[AppConstants.LogLevelInfo];
            var filterRank = LevelRank.TryGetValue(filter, out var f) ? f : 0;
            if (msgRank < filterRank) return;
        }
        TxtLog.AppendText($"[{DateTime.Now:HH:mm:ss}] [{level}] {StripUiLogPrefix(message)}\n");
        if (opts.AutoScroll) TxtLog.ScrollToEnd();
    }

    private void BtnClearLogs_Click(object sender, RoutedEventArgs e) => TxtLog.Clear();

    private void BtnSaveLogs_Click(object sender, RoutedEventArgs e)
    {
        var p = D3D4TesterI18n.Provider;
        var dlg = new SaveFileDialog
        {
            Title = p.GetUiText(I18nKeys.LogPanelSaveLogFile),
            DefaultExt = ".txt",
            Filter = $"{p.GetUiText(I18nKeys.LogPanelTextFiles)} (*.txt)|*.txt|{p.GetUiText(I18nKeys.LogPanelAllFiles)} (*.*)|*.*",
        };
        if (dlg.ShowDialog(Window.GetWindow(this)) != true) return;
        try
        {
            File.WriteAllText(dlg.FileName, TxtLog.Text, System.Text.Encoding.UTF8);
            ColorPrinter.Green($"[LogPanel] Logs saved to {dlg.FileName}");
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[LogPanel] Failed to save logs: {ex.Message}");
        }
    }

    private void BtnScanLogArea_Click(object sender, RoutedEventArgs e)
    {
        ColorPrinter.Blue($"[LogPanel] Log area scan: container={IsLoaded}, log_text={TxtLog.IsLoaded}");
    }
}

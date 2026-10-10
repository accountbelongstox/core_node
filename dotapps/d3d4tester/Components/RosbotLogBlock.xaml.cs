// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Pages.RunLog;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.Ui;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// ROSBOT log hosted on the Monitor tab: header (last-log age, latency, debug-latency switch, open logs.txt) and the ColorPrint sink
/// for ROSBOT / PathScan / LogAnalyzer lines while the tab is selected. 1:1 Python rosbot_extension_panel _create_log_display_row.
/// </summary>
public partial class RosbotLogBlock : UserControl
{
    private const string LatencyTagStart = "[ROSBOT~";
    private const string LatencyTagEnd = "s]";
    private const double SecondsPerMinute = 60.0;
    private static readonly string[] LogAcceptMarkers = { "[ROSBOT]", "[PathScan]", "LogAnalyzer" };
    private static readonly TimeSpan LogStatusTickInterval = TimeSpan.FromSeconds(1);

    private readonly DispatcherTimer _logStatusTimer;
    private bool _bound;
    private double? _lastLatencySec;

    public RosbotLogBlock()
    {
        InitializeComponent();
        _logStatusTimer = new DispatcherTimer { Interval = LogStatusTickInterval };
        _logStatusTimer.Tick += (_, _) => UpdateLogStatusDisplay();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        D3D4TesterI18n.EnsureInitialized();
        if (!_bound)
        {
            _bound = true;
            ConfigBinding.BindCheckBox(ChkDebugLogLatency, ConfigKeys.LogSettingsDebugLogLatency);
            ChkDebugLogLatency.Checked += (_, _) => UpdateLogStatusDisplay();
            ChkDebugLogLatency.Unchecked += (_, _) => UpdateLogStatusDisplay();
        }
        RefreshI18n();
        _logStatusTimer.Start();
    }

    /// <summary>Only the status timer stops: the ColorPrint sink stays while a sub-tab hides the log (MainWindow unregisters it on tab change).</summary>
    private void OnUnloaded(object sender, RoutedEventArgs e) => _logStatusTimer.Stop();

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblRosbotLog.Text = p.GetUiText(I18nKeys.RosbotRosbotLog);
        ChkDebugLogLatency.Content = p.GetUiText(I18nKeys.LogPanelDebugLogLatency);
        TxtOpenLogFile.Text = p.GetUiText(I18nKeys.RosbotOpenLogFile);
        MiCopyLog.Header = p.GetUiText(I18nKeys.RosbotCopy);
        UpdateLogStatusDisplay();
    }

    /// <summary>Register as ColorPrint target while the hosting tab is selected. Called from MainWindow.</summary>
    public void RegisterAsLogTarget()
    {
        ColorPrinter.UnregisterCallback(OnLogMessage);
        ColorPrinter.RegisterCallback(OnLogMessage);
    }

    public void UnregisterAsLogTarget() => ColorPrinter.UnregisterCallback(OnLogMessage);

    /// <summary>Accept only ROSBOT/PathScan/LogAnalyzer lines, track last-log time and "[ROSBOT~Ns]" latency, strip prefix, auto-scroll. 1:1 Python add_log_message.</summary>
    private void OnLogMessage(string message, string colorType, string? logLevel)
    {
        if (ShutdownManager.IsShutdownRequested || string.IsNullOrEmpty(message) || !LogAcceptMarkers.Any(m => message.Contains(m, StringComparison.Ordinal))) return;
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Normal, () => OnLogMessage(message, colorType, logLevel));
            return;
        }
        int start = message.IndexOf(LatencyTagStart, StringComparison.Ordinal);
        if (start >= 0)
        {
            start += LatencyTagStart.Length;
            int end = message.IndexOf(LatencyTagEnd, start, StringComparison.Ordinal);
            if (end >= 0)
                _lastLatencySec = double.TryParse(message[start..end], NumberStyles.Float, CultureInfo.InvariantCulture, out var latency) ? latency : null;
        }
        LogTextBoxHelper.Append(TxtRosbotLog, RunLogPage.StripUiLogPrefix(message) + "\n");
    }

    /// <summary>"Last: x ago" from the logs.txt watcher mtime (the source F3 uses); latency only when log_settings.debug_log_latency. 1:1 Python _update_rosbot_log_status_display.</summary>
    private void UpdateLogStatusDisplay()
    {
        DateTime? last = RosbotFlowHost.Current?.GetLastLogModifiedUtc();
        if (last == null)
        {
            ChipLogStatus.Visibility = Visibility.Collapsed;
            ChipLogLatency.Visibility = Visibility.Collapsed;
            return;
        }
        var p = D3D4TesterI18n.Provider;
        double elapsed = Math.Max(0, (DateTime.UtcNow - last.Value).TotalSeconds);
        TxtLogStatus.Text = elapsed < SecondsPerMinute
            ? string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotLogLastAgo), elapsed.ToString("0.0", CultureInfo.InvariantCulture) + "s")
            : string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotLogLastAgoMin), (elapsed / SecondsPerMinute).ToString("0", CultureInfo.InvariantCulture) + "min");
        ChipLogStatus.Visibility = Visibility.Visible;
        bool showLatency = ConfigBinding.GetValue<bool?>(ConfigKeys.LogSettingsDebugLogLatency, false) == true;
        if (showLatency && _lastLatencySec is { } lat)
        {
            TxtLogLatency.Text = string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotLogLatency), lat.ToString("0.0", CultureInfo.InvariantCulture));
            ChipLogLatency.Visibility = Visibility.Visible;
        }
        else
        {
            ChipLogLatency.Visibility = Visibility.Collapsed;
        }
    }

    /// <summary>Open ROSBOT logs.txt in Notepad. 1:1 Python _open_rosbot_log_file.</summary>
    private void BtnOpenLogFile_Click(object sender, RoutedEventArgs e)
    {
        string path = RosbotLogPaths.GetLogsFilePath();
        if (ShellOpen.OpenFileWithNotepad(path)) return;
        var p = D3D4TesterI18n.Provider;
        MessageBox.Show(Window.GetWindow(this), p.GetUiText(I18nKeys.RosbotLogFileNotFound) + "
" + path,
            p.GetUiText(I18nKeys.RosbotWarning), MessageBoxButton.OK, MessageBoxImage.Warning);
    }

    /// <summary>Copy selection, else the whole log. 1:1 Python _copy_rosbot_log_to_clipboard.</summary>
    private void MiCopyLog_Click(object sender, RoutedEventArgs e)
    {
        var text = TxtRosbotLog.SelectionLength > 0 ? TxtRosbotLog.SelectedText : TxtRosbotLog.Text;
        if (!string.IsNullOrWhiteSpace(text)) Clipboard.SetText(text);
    }
}

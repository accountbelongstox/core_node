// PY-REF: none (DOT-only)
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Common;
using DotCore.Utils;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// CoreNodeBridge ROSBOT plugin panel: installed vs bundled plugin, auto-install switch, install / open folder, and the live
/// game state the plugin publishes (current map with a user-given name, location kind, paragon, health, sequence, recent maps),
/// polled once per second while visible.
/// </summary>
public partial class RosbotBridgePanel : UserControl
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(1);
    private const string TimeFormat = "HH:mm:ss";
    private const string Separator = " · ";
    private const string Empty = "-";
    private readonly DispatcherTimer _timer = new() { Interval = PollInterval };
    private readonly List<(string LabelKey, TextBlock Label, TextBlock Value)> _rows = new();
    private RosbotBridgeState? _state;
    private bool _bound;

    private static readonly string[] RowKeys =
    {
        I18nKeys.RosbotBridgeMap, I18nKeys.RosbotBridgeMapSince, I18nKeys.RosbotBridgeLocation, I18nKeys.RosbotBridgeScene,
        I18nKeys.RosbotBridgeWorld, I18nKeys.RosbotBridgeParagon, I18nKeys.RosbotBridgeHealth, I18nKeys.RosbotBridgeResources,
        I18nKeys.RosbotBridgeSequence, I18nKeys.RosbotBridgeLastEvent, I18nKeys.RosbotBridgeUpdated,
    };

    public RosbotBridgePanel()
    {
        InitializeComponent();
        foreach (var key in RowKeys) AddRow(key);
        _timer.Tick += (_, _) => RefreshLive();
        Loaded += (_, _) =>
        {
            if (!_bound)
            {
                _bound = true;
                ConfigBinding.BindCheckBox(ChkAutoInstall, ConfigKeys.RosbotBridgePluginAutoInstall, ConfigKeys.RosbotBridgePluginAutoInstallDefault);
            }
            RefreshI18n();
            _timer.Start();
        };
        Unloaded += (_, _) => _timer.Stop();
    }

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblTitle.Text = p.GetUiText(I18nKeys.RosbotBridgeTitle);
        TxtDesc.Text = p.GetUiText(I18nKeys.RosbotBridgeDesc);
        ChkAutoInstall.Content = p.GetUiText(I18nKeys.RosbotBridgeAutoInstall);
        BtnInstall.Content = p.GetUiText(I18nKeys.RosbotBridgeInstall);
        BtnOpenDir.Content = p.GetUiText(I18nKeys.RosbotBridgeOpenDir);
        BtnSaveAreaName.Content = p.GetUiText(I18nKeys.RosbotBridgeSaveAreaName);
        LblHistory.Text = p.GetUiText(I18nKeys.RosbotBridgeHistory);
        foreach (var (key, label, _) in _rows) label.Text = p.GetUiText(key);
        RefreshInstallInfo();
        RefreshLive();
    }

    private void AddRow(string labelKey)
    {
        int row = GridLive.RowDefinitions.Count;
        GridLive.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var label = new TextBlock { Style = (Style)FindResource("FieldLabelTextStyle"), Margin = new Thickness(0, 0, 8, 2) };
        var value = new TextBlock { TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 2) };
        Grid.SetRow(label, row);
        Grid.SetRow(value, row);
        Grid.SetColumn(value, 1);
        GridLive.Children.Add(label);
        GridLive.Children.Add(value);
        _rows.Add((labelKey, label, value));
    }

    private void RefreshInstallInfo()
    {
        var p = D3D4TesterI18n.Provider;
        var info = RosbotBridgePluginService.GetInfo();
        TxtInstallInfo.Text = string.Join(Environment.NewLine,
            $"{p.GetUiText(I18nKeys.RosbotBridgeRosDir)}: {info.RosDirectory ?? Empty}",
            $"{p.GetUiText(I18nKeys.RosbotBridgeInstalled)}: {info.InstalledVersion ?? p.GetUiText(I18nKeys.RosbotBridgeNotInstalled)}"
            + $"{Separator}{p.GetUiText(I18nKeys.RosbotBridgeBundled)}: {info.BundledVersion ?? Empty}"
            + (info.InstalledPath != null && !info.UpToDate ? Separator + p.GetUiText(I18nKeys.RosbotBridgeOutdated) : ""));
    }

    private void RefreshLive()
    {
        var p = D3D4TesterI18n.Provider;
        var s = RosbotBridgePluginService.ReadState();
        _state = s;
        var now = DateTime.UtcNow;
        TxtLiveStatus.Text = p.GetUiText(LiveStatusKey(s, now));
        string[] values = s == null ? RowKeys.Select(_ => Empty).ToArray() : new[]
        {
            AreaText(s.LevelAreaSno, p),
            FormatDuration(now - s.LevelAreaSinceUtc),
            LocationText(s, p),
            s.SceneSno.ToString(),
            $"{s.WorldId}{Separator}{s.GlobalWorldId}",
            s.Paragon.ToString(),
            s.Dead ? p.GetUiText(I18nKeys.RosbotBridgeDead) : $"{s.HealthPct * 100:0}%" + (s.InCombat ? Separator + p.GetUiText(I18nKeys.RosbotBridgeInCombat) : ""),
            string.Format(p.GetUiText(I18nKeys.RosbotBridgeResourcesFormat), s.BloodShards, s.RiftKeys)
                + (s.InventoryFull ? Separator + p.GetUiText(I18nKeys.RosbotBridgeInventoryFull) : ""),
            string.IsNullOrEmpty(s.Sequence) ? Empty : s.Sequence,
            string.IsNullOrEmpty(s.LastEvent) ? Empty : s.LastEvent,
            s.UpdatedUtc.ToLocalTime().ToString(TimeFormat),
        };
        for (int i = 0; i < _rows.Count; i++) _rows[i].Value.Text = values[i];

        LstHistory.Items.Clear();
        foreach (var visit in s?.LevelAreaHistory ?? Array.Empty<RosbotBridgeAreaVisit>())
            LstHistory.Items.Add($"{visit.Utc.ToLocalTime().ToString(TimeFormat)}{Separator}{AreaText(visit.Sno, p)}");
    }

    /// <summary>Why there is (no) live data: not installed, ROSBOT not running, running without the plugin loaded, stale, live.</summary>
    private static string LiveStatusKey(RosbotBridgeState? s, DateTime nowUtc)
    {
        if (!RosbotBridgePluginService.IsInstalled) return I18nKeys.RosbotBridgeNotInstalledHint;
        bool running = RosbotBridgePluginService.IsRosbotRunning;
        bool fresh = s != null && !s.IsStale(nowUtc);
        if (!fresh) return running ? I18nKeys.RosbotBridgeNotLoaded : I18nKeys.RosbotBridgeRosbotStopped;
        return s!.InGame ? I18nKeys.RosbotBridgeLive : I18nKeys.RosbotBridgeNotInGame;
    }

    private static string AreaText(int sno, II18nProvider p) =>
        sno == 0 ? Empty
        : RosbotBridgePluginService.GetAreaName(sno) is { } name ? $"{name} ({sno})"
        : string.Format(p.GetUiText(I18nKeys.RosbotBridgeUnnamedArea), sno);

    private static string LocationText(RosbotBridgeState s, II18nProvider p) =>
        s.InTown ? p.GetUiText(I18nKeys.RosbotBridgeTown)
        : s.GreaterRift ? string.Format(p.GetUiText(I18nKeys.RosbotBridgeGreaterRift), s.GreaterRiftLevel)
        : s.NephalemRift || s.InRift ? p.GetUiText(I18nKeys.RosbotBridgeRift)
        : p.GetUiText(I18nKeys.RosbotBridgeField);

    private static string FormatDuration(TimeSpan t) =>
        t.TotalHours >= 1 ? $"{(int)t.TotalHours}:{t.Minutes:00}:{t.Seconds:00}" : $"{t.Minutes}:{t.Seconds:00}";

    private void BtnInstall_Click(object sender, RoutedEventArgs e)
    {
        BtnInstall.IsEnabled = false;
        _ = Task.Run(RosbotBridgePluginService.Install).ContinueWith(t => Dispatcher.InvokeAsync(() =>
        {
            BtnInstall.IsEnabled = true;
            var p = D3D4TesterI18n.Provider;
            string key = t.Result switch
            {
                RosbotBridgeInstallResult.Installed => I18nKeys.RosbotBridgeResultInstalled,
                RosbotBridgeInstallResult.UpToDate => I18nKeys.RosbotBridgeResultUpToDate,
                RosbotBridgeInstallResult.NoRosbot => I18nKeys.RosbotBridgeResultNoRosbot,
                RosbotBridgeInstallResult.NoBundle => I18nKeys.RosbotBridgeResultNoBundle,
                RosbotBridgeInstallResult.Locked => I18nKeys.RosbotBridgeResultLocked,
                _ => I18nKeys.RosbotBridgeResultFailed,
            };
            TxtLiveStatus.Text = p.GetUiText(key);
            RefreshInstallInfo();
        }));
    }

    private void BtnOpenDir_Click(object sender, RoutedEventArgs e)
    {
        if (RosbotBridgePluginService.InstalledDir is { } dir && Directory.Exists(dir)) ShellOpen.OpenDir(dir);
        else if (RosbotBridgePluginService.RosDirectory is { } ros) ShellOpen.OpenDir(ros);
    }

    private void BtnSaveAreaName_Click(object sender, RoutedEventArgs e)
    {
        if (_state is not { LevelAreaSno: not 0 } s) return;
        RosbotBridgePluginService.SetAreaName(s.LevelAreaSno, TxtAreaName.Text);
        TxtAreaName.Clear();
        RefreshLive();
    }
}

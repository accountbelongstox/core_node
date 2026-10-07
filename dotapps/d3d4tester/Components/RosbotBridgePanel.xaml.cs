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
using DotCore.Foundations;
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
    private const string LogTag = "[RosbotBridge]";
    private const string PickupKindStash = "stash";
    private DateTime _lastLoggedPickupUtc = DateTime.UtcNow;
    private long _lastLoggedCommandId;
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
                var (auto, patterns) = RosbotBridgePluginService.LoadPickupFilter();
                ChkFilterAuto.IsChecked = auto;
                TxtFilter.Text = string.Join(Environment.NewLine, patterns);
            }
            RefreshI18n();
            _timer.Start();
        };
        Unloaded += (_, _) => _timer.Stop();
    }

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        TxtDesc.Text = p.GetUiText(I18nKeys.RosbotBridgeDesc);
        ChkAutoInstall.Content = p.GetUiText(I18nKeys.RosbotBridgeAutoInstall);
        BtnInstall.Content = p.GetUiText(I18nKeys.RosbotBridgeInstall);
        BtnOpenDir.Content = p.GetUiText(I18nKeys.RosbotBridgeOpenDir);
        BtnSaveAreaName.Content = p.GetUiText(I18nKeys.RosbotBridgeSaveAreaName);
        LblHistory.Text = p.GetUiText(I18nKeys.RosbotBridgeHistory);
        TabGround.Header = p.GetUiText(I18nKeys.RosbotBridgeTabGround);
        TabNpc.Header = p.GetUiText(I18nKeys.RosbotBridgeTabNpc);
        TabCarried.Header = p.GetUiText(I18nKeys.RosbotBridgeTabCarried);
        TabPickups.Header = p.GetUiText(I18nKeys.RosbotBridgeTabPickups);
        TabAdvanced.Header = p.GetUiText(I18nKeys.RosbotBridgeTabAdvanced);
        BtnGroundMoveTo.Content = p.GetUiText(I18nKeys.RosbotBridgeMoveTo);
        BtnGroundPickup.Content = p.GetUiText(I18nKeys.RosbotBridgePickup);
        BtnPickupMatching.Content = p.GetUiText(I18nKeys.RosbotBridgePickupMatching);
        LblFilter.Text = p.GetUiText(I18nKeys.RosbotBridgeFilter);
        ChkFilterAuto.Content = p.GetUiText(I18nKeys.RosbotBridgeFilterAuto);
        BtnSaveFilter.Content = p.GetUiText(I18nKeys.RosbotBridgeSaveFilter);
        BtnNpcFind.Content = p.GetUiText(I18nKeys.RosbotBridgeNpcFind);
        BtnNpcOpen.Content = p.GetUiText(I18nKeys.RosbotBridgeNpcOpen);
        ChkInteractMode.Content = p.GetUiText(I18nKeys.RosbotBridgeInteractMode);
        ChkInteractClick.Content = p.GetUiText(I18nKeys.RosbotBridgeInteractClick);
        TxtNpcTarget.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeNpcTargetHint);
        TxtCarriedNote.Text = p.GetUiText(I18nKeys.RosbotBridgeCarriedNote);
        BtnClickUi.Content = p.GetUiText(I18nKeys.RosbotBridgeClickUi);
        TxtUiId.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeUiIdHint);
        TxtCapabilities.Text = p.GetUiText(I18nKeys.RosbotBridgeCapabilities);
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

        Fill(LstGround, s?.GroundItems, e => GroundText(e, p));
        Fill(LstNpcs, s?.Npcs, e => NpcText(e, p));
        Fill(LstCarried, s?.CarriedItems, e => CarriedText(e, p));
        LstPickups.Items.Clear();
        foreach (var r in s?.Pickups ?? Array.Empty<RosbotBridgePickup>()) LstPickups.Items.Add(PickupText(r, p));
        if (s?.LastCommand is { } c)
            TxtCommandResult.Text = string.Format(p.GetUiText(c.Ok ? I18nKeys.RosbotBridgeCommandOk : I18nKeys.RosbotBridgeCommandFailed),
                c.Action, c.Message, c.Utc.ToLocalTime().ToString(TimeFormat));
        LogNewEvents(s);
    }

    /// <summary>Write new pickups and command results to the app log once each.</summary>
    private void LogNewEvents(RosbotBridgeState? s)
    {
        if (s == null) return;
        foreach (var r in s.Pickups.Where(r => r.Utc > _lastLoggedPickupUtc).OrderBy(r => r.Utc))
            ColorPrinter.Green($"{LogTag} {r.Kind}: {r.Name} [{r.InternalName}] quality={r.Quality} ancient={r.AncientRank}");
        if (s.Pickups.Count > 0) _lastLoggedPickupUtc = s.Pickups.Max(r => r.Utc);
        if (s.LastCommand is { } c && c.Id != _lastLoggedCommandId)
        {
            _lastLoggedCommandId = c.Id;
            ColorPrinter.Blue($"{LogTag} command {c.Id} {c.Action}: {(c.Ok ? "ok" : "failed")} {c.Message}");
        }
    }

    /// <summary>Refill a list with entities, keeping the selected entity (by actor id, else ACD id) selected.</summary>
    private static void Fill(ListBox list, IReadOnlyList<RosbotBridgeEntity>? items, Func<RosbotBridgeEntity, string> text)
    {
        var selected = (list.SelectedItem as ListBoxItem)?.Tag as RosbotBridgeEntity;
        list.Items.Clear();
        foreach (var e in items ?? Array.Empty<RosbotBridgeEntity>())
        {
            var item = new ListBoxItem { Content = text(e), Tag = e };
            list.Items.Add(item);
            if (selected != null && (e.Id != 0 ? e.Id == selected.Id : e.AcdId == selected.AcdId)) list.SelectedItem = item;
        }
    }

    private static string GroundText(RosbotBridgeEntity e, II18nProvider p) => Join(
        e.FilterMatch ? p.GetUiText(I18nKeys.RosbotBridgeFilterMark) + e.Name : e.Name,
        $"[{e.InternalName}]", QualityText(e, p), string.Format(p.GetUiText(I18nKeys.RosbotBridgeDistance), e.Distance));

    private static string NpcText(RosbotBridgeEntity e, II18nProvider p) => Join(
        e.Name, $"[{e.InternalName}]", string.Format(p.GetUiText(I18nKeys.RosbotBridgeDistance), e.Distance),
        string.Format(p.GetUiText(I18nKeys.RosbotBridgeInteractDistance), e.InteractDistance));

    private static string CarriedText(RosbotBridgeEntity e, II18nProvider p) => Join(
        e.Equipped ? p.GetUiText(I18nKeys.RosbotBridgeEquipped) + e.Name : e.Name,
        QualityText(e, p),
        e.Stack > 1 ? $"×{e.Stack}" : "",
        e.DurabilityMax > 0 ? string.Format(p.GetUiText(I18nKeys.RosbotBridgeDurability), e.DurabilityCur, e.DurabilityMax) : "");

    private static string PickupText(RosbotBridgePickup r, II18nProvider p) => Join(
        r.Utc.ToLocalTime().ToString(TimeFormat),
        p.GetUiText(r.Kind == PickupKindStash ? I18nKeys.RosbotBridgeKindStash : I18nKeys.RosbotBridgeKindPickup),
        r.Name, string.IsNullOrEmpty(r.InternalName) ? "" : $"[{r.InternalName}]",
        QualityText(r.Quality, r.AncientRank, p));

    private static string QualityText(RosbotBridgeEntity e, II18nProvider p) => QualityText(e.Quality, e.AncientRank, p);

    /// <summary>D3 Item_Quality_Level: 0-2 normal, 3-5 magic, 6-8 rare, 9+ legendary; Ancient_Rank 1 ancient, 2 primal.</summary>
    private static string QualityText(int quality, int ancientRank, II18nProvider p)
    {
        string q = quality switch
        {
            < 0 => "",
            <= 2 => p.GetUiText(I18nKeys.RosbotBridgeQualityNormal),
            <= 5 => p.GetUiText(I18nKeys.RosbotBridgeQualityMagic),
            <= 8 => p.GetUiText(I18nKeys.RosbotBridgeQualityRare),
            _ => p.GetUiText(I18nKeys.RosbotBridgeQualityLegendary),
        };
        string a = ancientRank switch
        {
            1 => p.GetUiText(I18nKeys.RosbotBridgeAncient),
            >= 2 => p.GetUiText(I18nKeys.RosbotBridgePrimal),
            _ => "",
        };
        return string.Join(" ", new[] { a, q }.Where(x => x.Length > 0));
    }

    private static string Join(params string[] parts) => string.Join(Separator, parts.Where(x => !string.IsNullOrEmpty(x)));

    private static RosbotBridgeEntity? Selected(ListBox list) => (list.SelectedItem as ListBoxItem)?.Tag as RosbotBridgeEntity;

    /// <summary>Queue a plugin command and show that it was sent (the plugin's result follows in the next state).</summary>
    private void Send(string action, string? target = null, bool? mode = null, bool? click = null, string? uiId = null)
    {
        var p = D3D4TesterI18n.Provider;
        if (action != RosbotPluginConstants.BridgeActionPickupFilter && action != RosbotPluginConstants.BridgeActionClickUi && string.IsNullOrWhiteSpace(target))
        {
            TxtCommandResult.Text = p.GetUiText(I18nKeys.RosbotBridgeSelectTarget);
            return;
        }
        long? id = RosbotBridgePluginService.SendCommand(action, target, mode, click, uiId);
        TxtCommandResult.Text = id == null ? p.GetUiText(I18nKeys.RosbotBridgeCommandNotSent) : string.Format(p.GetUiText(I18nKeys.RosbotBridgeCommandSent), action);
    }

    private void BtnGroundMoveTo_Click(object sender, RoutedEventArgs e) => Send(RosbotPluginConstants.BridgeActionMoveTo, Selected(LstGround)?.Id.ToString());

    private void BtnGroundPickup_Click(object sender, RoutedEventArgs e) => Send(RosbotPluginConstants.BridgeActionPickup, Selected(LstGround)?.Id.ToString());

    private void BtnPickupMatching_Click(object sender, RoutedEventArgs e)
    {
        SaveFilter();
        Send(RosbotPluginConstants.BridgeActionPickupFilter);
    }

    private void BtnSaveFilter_Click(object sender, RoutedEventArgs e) => SaveFilter();

    private void SaveFilter()
    {
        var p = D3D4TesterI18n.Provider;
        var patterns = TxtFilter.Text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        bool ok = RosbotBridgePluginService.SavePickupFilter(ChkFilterAuto.IsChecked == true, patterns);
        TxtCommandResult.Text = p.GetUiText(ok ? I18nKeys.RosbotBridgeFilterSaved : I18nKeys.RosbotBridgeCommandNotSent);
    }

    private string? NpcTarget() => Selected(LstNpcs)?.Id.ToString() is { } id && id != "0" ? id : TxtNpcTarget.Text;

    private void BtnNpcFind_Click(object sender, RoutedEventArgs e) => Send(RosbotPluginConstants.BridgeActionMoveTo, NpcTarget());

    private void BtnNpcOpen_Click(object sender, RoutedEventArgs e) =>
        Send(RosbotPluginConstants.BridgeActionInteract, NpcTarget(), ChkInteractMode.IsChecked == true, ChkInteractClick.IsChecked == true);

    private void BtnClickUi_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(TxtUiId.Text))
        {
            TxtCommandResult.Text = D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotBridgeSelectTarget);
            return;
        }
        Send(RosbotPluginConstants.BridgeActionClickUi, uiId: TxtUiId.Text);
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

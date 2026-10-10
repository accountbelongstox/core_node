// PY-REF: none (DOT-only)
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Bridge;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Common;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// CoreNodeBridge ROSBOT plugin panel: installed vs bundled plugin, auto-install switch, install / open folder, and the live
/// game state the plugin publishes (current map with a user-given name, location kind, paragon, health, sequence, recent maps),
/// polled once per second while visible. Commands that act in the game take control first (RosbotBridgePluginService.TakeControlAsync:
/// flow halted, a botting ROSBOT paused with its pause key, not stopped), so the bot task and the app flow do not fight the command;
/// control stays with the panel until "Resume monitoring". One-click town standby takes control the same way and lets the plugin
/// bring the hero to town and keep it there for the panel's commands; the strip's button then resumes monitoring.
/// </summary>
public partial class RosbotBridgePanel : UserControl
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(1);
    private const string TimeFormat = "HH:mm:ss";
    private const string Separator = " · ";
    private const string Empty = RosbotBridgeText.Empty;
    private const string LogTag = "[RosbotBridge]";
    private const string StyleSecondaryButton = "SecondaryButtonStyle";
    private const string StyleWarningButton = "WarningButtonStyle";
    private const string StylePrimaryButton = "PrimaryButtonStyle";
    private static readonly HashSet<string> GameActions = new(StringComparer.Ordinal)
    {
        RosbotPluginConstants.BridgeActionMoveTo, RosbotPluginConstants.BridgeActionInteract, RosbotPluginConstants.BridgeActionPickup,
        RosbotPluginConstants.BridgeActionPickupFilter, RosbotPluginConstants.BridgeActionClickUi, RosbotPluginConstants.BridgeActionGoNpc,
        RosbotPluginConstants.BridgeActionSalvageAll, RosbotPluginConstants.BridgeActionFollow, RosbotPluginConstants.BridgeActionUiSequence,
    };
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
        foreach (var (actorName, _) in RosbotPluginConstants.BridgeTownNpcs)
        {
            var button = new Button { Tag = actorName, Margin = new Thickness(0, 0, 6, 4) };
            button.SetResourceReference(StyleProperty, StyleSecondaryButton);
            button.Click += (_, _) => Send(RosbotPluginConstants.BridgeActionGoNpc, actorName);
            PanelTownNpcs.Children.Add(button);
        }
        _timer.Tick += (_, _) => RefreshLive();
        Loaded += (_, _) =>
        {
            if (!_bound)
            {
                _bound = true;
                ConfigBinding.BindCheckBox(ChkAutoInstall, ConfigKeys.RosbotBridgePluginAutoInstall, ConfigKeys.RosbotBridgePluginAutoInstallDefault);
                ConfigBinding.BindCheckBox(ChkTakeControl, ConfigKeys.BridgeTakeControl, ConfigKeys.BridgeTakeControlDefault);
                ConfigBinding.BindTextBox(TxtTownPortalKey, ConfigKeys.BridgeFollowTownPortalKey, ConfigKeys.BridgeFollowTownPortalKeyDefault);
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
        BtnInstall.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeDesc);
        ChkAutoInstall.Content = p.GetUiText(I18nKeys.RosbotBridgeAutoInstall);
        BtnInstall.Content = p.GetUiText(I18nKeys.RosbotBridgeInstall);
        BtnOpenDir.Content = p.GetUiText(I18nKeys.RosbotBridgeOpenDir);
        BtnSaveAreaName.Content = p.GetUiText(I18nKeys.RosbotBridgeSaveAreaName);
        LblHistory.Text = p.GetUiText(I18nKeys.RosbotBridgeHistory);
        TabGround.Header = p.GetUiText(I18nKeys.RosbotBridgeTabGround);
        TabNpc.Header = p.GetUiText(I18nKeys.RosbotBridgeTabNpc);
        TabFollow.Header = p.GetUiText(I18nKeys.RosbotBridgeTabFollow);
        LblTownPortalKey.Text = p.GetUiText(I18nKeys.RosbotBridgeFollowTownPortalKey);
        TxtTownPortalKey.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeFollowTownPortalKeyTip);
        BtnStandby.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeStandbyTip);
        TabCarried.Header = p.GetUiText(I18nKeys.RosbotBridgeTabCarried);
        TabPickups.Header = p.GetUiText(I18nKeys.RosbotBridgeTabPickups);
        TabAdvanced.Header = p.GetUiText(I18nKeys.RosbotBridgeTabAdvanced);
        TabBuild.Header = p.GetUiText(I18nKeys.RosbotBridgeTabBuild);
        BuildBlock.RefreshI18n();
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
        TabCarried.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeCarriedNote);
        BtnClickUi.Content = p.GetUiText(I18nKeys.RosbotBridgeClickUi);
        TxtUiId.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeUiIdHint);
        TxtCapabilities.Text = p.GetUiText(I18nKeys.RosbotBridgeCapabilities);
        foreach (var button in PanelTownNpcs.Children.OfType<Button>())
        {
            string labelKey = RosbotPluginConstants.BridgeTownNpcs.First(n => n.ActorName == (string)button.Tag).LabelKey;
            button.Content = p.GetUiText(labelKey);
            button.ToolTip = string.Format(p.GetUiText(I18nKeys.RosbotBridgeNpcGoTip), button.Content);
        }
        RefreshStandby(_state);
        LblFollowBanner.Text = p.GetUiText(I18nKeys.RosbotBridgeFollowBanner);
        BtnFollow.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeFollowTip);
        int bannerIndex = CmbFollowBanner.SelectedIndex;
        CmbFollowBanner.ItemsSource = RosbotPluginConstants.BridgeFollowBannerSlots
            .Select(s => s == 0 ? p.GetUiText(I18nKeys.RosbotBridgeFollowBannerAuto)
                : s == RosbotPluginConstants.BridgeFollowLeaderSlot ? string.Format(p.GetUiText(I18nKeys.RosbotBridgeFollowBannerLeader), s) : s.ToString()).ToList();
        int targetIndex = CmbFollowTarget.SelectedIndex;
        CmbFollowTarget.ItemsSource = RosbotPluginConstants.BridgeFollowTargets.Select(t => t.Mode switch
        {
            RosbotPluginConstants.BridgeFollowLeader => p.GetUiText(I18nKeys.RosbotBridgeFollowTargetLeader),
            RosbotPluginConstants.BridgeFollowSlot => string.Format(p.GetUiText(I18nKeys.RosbotBridgeFollowTargetSlot), t.Slot),
            RosbotPluginConstants.BridgeFollowSelected => p.GetUiText(I18nKeys.RosbotBridgeFollowTargetSelected),
            _ => p.GetUiText(I18nKeys.RosbotBridgeFollowTargetNearest),
        }).ToList();
        CmbFollowTarget.SelectedIndex = targetIndex < 0 ? 0 : targetIndex;
        ChkFollowPickup.Content = p.GetUiText(I18nKeys.RosbotBridgeFollowPickup);
        ChkFollowRevive.Content = p.GetUiText(I18nKeys.RosbotBridgeFollowRevive);
        ChkFollowRevive.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeFollowReviveTip);
        CmbFollowBanner.SelectedIndex = bannerIndex < 0 ? 0 : bannerIndex;
        LblTests.Text = p.GetUiText(I18nKeys.RosbotBridgeTests);
        ChkTakeControl.Content = p.GetUiText(I18nKeys.RosbotBridgeTakeControl);
        ChkTakeControl.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeHoldTip);
        BtnSalvageNormal.Content = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageNormal);
        BtnSalvageMagic.Content = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageMagic);
        BtnSalvageRare.Content = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageRare);
        BtnSalvageNormal.ToolTip = BtnSalvageMagic.ToolTip = BtnSalvageRare.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageTip);
        BtnSalvageKeepAncient.Content = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageKeepAncient);
        BtnSalvageKeepPrimal.Content = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageKeepPrimal);
        BtnSalvageKeepAncient.ToolTip = BtnSalvageKeepPrimal.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageLegendaryTip);
        BtnSalvageRule.Content = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageRule);
        BtnSalvageRule.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeTestSalvageRuleTip);
        BtnDropRule.Content = p.GetUiText(I18nKeys.RosbotBridgeTestDropRule);
        BtnDropRule.ToolTip = p.GetUiText(I18nKeys.RosbotBridgeTestDropRuleTip);
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
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        var s = snapshot.RosbotBridge;
        _state = s;
        RefreshStandby(s);
        var now = DateTime.UtcNow;
        TxtLiveStatus.Text = p.GetUiText(RosbotBridgeText.LiveStatusKey(s, snapshot.RosbotBridgeFresh));
        string[] values = s == null ? RowKeys.Select(_ => Empty).ToArray() : new[]
        {
            RosbotBridgeText.AreaText(s.LevelAreaSno, p),
            FormatDuration(now - s.LevelAreaSinceUtc),
            RosbotBridgeText.LocationText(s, p),
            s.SceneSno.ToString(),
            $"{s.WorldId}{Separator}{s.GlobalWorldId}",
            s.Paragon.ToString(),
            (s.Dead ? p.GetUiText(I18nKeys.RosbotBridgeDead) : $"{s.HealthPct * 100:0}%" + (s.InCombat ? Separator + p.GetUiText(I18nKeys.RosbotBridgeInCombat) : ""))
                + (s.MonstersNearby > 0 ? Separator + string.Format(p.GetUiText(I18nKeys.RosbotBridgeMonstersNearby), s.MonstersNearby, s.ElitesNearby) : ""),
            string.Format(p.GetUiText(I18nKeys.RosbotBridgeResourcesFormat), RosbotBridgeText.BloodShardsText(s, p), s.RiftKeys)
                + (s.InventoryFull ? Separator + p.GetUiText(I18nKeys.RosbotBridgeInventoryFull) : "")
                + (s.RepairNeeded ? Separator + p.GetUiText(I18nKeys.RosbotBridgeRepairNeeded) : ""),
            string.IsNullOrEmpty(s.Sequence) ? Empty : s.Sequence,
            string.IsNullOrEmpty(s.LastEvent) ? Empty : s.LastEvent,
            s.UpdatedUtc.ToLocalTime().ToString(TimeFormat),
        };
        for (int i = 0; i < _rows.Count; i++) _rows[i].Value.Text = values[i];

        LstHistory.Items.Clear();
        foreach (var visit in s?.LevelAreaHistory ?? Array.Empty<RosbotBridgeAreaVisit>())
            LstHistory.Items.Add($"{visit.Utc.ToLocalTime().ToString(TimeFormat)}{Separator}{RosbotBridgeText.AreaText(visit.Sno, p)}");

        Fill(LstGround, s?.GroundItems, e => GroundText(e, p));
        Fill(LstNpcs, s?.Npcs, e => NpcText(e, p));
        Fill(LstPlayers, s?.Players, e => PlayerText(e, p));
        RefreshFollow(s, p);
        Fill(LstCarried, s?.CarriedItems.Where(e => !RosbotPluginConstants.BridgeHiddenSlots.Contains(e.Slot))
            .OrderBy(SlotOrder).ThenBy(e => e.Slot, StringComparer.Ordinal).ToList(), e => CarriedText(e, p));
        LstPickups.Items.Clear();
        var unaligned = D3PlannerService.Alignment().Unaligned.ToHashSet();
        foreach (var r in s?.Pickups ?? Array.Empty<RosbotBridgePickup>()) LstPickups.Items.Add(PickupText(r, unaligned, p));
        if (s?.RunningCommand is { } running)
            TxtCommandResult.Text = string.Format(p.GetUiText(I18nKeys.RosbotBridgeCommandRunning), running.Action,
                FormatDuration(DateTime.UtcNow - running.Utc));
        else if (s?.LastCommand is { } c)
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
        (e.FilterMatch ? p.GetUiText(I18nKeys.RosbotBridgeFilterMark) : "") + D3PlannerService.DisplayName(e.Gbid, e.Name), ItemIds(e),
        QualityText(e, p), string.Format(p.GetUiText(I18nKeys.RosbotBridgeDistance), e.Distance));

    /// <summary>Player row: party slot (from the banners) and leader mark when known, actor name and id, distance.</summary>
    private static string PlayerText(RosbotBridgeEntity e, II18nProvider p) => Join(
        p.GetUiText(I18nKeys.RosbotBridgePlayer) + (e.PartySlot > 0 ? $" {e.PartySlot}" : ""),
        e.IsLeader ? p.GetUiText(I18nKeys.RosbotBridgeFollowTargetLeader) : "",
        $"[{e.Name} #{e.Id}]", string.Format(p.GetUiText(I18nKeys.RosbotBridgeDistance), e.Distance));

    /// <summary>Follow button text / style and the follow state line (state, leader, distance).</summary>
    private void RefreshFollow(RosbotBridgeState? s, II18nProvider p)
    {
        bool on = s?.FollowEnabled == true;
        BtnFollow.Content = p.GetUiText(on ? I18nKeys.RosbotBridgeFollowStop : I18nKeys.RosbotBridgeFollowStart);
        BtnFollow.SetResourceReference(StyleProperty, on ? StyleWarningButton : StyleSecondaryButton);
        TxtFollowState.Text = !on ? "" : Join(p.GetUiText(I18nKeys.RosbotBridgeFollowStatePrefix + s!.FollowState, s.FollowState), s.FollowLeader,
            s.FollowDistance >= 0 ? string.Format(p.GetUiText(I18nKeys.RosbotBridgeDistance), s.FollowDistance) : "");
    }

    /// <summary>Start following the selected player (else the nearest one) with the chosen banner slot, or stop.</summary>
    private void BtnFollow_Click(object sender, RoutedEventArgs e)
    {
        if (_state?.FollowEnabled == true)
        {
            Send(RosbotPluginConstants.BridgeActionFollow, value: RosbotPluginConstants.BridgeFollowOff);
            return;
        }
        var selected = Selected(LstPlayers);
        var (mode, partySlot) = RosbotPluginConstants.BridgeFollowTargets[Math.Max(0, CmbFollowTarget.SelectedIndex)];
        bool useSelected = mode == RosbotPluginConstants.BridgeFollowSelected;
        if (useSelected && (selected == null || _state?.Players.Contains(selected) != true))
        {
            TxtCommandResult.Text = D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotBridgeFollowSelectPlayer);
            return;
        }
        string leader = useSelected ? selected!.Id.ToString() : "";
        int slot = RosbotPluginConstants.BridgeFollowBannerSlots[Math.Max(0, CmbFollowBanner.SelectedIndex)];
        Send(RosbotPluginConstants.BridgeActionFollow, leader, value: $"{mode},{partySlot},{slot},{(ChkFollowPickup.IsChecked == true ? 1 : 0)},{(ChkFollowRevive.IsChecked == true ? 1 : 0)}");
    }

    /// <summary>Localized NPC name (i18n table by internal actor name), the internal name and the SNO id, distances.</summary>
    private static string NpcText(RosbotBridgeEntity e, II18nProvider p) => Join(
        NpcName(e, p), $"[{(e.InternalName.Length > 0 ? e.InternalName : e.Name)} #{e.Sno}]",
        string.Format(p.GetUiText(I18nKeys.RosbotBridgeDistance), e.Distance),
        string.Format(p.GetUiText(I18nKeys.RosbotBridgeInteractDistance), e.InteractDistance));

    /// <summary>Equipped first, then backpack, then stash.</summary>
    private static int SlotOrder(RosbotBridgeEntity e) =>
        e.Slot == RosbotPluginConstants.BridgeSlotStash ? 2 : e.Slot == RosbotPluginConstants.BridgeSlotBackpack ? 1 : e.Equipped ? 0 : 1;

    /// <summary>Location (equipment slot / backpack / stash), the item name (maxroll name by GBID when the plugin has none), quality, stack, durability.</summary>
    private static string CarriedText(RosbotBridgeEntity e, II18nProvider p) => Join(
        e.Slot == RosbotPluginConstants.BridgeSlotBackpack ? p.GetUiText(I18nKeys.RosbotBridgeSlotBackpack)
            : e.Slot == RosbotPluginConstants.BridgeSlotStash ? p.GetUiText(I18nKeys.RosbotBridgeSlotStash)
            : RosbotPluginConstants.BridgePotionSlots.Contains(e.Slot) ? p.GetUiText(I18nKeys.RosbotBridgeSlotPotion)
            : D3PaperDollLayout.FromInventorySlot.TryGetValue(e.Slot, out var slotKey) ? p.GetUiText(I18nKeys.RosbotBridgeSlotPrefix + slotKey)
            : e.Equipped ? p.GetUiText(I18nKeys.RosbotBridgeEquipped).Trim() : "",
        D3PlannerService.DisplayName(e.Gbid, e.Name), ItemIds(e),
        QualityText(e, p),
        e.Stack > 1 ? $"×{e.Stack}" : "",
        e.DurabilityMax > 0 ? string.Format(p.GetUiText(I18nKeys.RosbotBridgeDurability), e.DurabilityCur, e.DurabilityMax) : "");

    /// <summary>Pickup row; an item of the gear set shows its slot and whether the town visit equips it (slot unaligned) or not.</summary>
    private static string PickupText(RosbotBridgePickup r, IReadOnlySet<PlannerItem> unaligned, II18nProvider p) => Join(
        r.Utc.ToLocalTime().ToString(TimeFormat),
        p.GetUiText(r.Kind == RosbotPluginConstants.BridgePickupKindStash ? I18nKeys.RosbotBridgeKindStash : I18nKeys.RosbotBridgeKindPickup),
        r.Gbid != 0 ? D3PlannerService.DisplayName(r.Gbid, r.Name) : r.Name,
        QualityText(r.Quality, r.AncientRank, p),
        D3PlannerService.PlannedFor(r.Gbid, r.InternalName, r.Name, r.AncientRank) is { } planned
            ? string.Format(p.GetUiText(unaligned.Contains(planned) ? I18nKeys.RosbotBridgePickupBuildEquip : I18nKeys.RosbotBridgePickupBuildAligned),
                D3PlannerService.SlotName(planned))
            : "");

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

    /// <summary>Internal actor name and GameBalanceId of an item, e.g. [x1_Ruby_07 #1019190640].</summary>
    private static string ItemIds(RosbotBridgeEntity e) =>
        $"[{(e.InternalName.Length > 0 ? DisplayInternal(e.InternalName) : e.Name)} #{e.Gbid}]";

    private static string DisplayInternal(string internalName) => Core.Planner.D3PlannerMatcher.NormalizeName(internalName);

    private static string NpcName(RosbotBridgeEntity e, II18nProvider p)
    {
        string actor = e.InternalName.Length > 0 ? e.InternalName : e.Name;
        return p.GetUiText(I18nKeys.RosbotBridgeNpcNamePrefix + actor.ToLowerInvariant(), actor);
    }

    private static string Join(params string[] parts) => string.Join(Separator, parts.Where(x => !string.IsNullOrEmpty(x)));

    private static RosbotBridgeEntity? Selected(ListBox list) => (list.SelectedItem as ListBoxItem)?.Tag as RosbotBridgeEntity;

    /// <summary>
    /// Standby button: "return to town and stand by" while the plugin is not standing by; during standby "end standby" (= Resume
    /// monitoring, which also ends the standby). State line: standby state and since when, else nothing.
    /// </summary>
    private void RefreshStandby(RosbotBridgeState? s)
    {
        var p = D3D4TesterI18n.Provider;
        bool on = s?.StandbyEnabled == true;
        BtnStandby.Content = p.GetUiText(on ? I18nKeys.RosbotBridgeStandbyEnd : I18nKeys.RosbotBridgeStandbyStart);
        BtnStandby.SetResourceReference(StyleProperty, on ? StyleWarningButton : StylePrimaryButton);
        TxtStandbyState.Text = !on ? "" : Join(p.GetUiText(I18nKeys.RosbotBridgeStandbyStatePrefix + s!.StandbyState, s.StandbyState),
            s.StandbySinceUtc == default ? "" : string.Format(p.GetUiText(I18nKeys.RosbotBridgeStandbySince), s.StandbySinceUtc.ToLocalTime().ToString(TimeFormat)));
    }

    private async void BtnStandby_Click(object sender, RoutedEventArgs e)
    {
        var p = D3D4TesterI18n.Provider;
        if (_state?.StandbyEnabled == true)
        {
            if (RosbotFlowState.Instance.Paused) RosbotTaskProcessor.Instance.RequestResumeFlow();
            else Send(RosbotPluginConstants.BridgeActionStandby, value: RosbotPluginConstants.BridgeStandbyOff);
            return;
        }
        BtnStandby.IsEnabled = false;
        TxtCommandResult.Text = p.GetUiText(I18nKeys.RosbotBridgeHoldTaken);
        try
        {
            bool sent = await RosbotBridgePluginService.EnterTownStandbyAsync();
            TxtCommandResult.Text = string.Format(p.GetUiText(sent ? I18nKeys.RosbotBridgeStandbySent : I18nKeys.RosbotBridgeStandbyNotSent), BridgeTownPortal.Key);
        }
        finally
        {
            BtnStandby.IsEnabled = true;
        }
    }

    /// <summary>Queue a plugin command and show that it was sent (the plugin's result follows in the next state). Game actions take control first.</summary>
    private async void Send(string action, string? target = null, bool? mode = null, bool? click = null, string? uiId = null, string? value = null)
    {
        var p = D3D4TesterI18n.Provider;
        if (!GameInterfaceData.Instance.GetStateSnapshot().RosbotBridgeFresh)
        {
            TxtCommandResult.Text = p.GetUiText(I18nKeys.RosbotBridgePluginNotRunning);
            return;
        }
        if (GameActions.Contains(action) && ConfigBinding.GetValue(ConfigKeys.BridgeTakeControl, ConfigKeys.BridgeTakeControlDefault))
        {
            TxtCommandResult.Text = p.GetUiText(I18nKeys.RosbotBridgeHoldTaken);
            await RosbotBridgePluginService.TakeControlAsync();
        }
        if (action is not (RosbotPluginConstants.BridgeActionPickupFilter or RosbotPluginConstants.BridgeActionClickUi or RosbotPluginConstants.BridgeActionSalvageAll
                or RosbotPluginConstants.BridgeActionFollow or RosbotPluginConstants.BridgeActionUiSequence or RosbotPluginConstants.BridgeActionStandby)
            && string.IsNullOrWhiteSpace(target))
        {
            TxtCommandResult.Text = p.GetUiText(I18nKeys.RosbotBridgeSelectTarget);
            return;
        }
        if (RosbotBridgePluginService.CommandPending)
        {
            TxtCommandResult.Text = p.GetUiText(I18nKeys.RosbotBridgeCommandBusy);
            return;
        }
        long? id = RosbotBridgePluginService.SendCommand(action, target, mode, click, uiId, value);
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

    private void BtnSalvageNormal_Click(object sender, RoutedEventArgs e) =>
        Send(RosbotPluginConstants.BridgeActionSalvageAll, value: RosbotPluginConstants.BridgeSalvageNormal);

    private void BtnSalvageMagic_Click(object sender, RoutedEventArgs e) =>
        Send(RosbotPluginConstants.BridgeActionSalvageAll, value: RosbotPluginConstants.BridgeSalvageMagic);

    private void BtnSalvageRare_Click(object sender, RoutedEventArgs e) =>
        Send(RosbotPluginConstants.BridgeActionSalvageAll, value: RosbotPluginConstants.BridgeSalvageRare);

    private void BtnSalvageKeepAncient_Click(object sender, RoutedEventArgs e) => TestActionRegistry.TryInvoke(I18nKeys.RosbotBridgeTestSalvageKeepAncient);

    private void BtnSalvageKeepPrimal_Click(object sender, RoutedEventArgs e) => TestActionRegistry.TryInvoke(I18nKeys.RosbotBridgeTestSalvageKeepPrimal);

    private void BtnSalvageRule_Click(object sender, RoutedEventArgs e) => TestActionRegistry.TryInvoke(I18nKeys.RosbotBridgeTestSalvageRule);

    private void BtnDropRule_Click(object sender, RoutedEventArgs e) => TestActionRegistry.TryInvoke(I18nKeys.RosbotBridgeTestDropRule);

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

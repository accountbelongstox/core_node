// PY-REF: none (DOT-only)
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// Build sub-tab of the bridge panel: load a maxroll d3planner build by URL, pick its gear set, switch drop / pickup alerts, two
/// paper dolls in D3 character-screen layout (left = what the hero wears, from the bridge plugin; right = the maxroll gear set; same
/// item = match, different / missing = mismatch), and every planned item (slot, name, required ancient rank, affixes) next to its best
/// copy in game (carried or on the ground, affixes ok / checked). Refreshed every RefreshInterval while visible (D3PlannerService).
/// </summary>
public partial class D3PlannerBuildBlock : UserControl
{
    private static readonly TimeSpan RefreshInterval = TimeSpan.FromSeconds(2);
    private const string StatSeparator = ", ";
    private const string LineSeparator = "\n";
    private const string PercentSuffix = "%";
    private const string MarkOk = "+ ";
    private const string MarkMissing = "x ";
    private const string MarkUnchecked = "? ";
    private const string KanaiSlotPrefix = "kanai.";
    private const string ValueFormat = "0.##";
    private const string SlotSeparator = ", ";

    private readonly DispatcherTimer _timer = new() { Interval = RefreshInterval };
    private bool _bound;
    private bool _loadingProfiles;

    public D3PlannerBuildBlock()
    {
        InitializeComponent();
        _timer.Tick += (_, _) => RefreshItems();
        Loaded += (_, _) =>
        {
            if (!_bound)
            {
                _bound = true;
                ConfigBinding.BindTextBox(TxtUrl, ConfigKeys.D3PlannerUrl, "");
                ConfigBinding.BindCheckBox(ChkNotify, ConfigKeys.D3PlannerNotify, true);
                ConfigBinding.BindCheckBox(ChkNotifyPush, ConfigKeys.D3PlannerNotifyPush, false);
                ConfigBinding.BindCheckBox(ChkEquipInTown, ConfigKeys.D3PlannerEquipInTown, ConfigKeys.D3PlannerEquipInTownDefault);
                ConfigBinding.BindCheckBox(ChkGambleUnaligned, ConfigKeys.D3PlannerGambleUnaligned, ConfigKeys.D3PlannerGambleUnalignedDefault);
            }
            D3PlannerService.BuildChanged -= OnBuildChanged;
            D3PlannerService.BuildChanged += OnBuildChanged;
            RefreshI18n();
            _timer.Start();
        };
        Unloaded += (_, _) =>
        {
            _timer.Stop();
            D3PlannerService.BuildChanged -= OnBuildChanged;
        };
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    public void RefreshI18n()
    {
        BtnLoad.Content = T(I18nKeys.RosbotBridgeBuildLoad);
        TxtUrl.ToolTip = T(I18nKeys.RosbotBridgeBuildUrl);
        LblBuild.Text = T(I18nKeys.RosbotBridgeBuildSelect);
        BtnRemove.Content = T(I18nKeys.RosbotBridgeBuildRemove);
        LblProfile.Text = T(I18nKeys.RosbotBridgeBuildProfile);
        ChkNotify.Content = T(I18nKeys.RosbotBridgeBuildNotify);
        ChkNotifyPush.Content = T(I18nKeys.RosbotBridgeBuildNotifyPush);
        ChkEquipInTown.Content = T(I18nKeys.RosbotBridgeBuildEquipInTown);
        ChkEquipInTown.ToolTip = T(I18nKeys.RosbotBridgeBuildEquipInTownTip);
        ChkGambleUnaligned.Content = T(I18nKeys.RosbotBridgeBuildGambleUnaligned);
        ChkGambleUnaligned.ToolTip = T(I18nKeys.RosbotBridgeBuildGambleUnalignedTip);
        LblDollGame.Text = T(I18nKeys.RosbotBridgeDollGame);
        LblDollPlan.Text = T(I18nKeys.RosbotBridgeDollPlan);
        ColSlot.Header = T(I18nKeys.RosbotBridgeBuildColSlot);
        ColItem.Header = T(I18nKeys.RosbotBridgeBuildColItem);
        ColHave.Header = T(I18nKeys.RosbotBridgeBuildColHave);
        ColAffixes.Header = new TextBlock { Text = T(I18nKeys.RosbotBridgeBuildColAffixes), ToolTip = T(I18nKeys.RosbotBridgeBuildHint) };
        RefreshBuild();
    }

    private void OnBuildChanged()
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(OnBuildChanged);
            return;
        }
        RefreshBuild();
    }

    /// <summary>Status line and gear-set list from the loaded build, then the item rows.</summary>
    private void RefreshBuild()
    {
        var build = D3PlannerService.Build;
        TxtStatus.Text = build == null
            ? T(I18nKeys.RosbotBridgeBuildNone)
            : string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildLoaded), build.Name, build.Class, D3PlannerService.Profile?.Items.Count ?? 0);
        _loadingProfiles = true;
        CmbBuild.ItemsSource = D3PlannerService.Builds.Select(b => b.Name).ToList();
        CmbBuild.SelectedIndex = D3PlannerService.BuildIndex;
        BtnRemove.IsEnabled = build != null;
        CmbProfile.ItemsSource = build?.Profiles.Select(p => p.Name).ToList();
        CmbProfile.SelectedIndex = D3PlannerService.ProfileIndex;
        _loadingProfiles = false;
        RefreshItems();
    }

    private void RefreshItems()
    {
        if (!IsVisible) return;
        LstItems.ItemsSource = D3PlannerService.Status().Select(ToRow).ToList();
        RefreshAlignment();
        RefreshDolls();
    }

    /// <summary>Unaligned planned items (slots), backpack upgrades the next town visit equips, blood shards for the Kadala gamble.</summary>
    private void RefreshAlignment()
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (D3PlannerService.Profile == null || snapshot.RosbotBridge is not { } state || !snapshot.RosbotBridgeFresh)
        {
            TxtAlignment.Text = "";
            return;
        }
        var alignment = D3PlannerService.Alignment();
        TxtAlignment.Text = alignment.Unaligned.Count == 0
            ? T(I18nKeys.RosbotBridgeBuildAligned)
            : string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildAlignment), alignment.Unaligned.Count,
                string.Join(SlotSeparator, alignment.Unaligned.Select(D3PlannerService.SlotName)), alignment.Upgrades.Count,
                RosbotBridgeText.BloodShardsText(state, D3D4TesterI18n.Provider));
    }

    /// <summary>Left doll = worn items (bridge plugin), right doll = planned gear set; cells compare the same slot on both sides.</summary>
    private void RefreshDolls()
    {
        var equipped = D3PlannerService.EquippedBySlot();
        var planned = D3PlannerService.Profile is { } profile
            ? profile.Items.Concat(profile.Kanai).GroupBy(i => i.Slot).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal)
            : new Dictionary<string, PlannerItem>(StringComparer.Ordinal);
        var game = new Dictionary<string, DollCell>(StringComparer.Ordinal);
        var plan = new Dictionary<string, DollCell>(StringComparer.Ordinal);
        foreach (var slot in D3PaperDollLayout.Cells.Keys)
        {
            equipped.TryGetValue(slot, out var worn);
            planned.TryGetValue(slot, out var item);
            var match = worn != null && item != null && D3PlannerMatcher.IsSameItem(item, worn)
                ? D3PlannerMatcher.Evaluate(item, worn, D3PlannerService.Uncheckable) : null;
            var state = match != null ? DollCellState.Match : worn != null && item != null ? DollCellState.Mismatch : DollCellState.Neutral;
            string label = SlotLabel(slot);
            if (worn != null)
                game[slot] = new DollCell(label, WornText(worn), match != null ? AffixDetail(item!, match) : WornText(worn), state);
            if (item != null)
                plan[slot] = new DollCell(label, PlannedText(item), AffixDetail(item, match), worn == null ? DollCellState.Mismatch : state);
        }
        DollGame.Show(game, SlotLabel);
        DollPlan.Show(plan, SlotLabel);
    }

    private static string SlotLabel(string slot) => T(I18nKeys.RosbotBridgeSlotPrefix + slot.Replace('.', '_'));

    private static string WornText(ObservedItem worn) =>
        (D3PlannerService.ItemNameByGbid(worn.Gbid) ?? (worn.Name.Length > 0 ? worn.Name : worn.InternalName))
        + (worn.AncientRank > 0 ? $" ({D3PlannerService.RankName(worn.AncientRank)})" : "");

    private static string PlannedText(PlannerItem item) =>
        D3PlannerService.ItemName(item) + (item.AncientRank > 0 ? $" ({D3PlannerService.RankName(item.AncientRank)})" : "");

    private static string AffixDetail(PlannerItem item, PlannerMatch? match)
    {
        var results = match?.Stats.ToDictionary(r => r.Stat, r => r) ?? new Dictionary<PlannerStat, PlannerStatResult>();
        return string.Join(LineSeparator, new[] { PlannedText(item) }.Concat(item.Stats.Select(st =>
            (results.TryGetValue(st, out var r) ? r.Ok switch { true => MarkOk, false => MarkMissing, _ => MarkUnchecked } : "")
            + $"{D3PlannerService.StatName(st)} {st.Value.ToString(ValueFormat, CultureInfo.InvariantCulture)}{(st.Percent ? PercentSuffix : "")}")));
    }

    private static BuildRow ToRow(PlannerSlotStatus s)
    {
        var item = s.Planned;
        string slot = item.Slot.StartsWith(KanaiSlotPrefix, StringComparison.Ordinal) ? T(I18nKeys.RosbotBridgeBuildKanai) : D3PlannerService.SlotName(item);
        string name = D3PlannerService.ItemName(item) + (item.AncientRank > 0 ? $" ({D3PlannerService.RankName(item.AncientRank)})" : "");
        string have = T(I18nKeys.RosbotBridgeBuildHaveNone);
        if (s.Match is { } m)
        {
            string where = T(s.Carried ? I18nKeys.RosbotBridgeBuildHaveCarried : I18nKeys.RosbotBridgeBuildHaveGround);
            have = m.Observed.Attrs == null
                ? string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildHaveUnknown), where)
                : string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildHaveFound), where, m.OkStats, m.CheckedStats);
            if (!m.AncientOk && item.AncientRank > 0)
                have += " · " + string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildRankMissing), D3PlannerService.RankName(item.AncientRank));
        }
        var results = s.Match?.Stats.ToDictionary(r => r.Stat, r => r) ?? new Dictionary<PlannerStat, PlannerStatResult>();
        string Stat(PlannerStat st) => $"{D3PlannerService.StatName(st)} {st.Value.ToString(ValueFormat, CultureInfo.InvariantCulture)}{(st.Percent ? PercentSuffix : "")}";
        string Mark(PlannerStat st) => results.TryGetValue(st, out var r) ? r.Ok switch { true => MarkOk, false => MarkMissing, _ => MarkUnchecked } : "";
        return new BuildRow(slot, name, have,
            string.Join(StatSeparator, item.Stats.Select(Stat)),
            string.Join(LineSeparator, item.Stats.Select(st => Mark(st) + Stat(st))));
    }

    private async void BtnLoad_Click(object sender, RoutedEventArgs e)
    {
        string url = TxtUrl.Text.Trim();
        if (MaxrollD3PlannerClient.ParseId(url) == null)
        {
            TxtStatus.Text = T(I18nKeys.RosbotBridgeBuildNone);
            return;
        }
        BtnLoad.IsEnabled = false;
        TxtStatus.Text = T(I18nKeys.RosbotBridgeBuildLoading);
        try
        {
            await D3PlannerService.LoadAsync(url);
        }
        catch (Exception ex)
        {
            TxtStatus.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildLoadFailed), ex.Message);
        }
        finally
        {
            BtnLoad.IsEnabled = true;
        }
    }

    private void TxtUrl_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) BtnLoad_Click(sender, e);
    }

    private void CmbBuild_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!_loadingProfiles && CmbBuild.SelectedIndex >= 0) D3PlannerService.SelectBuild(CmbBuild.SelectedIndex);
    }

    private void BtnRemove_Click(object sender, RoutedEventArgs e) => D3PlannerService.RemoveBuild(D3PlannerService.BuildIndex);

    private void CmbProfile_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!_loadingProfiles && CmbProfile.SelectedIndex >= 0) D3PlannerService.SelectProfile(CmbProfile.SelectedIndex);
    }

    private sealed record BuildRow(string Slot, string Item, string Have, string Affixes, string Detail);
}

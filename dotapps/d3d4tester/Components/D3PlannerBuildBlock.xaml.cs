// PY-REF: none (DOT-only)
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// Build sub-tab of the bridge panel: load a maxroll d3planner build by URL, pick its gear set, switch drop / pickup alerts, and see
/// every planned item (slot, name, required ancient rank, affixes) next to its best copy in game (carried or on the ground, affixes
/// ok / checked). Refreshed every RefreshInterval while visible; data comes from D3PlannerService.
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
        LblProfile.Text = T(I18nKeys.RosbotBridgeBuildProfile);
        ChkNotify.Content = T(I18nKeys.RosbotBridgeBuildNotify);
        ChkNotifyPush.Content = T(I18nKeys.RosbotBridgeBuildNotifyPush);
        ColSlot.Header = T(I18nKeys.RosbotBridgeBuildColSlot);
        ColItem.Header = T(I18nKeys.RosbotBridgeBuildColItem);
        ColHave.Header = T(I18nKeys.RosbotBridgeBuildColHave);
        ColAffixes.Header = T(I18nKeys.RosbotBridgeBuildColAffixes);
        TxtHint.Text = T(I18nKeys.RosbotBridgeBuildHint);
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
        CmbProfile.ItemsSource = build?.Profiles.Select(p => p.Name).ToList();
        CmbProfile.SelectedIndex = D3PlannerService.ProfileIndex;
        _loadingProfiles = false;
        RefreshItems();
    }

    private void RefreshItems()
    {
        if (!IsVisible) return;
        LstItems.ItemsSource = D3PlannerService.Status().Select(ToRow).ToList();
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

    private void CmbProfile_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!_loadingProfiles && CmbProfile.SelectedIndex >= 0) D3PlannerService.SelectProfile(CmbProfile.SelectedIndex);
    }

    private sealed record BuildRow(string Slot, string Item, string Have, string Affixes, string Detail);
}

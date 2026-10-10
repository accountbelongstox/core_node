// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.Windows;
using DotCore.Utils;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// Build sub-tab of the bridge panel: load a maxroll d3planner build by URL, pick its gear set, switch drop / pickup alerts, two
/// paper dolls in D3 character-screen layout (left = what the hero wears, from the bridge plugin; right = the maxroll gear set; same
/// item = match, different / missing = mismatch), then three sub-tabs: gear (every planned item: slot, name, required ancient rank,
/// gems, affixes, next to its best copy in game), skills (skill bar with runes, passives, Kanai's Cube, paragon level) and follower
/// (type, skills, gear). The planner cache folder (versioned with the code) is shown with an open button. Refreshed every
/// RefreshInterval while visible (D3PlannerService).
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
    private const string NameSeparator = " · ";
    private const string LabelSeparator = ": ";

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
        ColGems.Header = ColFollowerGems.Header = T(I18nKeys.RosbotBridgeBuildColGems);
        TabGear.Header = T(I18nKeys.RosbotBridgeBuildTabGear);
        TabSkills.Header = T(I18nKeys.RosbotBridgeBuildTabSkills);
        TabFollower.Header = T(I18nKeys.RosbotBridgeBuildTabFollower);
        ColSkillSlot.Header = ColSlot.Header;
        ColSkillName.Header = T(I18nKeys.RosbotBridgeBuildColSkill);
        ColSkillRune.Header = T(I18nKeys.RosbotBridgeBuildColRune);
        ColSkillIcon.Header = "";
        LblPassives.Text = T(I18nKeys.RosbotBridgeBuildPassives);
        BtnSwitchSkills.Content = T(I18nKeys.RosbotBridgeBuildSkillSwitch);
        BtnSwitchSkills.ToolTip = T(I18nKeys.RosbotBridgeBuildSkillSwitchTip);
        ColFollowerSlot.Header = T(I18nKeys.RosbotBridgeBuildColSlot);
        ColFollowerItem.Header = T(I18nKeys.RosbotBridgeBuildColItem);
        ColFollowerAffixes.Header = T(I18nKeys.RosbotBridgeBuildColAffixes);
        BtnOpenCache.ToolTip = T(I18nKeys.RosbotBridgeBuildOpenCache);
        TxtCacheDir.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildCacheDir), D3PlannerService.CacheDir);
        TxtCacheDir.ToolTip = D3PlannerService.CacheDir;
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
        RefreshSkills();
        RefreshItems();
    }

    /// <summary>Skills and follower sub-tabs from the selected gear set (static build data, refreshed when the build changes).</summary>
    private void RefreshSkills()
    {
        var profile = D3PlannerService.Profile;
        string cls = D3PlannerService.Build?.Class ?? "";
        string cacheDir = D3PlannerService.CacheDir;
        LstSkills.ItemsSource = profile?.Skills.Select(s => new SkillRow(
            T(I18nKeys.RosbotBridgeBuildSkillSlotPrefix + s.SlotIndex.ToString(CultureInfo.InvariantCulture)),
            LoadIcon(D3SkillIcons.SkillIconPath(cacheDir, cls, s.Id)), Pick(s.NameEn, s.NameZh), Pick(s.RuneNameEn, s.RuneNameZh))).ToList();
        LstPassives.ItemsSource = profile?.Passives.Select(p => new PassiveRow(LoadIcon(D3SkillIcons.PassiveIconPath(cacheDir, cls, p.Id)), Pick(p.NameEn, p.NameZh))).ToList();
        BtnSwitchSkills.IsEnabled = profile is { Skills.Count: > 0 } && !D3SkillSwitchService.IsRunning;
        TxtKanai.Text = T(I18nKeys.RosbotBridgeBuildKanai) + LabelSeparator
            + string.Join(NameSeparator, profile?.Kanai.Select(i => $"{SlotLabel(i.Slot)} {D3PlannerService.ItemName(i)}") ?? Array.Empty<string>());
        TxtParagon.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildParagon), profile?.ParagonLevel ?? 0);
        TxtFollower.Text = T(I18nKeys.RosbotBridgeBuildFollower) + LabelSeparator
            + (profile?.Follower is { } f ? Pick(f.NameEn, f.NameZh) : T(I18nKeys.RosbotBridgeBuildHaveNone));
        TxtFollowerSkills.Text = T(I18nKeys.RosbotBridgeBuildFollowerSkills) + LabelSeparator + JoinNames(profile?.FollowerSkills);
        LstFollowerItems.ItemsSource = profile?.FollowerItems.Select(i => new FollowerRow(D3PlannerService.SlotName(i), ItemIcon(i), PlannedText(i),
            GemsText(i), GemIcons(i), string.Join(StatSeparator, i.Stats.Select(StatText)), AffixDetail(i, null))).ToList();
    }

    /// <summary>Cached icon file as an image (loaded into memory, so the file stays free); null while it is not cached yet.</summary>
    private static ImageSource? LoadIcon(string path)
    {
        if (!File.Exists(path)) return null;
        var image = new BitmapImage();
        image.BeginInit();
        image.CacheOption = BitmapCacheOption.OnLoad;
        image.UriSource = new Uri(path);
        image.EndInit();
        image.Freeze();
        return image;
    }

    /// <summary>Ask for the method, then switch the hero's skills, runes and passives to the selected gear set (D3SkillSwitchService).</summary>
    private async void BtnSwitchSkills_Click(object sender, RoutedEventArgs e)
    {
        if (D3PlannerService.Build is not { } build || D3PlannerService.Profile is not { } profile) return;
        var dialog = new SkillSwitchDialog($"{build.Name} · {profile.Name}", D3SkillSwitchService.PluginAvailable) { Owner = Window.GetWindow(this) };
        if (dialog.ShowDialog() != true) return;
        BtnSwitchSkills.IsEnabled = false;
        TxtSwitchStatus.Text = T(I18nKeys.RosbotBridgeBuildSkillSwitchRunning);
        var progress = new SkillSwitchProgressWindow($"{build.Name} · {profile.Name}") { Owner = Window.GetWindow(this) };
        progress.Show();
        try
        {
            var result = await D3SkillSwitchService.RunAsync(dialog.Method, progress.Add);
            TxtSwitchStatus.Text = result == null
                ? T(I18nKeys.RosbotBridgeBuildSkillSwitchBusy)
                : string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildSkillSwitchOutcomePrefix + result.Outcome.ToString().ToLowerInvariant()),
                    result.SkillsChanged, result.PassivesChanged, result.Mismatches, result.Detail);
        }
        catch (Exception ex)
        {
            TxtSwitchStatus.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildSkillSwitchFailed), ex.Message);
        }
        finally
        {
            BtnSwitchSkills.IsEnabled = true;
            progress.Finish(TxtSwitchStatus.Text);
        }
    }

    private static string Pick(string en, string zh) => D3PlannerService.UseChineseNames && zh.Length > 0 ? zh : en;

    private static string JoinNames(IEnumerable<PlannerNamed>? names) =>
        string.Join(NameSeparator, names?.Select(n => Pick(n.NameEn, n.NameZh)) ?? Array.Empty<string>());

    private static string GemsText(PlannerItem item) => JoinNames(item.Gems);

    /// <summary>Library icons already loaded (the gear list is rebuilt on every status change).</summary>
    private static readonly Dictionary<string, ImageSource?> LibraryIcons = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Icon from the template icon libraries for an English item / gem name (D3ItemIcons); null when they have none.</summary>
    private static ImageSource? LibraryIcon(string nameEn)
    {
        if (D3ItemIcons.FindPath(nameEn) is not { } path) return null;
        if (!LibraryIcons.TryGetValue(path, out var icon)) LibraryIcons[path] = icon = LoadIcon(path);
        return icon;
    }

    private static ImageSource? ItemIcon(PlannerItem item) => LibraryIcon(item.NameEn);

    /// <summary>Icons of the socketed gems that the libraries have.</summary>
    private static IReadOnlyList<ImageSource> GemIcons(PlannerItem item) => item.Gems.Select(g => LibraryIcon(g.NameEn)).OfType<ImageSource>().ToList();

    private static string StatText(PlannerStat st) =>
        $"{D3PlannerService.StatName(st)} {st.Value.ToString(ValueFormat, CultureInfo.InvariantCulture)}{(st.Percent ? PercentSuffix : "")}";

    private void BtnOpenCache_Click(object sender, RoutedEventArgs e)
    {
        System.IO.Directory.CreateDirectory(D3PlannerService.CacheDir);
        ShellOpen.OpenDir(D3PlannerService.CacheDir);
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
        return new BuildRow(slot, ItemIcon(item), name, have, GemsText(item), GemIcons(item),
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
            var result = await D3PlannerService.LoadAsync(url);
            if (result.Build == null)
                TxtStatus.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildDuplicate), result.DuplicateProfiles);
            else if (result.DuplicateProfiles > 0)
                TxtStatus.Text += StatSeparator + string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildDuplicatesSkipped), result.DuplicateProfiles);
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

    private sealed record BuildRow(string Slot, ImageSource? Icon, string Item, string Have, string Gems, IReadOnlyList<ImageSource> GemIcons, string Affixes, string Detail);

    private sealed record SkillRow(string Slot, ImageSource? Icon, string Skill, string Rune);

    private sealed record PassiveRow(ImageSource? Icon, string Name);

    private sealed record FollowerRow(string Slot, ImageSource? Icon, string Item, string Gems, IReadOnlyList<ImageSource> GemIcons, string Affixes, string Detail);
}

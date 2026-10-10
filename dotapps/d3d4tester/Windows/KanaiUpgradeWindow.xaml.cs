// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Kanai;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using OpenCvSharp;
using Window = System.Windows.Window;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Kanai's Cube rare -> legendary hunt for the selected gear set (one window, reopened in front): pick the wanted items (hero gear and
/// cube powers) with their minimum rank and required affixes (left; saved per gear set), the run options, the material stock and what a
/// run costs / the stock affords / a target needs on average (run tab), start / stop / follow the steps; the bag hints tab shows which
/// rares can become a target and which legendaries already look like one; the history tab totals every run (materials consumed).
/// </summary>
public partial class KanaiUpgradeWindow : Window
{
    private const string TimeFormat = "HH:mm:ss";
    private const string HistoryTimeFormat = "MM-dd HH:mm";
    private const string MarkOk = "✓";
    private const string MarkFailed = "✗";
    private const string MarkInfo = "•";
    private const string CellFormat = "({0},{1})";
    private const string ScoreFormat = "0.00";
    private const string NameSeparator = " / ";
    private const string ListSeparator = ", ";
    private static KanaiUpgradeWindow? _open;

    private readonly ObservableCollection<LogRow> _log = new();
    private List<TargetRow> _targets = new();
    private bool _loading;

    private KanaiUpgradeWindow()
    {
        InitializeComponent();
        ApplyTexts();
        LstLog.ItemsSource = _log;
        LoadOptions();
        LoadTargets();
        LoadHistory();
        UpdateState();
        KanaiUpgradeService.Progress += OnProgress;
        KanaiUpgradeService.RunFinished += OnRunFinished;
        D3PlannerService.BuildChanged += OnBuildChanged;
        Closed += (_, _) =>
        {
            KanaiUpgradeService.Progress -= OnProgress;
            KanaiUpgradeService.RunFinished -= OnRunFinished;
            D3PlannerService.BuildChanged -= OnBuildChanged;
            _open = null;
        };
    }

    /// <summary>Show the window (the open one is brought to front).</summary>
    public static void ShowFor(Window? owner)
    {
        if (_open != null)
        {
            _open.Activate();
            return;
        }
        _open = new KanaiUpgradeWindow { Owner = owner };
        _open.Show();
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static string F(string key, params object[] args) => string.Format(CultureInfo.InvariantCulture, T(key), args);

    private void ApplyTexts()
    {
        Title = T(I18nKeys.KanaiUpgradeTitle);
        TxtHowTo.Text = T(I18nKeys.KanaiUpgradeHowTo);
        LblTargets.Text = T(I18nKeys.KanaiUpgradeTargets);
        BtnClearTargets.Content = T(I18nKeys.KanaiUpgradeClearTargets);
        ColWanted.Header = "";
        ColItem.Header = T(I18nKeys.KanaiUpgradeColItem);
        ColType.Header = T(I18nKeys.KanaiUpgradeColType);
        ColChance.Header = T(I18nKeys.KanaiUpgradeColChance);
        ColRank.Header = T(I18nKeys.KanaiUpgradeColRank);
        ColStatCount.Header = T(I18nKeys.KanaiUpgradeColStats);
        LblStats.Text = T(I18nKeys.KanaiUpgradeStatsNone);
        TabRun.Header = T(I18nKeys.KanaiUpgradeTabRun);
        TabHints.Header = T(I18nKeys.KanaiUpgradeTabHints);
        TabHistory.Header = T(I18nKeys.KanaiUpgradeTabHistory);
        LblStop.Text = T(I18nKeys.KanaiUpgradeStop);
        CmbStop.ItemsSource = new[] { T(I18nKeys.KanaiUpgradeStopAny), T(I18nKeys.KanaiUpgradeStopAll), T(I18nKeys.KanaiUpgradeStopNever) };
        LblCheck.Text = T(I18nKeys.KanaiUpgradeCheck);
        CmbCheck.ItemsSource = new[] { T(I18nKeys.KanaiUpgradeCheckEach), T(I18nKeys.KanaiUpgradeCheckPass) };
        ChkCompatible.Content = T(I18nKeys.KanaiUpgradeCompatible);
        ChkCompatible.ToolTip = T(I18nKeys.KanaiUpgradeCompatibleTip);
        ChkOcr.Content = T(I18nKeys.KanaiUpgradeOcr);
        ChkOcr.ToolTip = T(I18nKeys.KanaiUpgradeOcrTip);
        LblMax.Text = T(I18nKeys.KanaiUpgradeMax);
        ChkArmed.Content = T(I18nKeys.KanaiUpgradeArmed);
        ChkArmed.ToolTip = T(I18nKeys.KanaiUpgradeArmedTip);
        LblMaterials.Text = T(I18nKeys.KanaiUpgradeMaterials);
        LblDeathsBreath.Text = T(I18nKeys.KanaiUpgradeDeathsBreath);
        LblReusableParts.Text = T(I18nKeys.KanaiUpgradeReusableParts);
        LblArcaneDust.Text = T(I18nKeys.KanaiUpgradeArcaneDust);
        LblVeiledCrystal.Text = T(I18nKeys.KanaiUpgradeVeiledCrystal);
        BtnStart.Content = T(I18nKeys.KanaiUpgradeStart);
        BtnStop.Content = T(I18nKeys.KanaiUpgradeStopRun);
        BtnScan.Content = BtnScanHints.Content = T(I18nKeys.KanaiUpgradeScan);
        ColLogTime.Header = T(I18nKeys.KanaiUpgradeColTime);
        ColLogKind.Header = T(I18nKeys.KanaiUpgradeColStage);
        ColLogDetail.Header = T(I18nKeys.KanaiUpgradeColDetail);
        ColHintCell.Header = ColProdCell.Header = T(I18nKeys.KanaiUpgradeColCell);
        ColHintKind.Header = T(I18nKeys.KanaiUpgradeColKind);
        ColHintItem.Header = ColProdItem.Header = T(I18nKeys.KanaiUpgradeColItem);
        ColHintScore.Header = T(I18nKeys.KanaiUpgradeColScore);
        ColHintTarget.Header = ColProdTarget.Header = T(I18nKeys.KanaiUpgradeColTarget);
        BtnClearHistory.Content = T(I18nKeys.KanaiUpgradeClearHistory);
        ColRunTime.Header = T(I18nKeys.KanaiUpgradeColTime);
        ColRunBuild.Header = T(I18nKeys.KanaiUpgradeColBuild);
        ColRunTransmutes.Header = T(I18nKeys.KanaiUpgradeColTransmutes);
        ColRunProducts.Header = T(I18nKeys.KanaiUpgradeColProducts);
        ColRunTargets.Header = T(I18nKeys.KanaiUpgradeColHits);
        ColRunOutcome.Header = T(I18nKeys.KanaiUpgradeColOutcome);
        ColRunDuration.Header = T(I18nKeys.KanaiUpgradeColDuration);
        ColProdSource.Header = T(I18nKeys.KanaiUpgradeColSource);
        ColProdDetail.Header = T(I18nKeys.KanaiUpgradeColDetail);
    }

    private void LoadOptions()
    {
        _loading = true;
        var store = KanaiUpgradeService.Store;
        CmbStop.SelectedIndex = (int)store.Stop;
        CmbCheck.SelectedIndex = (int)store.Check;
        ChkCompatible.IsChecked = store.OnlyCompatibleRares;
        ChkOcr.IsChecked = store.VerifyByOcr;
        TxtMax.Text = store.MaxTransmutes > 0 ? store.MaxTransmutes.ToString(CultureInfo.InvariantCulture) : "";
        ChkArmed.IsChecked = store.Armed;
        TxtDeathsBreath.Text = store.Stock.DeathsBreath.ToString(CultureInfo.InvariantCulture);
        TxtReusableParts.Text = store.Stock.ReusableParts.ToString(CultureInfo.InvariantCulture);
        TxtArcaneDust.Text = store.Stock.ArcaneDust.ToString(CultureInfo.InvariantCulture);
        TxtVeiledCrystal.Text = store.Stock.VeiledCrystal.ToString(CultureInfo.InvariantCulture);
        _loading = false;
    }

    private void LoadTargets()
    {
        _loading = true;
        var build = D3PlannerService.Build;
        var profile = D3PlannerService.Profile;
        TxtHeader.Text = build != null && profile != null ? $"{build.Name} · {profile.Name}" : T(I18nKeys.KanaiUpgradeNoBuild);
        var catalog = D3ItemCatalog.For(D3PlannerService.CacheDir);
        var choices = KanaiUpgradeService.Choices.ToDictionary(c => c.Key, StringComparer.Ordinal);
        var rankNames = new[] { T(I18nKeys.KanaiUpgradeRankAny), T(I18nKeys.KanaiUpgradeRankAncient), T(I18nKeys.KanaiUpgradeRankPrimal) };
        _targets = KanaiUpgradeService.Candidates.Select(item =>
        {
            string key = KanaiUpgradeTarget.KeyOf(item);
            var choice = choices.GetValueOrDefault(key);
            var entry = catalog.Of(item);
            int possible = entry != null ? catalog.OfType(entry.Type).Count : 0;
            var (typeEn, typeZh) = entry != null ? catalog.TypeName(entry.Type) : (T(I18nKeys.KanaiUpgradeTypeUnknown), "");
            string type = D3PlannerService.UseChineseNames && typeZh.Length > 0 ? typeZh : typeEn;
            var stats = item.Stats.Select(s => new StatRow(s.Code,
                $"{D3PlannerService.StatName(s)} {s.Value.ToString("0.##", CultureInfo.InvariantCulture)}{(s.Percent ? "%" : "")}",
                choice?.Stats.Contains(s.Code, StringComparer.Ordinal) == true)).ToList();
            return new TargetRow(item, key, LoadIcon(D3ItemIcons.FindPath(item.NameEn)), D3PlannerService.ItemName(item), D3PlannerService.SlotName(item), type,
                possible > 0 ? F(I18nKeys.KanaiUpgradeChance, possible) : "-", possible,
                possible > 0 ? F(I18nKeys.KanaiUpgradeChanceDetail, possible, type, item.NameEn, item.NameZh) : item.NameEn, rankNames, stats)
            {
                Wanted = choice != null,
                RankIndex = Math.Clamp(choice?.MinAncientRank ?? 0, 0, rankNames.Length - 1),
            };
        }).ToList();
        LstTargets.ItemsSource = _targets;
        LstStats.ItemsSource = null;
        LblStats.Text = T(I18nKeys.KanaiUpgradeStatsNone);
        _loading = false;
        UpdatePlan();
    }

    private void SaveChoices()
    {
        if (_loading) return;
        KanaiUpgradeService.SaveChoices(_targets.Where(t => t.Wanted).Select(t => new KanaiTargetChoice
        {
            Key = t.Key,
            MinAncientRank = t.RankIndex,
            Stats = t.Stats.Where(s => s.Required).Select(s => s.Code).ToList(),
        }));
        foreach (var t in _targets) t.Refresh();
        UpdatePlan();
    }

    private void SaveOptions()
    {
        if (_loading) return;
        var store = KanaiUpgradeService.Store;
        store.Stop = (KanaiUpgradeStop)Math.Max(0, CmbStop.SelectedIndex);
        store.Check = (KanaiUpgradeCheck)Math.Max(0, CmbCheck.SelectedIndex);
        store.OnlyCompatibleRares = ChkCompatible.IsChecked == true;
        store.VerifyByOcr = ChkOcr.IsChecked == true;
        store.MaxTransmutes = int.TryParse(TxtMax.Text.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int max) && max > 0 ? max : 0;
        store.Armed = ChkArmed.IsChecked == true;
        store.Stock = new KanaiMaterials(Number(TxtDeathsBreath), Number(TxtReusableParts), Number(TxtArcaneDust), Number(TxtVeiledCrystal));
        KanaiUpgradeService.Save();
        UpdatePlan();
        UpdateState();
    }

    private static long Number(TextBox box) =>
        long.TryParse(box.Text.Trim().Replace(",", ""), NumberStyles.Integer, CultureInfo.InvariantCulture, out long v) && v > 0 ? v : 0;

    /// <summary>Cost per transmute, transmutes the stock pays for, and the average number of transmutes / materials the wanted items need.</summary>
    private void UpdatePlan()
    {
        var store = KanaiUpgradeService.Store;
        var cost = KanaiMaterials.UpgradeRareCost;
        long affords = store.Stock.Affords(cost);
        string text = F(I18nKeys.KanaiUpgradePlan, Materials(cost), affords);
        var wanted = _targets.Where(t => t.Wanted && t.Possible > 0).ToList();
        if (wanted.Count == 0) text += Environment.NewLine + T(I18nKeys.KanaiUpgradePlanNoTarget);
        else
        {
            double expected = store.Stop == KanaiUpgradeStop.AllTargets
                ? wanted.Sum(t => (double)t.Possible)
                : 1.0 / wanted.Sum(t => 1.0 / t.Possible);
            long rounded = (long)Math.Ceiling(expected);
            text += Environment.NewLine + F(I18nKeys.KanaiUpgradePlanTargets, string.Join(ListSeparator, wanted.Select(t => t.Name)), rounded, Materials(cost.Times(rounded)));
        }
        TxtPlan.Text = text;
    }

    private static string Materials(KanaiMaterials m) => F(I18nKeys.KanaiUpgradeMaterialsFormat, m.DeathsBreath, m.ReusableParts, m.ArcaneDust, m.VeiledCrystal);

    private void UpdateState()
    {
        bool running = KanaiUpgradeService.IsRunning;
        TxtState.Text = running ? T(I18nKeys.KanaiUpgradeStateRunning)
            : T(D3SkillSwitchService.PluginAvailable ? I18nKeys.KanaiUpgradeStatePlugin : I18nKeys.KanaiUpgradeStateImage);
        ChipState.Style = (Style)FindResource(running ? "StatusChipWarningStyle" : D3SkillSwitchService.PluginAvailable ? "StatusChipSuccessStyle" : "StatusChipInfoStyle");
        BtnStart.IsEnabled = !running && D3PlannerService.Profile != null;
        BtnStop.IsEnabled = running;
    }

    private void LoadHistory()
    {
        var totals = KanaiUpgradeService.Totals();
        TxtTotals.Text = F(I18nKeys.KanaiUpgradeTotals, totals.Runs, totals.Transmutes, totals.Products, totals.TargetsReached, Materials(totals.Consumed));
        LstHistory.ItemsSource = KanaiUpgradeService.Store.History.Select(r => new RunRow(r,
            r.StartUtc.ToLocalTime().ToString(HistoryTimeFormat, CultureInfo.InvariantCulture),
            $"{r.Build} · {r.Profile}".Trim(' ', '·'), r.Transmutes, r.Products.Count, r.TargetsReached.Count,
            T(I18nKeys.KanaiUpgradeOutcomePrefix + r.Outcome.ToString().ToLowerInvariant()),
            r.Elapsed.TotalSeconds.ToString("0.0", CultureInfo.InvariantCulture))).ToList();
        LstProducts.ItemsSource = null;
    }

    private void OnProgress(KanaiUpgradeEvent e) => Dispatcher.BeginInvoke(() =>
    {
        var row = new LogRow(e.Time.ToString(TimeFormat, CultureInfo.InvariantCulture), e.Ok switch { true => MarkOk, false => MarkFailed, _ => MarkInfo },
            T(I18nKeys.KanaiUpgradeEventPrefix + e.Kind), e.Detail);
        _log.Add(row);
        LstLog.ScrollIntoView(row);
        UpdateState();
    });

    private void OnRunFinished(KanaiUpgradeRun run) => Dispatcher.BeginInvoke(() =>
    {
        TxtRunStatus.Text = F(I18nKeys.KanaiUpgradeFinished, T(I18nKeys.KanaiUpgradeOutcomePrefix + run.Outcome.ToString().ToLowerInvariant()),
            run.Transmutes, run.Products.Count, run.TargetsReached.Count, run.Elapsed.TotalSeconds.ToString("0.0", CultureInfo.InvariantCulture));
        LoadOptions();
        LoadHistory();
        UpdatePlan();
        UpdateState();
    });

    private void OnBuildChanged() => Dispatcher.BeginInvoke(() =>
    {
        LoadTargets();
        UpdateState();
    });

    private void LstTargets_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (LstTargets.SelectedItem is not TargetRow row) return;
        LblStats.Text = F(I18nKeys.KanaiUpgradeStats, row.Name);
        LstStats.ItemsSource = row.Stats;
    }

    private void Choice_Changed(object sender, RoutedEventArgs e)
    {
        if (e.OriginalSource is CheckBox) SaveChoices();
    }

    private void Rank_Changed(object sender, SelectionChangedEventArgs e) => SaveChoices();

    private void Option_Changed(object sender, RoutedEventArgs e) => SaveOptions();

    private void Stock_Changed(object sender, RoutedEventArgs e) => SaveOptions();

    private void BtnClearTargets_Click(object sender, RoutedEventArgs e)
    {
        foreach (var t in _targets)
        {
            t.Wanted = false;
            foreach (var s in t.Stats) s.Required = false;
        }
        LstTargets.Items.Refresh();
        LstStats.Items.Refresh();
        SaveChoices();
    }

    private async void BtnStart_Click(object sender, RoutedEventArgs e)
    {
        SaveOptions();
        SaveChoices();
        _log.Clear();
        TxtRunStatus.Text = T(I18nKeys.KanaiUpgradeRunning);
        BtnStart.IsEnabled = false;
        BtnStop.IsEnabled = true;
        var run = await KanaiUpgradeService.RunAsync();
        if (run == null) TxtRunStatus.Text = T(I18nKeys.KanaiUpgradeBusy);
        UpdateState();
    }

    private void BtnStop_Click(object sender, RoutedEventArgs e) => KanaiUpgradeService.Stop();

    private async void BtnScan_Click(object sender, RoutedEventArgs e)
    {
        BtnScan.IsEnabled = BtnScanHints.IsEnabled = false;
        TxtScanSummary.Text = T(I18nKeys.KanaiUpgradeScanning);
        Tabs.SelectedItem = TabHints;
        try
        {
            var scan = await KanaiUpgradeService.ScanAsync();
            ShowScan(scan);
        }
        finally
        {
            BtnScan.IsEnabled = BtnScanHints.IsEnabled = true;
        }
    }

    private void ShowScan(KanaiBagScan scan)
    {
        if (scan.Utc == DateTime.MinValue)
        {
            TxtScanSummary.Text = T(I18nKeys.KanaiUpgradeScanFailed);
            LstHints.ItemsSource = null;
            return;
        }
        var names = _targets.ToDictionary(t => t.Key, t => t.Name, StringComparer.Ordinal);
        string Names(IEnumerable<string> keys) => string.Join(ListSeparator, keys.Select(k => names.GetValueOrDefault(k, k)));
        var rows = new List<HintRow>();
        foreach (var r in scan.Rares)
            rows.Add(new HintRow(string.Format(CultureInfo.InvariantCulture, CellFormat, r.Row, r.Col),
                T(r.NonGear ? I18nKeys.KanaiUpgradeHintNonGear : I18nKeys.KanaiUpgradeHintRare), GroupLabel(r.Group),
                r.Score.ToString(ScoreFormat, CultureInfo.InvariantCulture), r.TargetKeys.Count > 0 ? F(I18nKeys.KanaiUpgradeHintCanBecome, Names(r.TargetKeys)) : ""));
        foreach (var l in scan.Legendaries)
            rows.Add(new HintRow(string.Format(CultureInfo.InvariantCulture, CellFormat, l.Row, l.Col), T(I18nKeys.KanaiUpgradeHintLegendary),
                l.Item == null ? "?" : string.Join(NameSeparator, new[] { l.Item.NameZh, l.Item.NameEn }.Where(n => n.Length > 0)),
                l.Score.ToString(ScoreFormat, CultureInfo.InvariantCulture), l.TargetKey is { } k ? F(I18nKeys.KanaiUpgradeHintIsTarget, Names(new[] { k })) : ""));
        LstHints.ItemsSource = rows.OrderByDescending(r => r.Target.Length > 0).ToList();
        TxtScanSummary.Text = F(I18nKeys.KanaiUpgradeScanSummary, T(scan.KanaiOpen ? I18nKeys.KanaiUpgradeCubeOpen : I18nKeys.KanaiUpgradeCubeClosed),
            scan.Rares.Count(r => !r.NonGear), scan.Rares.Count(r => r.TargetKeys.Count > 0), scan.Legendaries.Count,
            scan.Legendaries.Count(l => l.TargetKey != null), scan.Skipped);
    }

    /// <summary>Wiki folder name of an item type group without its "Diablo_III_" / "_icons" wrapping.</summary>
    private static string GroupLabel(string group) => group.Length == 0 ? "?" : group.Replace("Diablo_III_", "").Replace("_icons", "").Replace('_', ' ');

    private void LstHistory_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (LstHistory.SelectedItem is not RunRow row) return;
        var names = _targets.ToDictionary(t => t.Key, t => t.Name, StringComparer.Ordinal);
        LstProducts.ItemsSource = row.Run.Products.Select(p => new ProductRow(string.Format(CultureInfo.InvariantCulture, CellFormat, p.Row, p.Col),
            string.Join(NameSeparator, new[] { p.NameZh, p.NameEn }.Where(n => n.Length > 0)), T(I18nKeys.KanaiUpgradeSourcePrefix + p.Source),
            p.TargetKey == null ? "" : p.Satisfied ? MarkOk : MarkFailed, p.Detail)).ToList();
    }

    private void BtnClearHistory_Click(object sender, RoutedEventArgs e)
    {
        KanaiUpgradeService.ClearHistory();
        LoadHistory();
    }

    /// <summary>Icon image through OpenCV (the wiki icons are WebP files with a .png name, which WPF may not decode).</summary>
    private static ImageSource? LoadIcon(string? path)
    {
        if (path == null || !File.Exists(path)) return null;
        using var mat = Cv2.ImRead(path, ImreadModes.Unchanged);
        if (mat.Empty() || !Cv2.ImEncode(".png", mat, out byte[] png)) return null;
        var image = new BitmapImage();
        image.BeginInit();
        image.CacheOption = BitmapCacheOption.OnLoad;
        image.StreamSource = new MemoryStream(png);
        image.EndInit();
        image.Freeze();
        return image;
    }

    private sealed class TargetRow : INotifyPropertyChanged
    {
        public TargetRow(PlannerItem item, string key, ImageSource? icon, string name, string slot, string type, string chance, int possible, string detail,
            IReadOnlyList<string> rankNames, List<StatRow> stats)
        {
            Item = item;
            Key = key;
            Icon = icon;
            Name = name;
            Slot = slot;
            Type = type;
            Chance = chance;
            Possible = possible;
            Detail = detail;
            RankNames = rankNames;
            Stats = stats;
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        public PlannerItem Item { get; }
        public string Key { get; }
        public ImageSource? Icon { get; }
        public string Name { get; }
        public string Slot { get; }
        public string Type { get; }
        public string Chance { get; }
        public int Possible { get; }
        public string Detail { get; }
        public IReadOnlyList<string> RankNames { get; }
        public List<StatRow> Stats { get; }
        public bool Wanted { get; set; }
        public int RankIndex { get; set; }
        public string StatSummary => Stats.Count(s => s.Required) is var n and > 0 ? F(I18nKeys.KanaiUpgradeStatCount, n) : "";

        public void Refresh() => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(StatSummary)));
    }

    private sealed class StatRow
    {
        public StatRow(string code, string label, bool required)
        {
            Code = code;
            Label = label;
            Required = required;
        }

        public string Code { get; }
        public string Label { get; }
        public bool Required { get; set; }
    }

    private sealed record LogRow(string Time, string Mark, string Kind, string Detail);

    private sealed record HintRow(string Cell, string Kind, string Item, string Score, string Target);

    private sealed record RunRow(KanaiUpgradeRun Run, string Time, string Build, int Transmutes, int Products, int Targets, string Outcome, string Duration);

    private sealed record ProductRow(string Cell, string Item, string Source, string Target, string Detail);
}
